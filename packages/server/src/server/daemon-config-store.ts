import {
  loadPersistedConfig,
  savePersistedConfig,
  type PersistedConfig,
} from "./persisted-config.js";
import { ProviderOverrideSchema, ProviderOverridesSchema } from "./agent/provider-launch-config.js";
import {
  MutableDaemonConfigSchema,
  MutableDaemonConfigPatchSchema,
} from "@getpaseo/protocol/messages";

export type { MutableDaemonConfig, MutableDaemonConfigPatch } from "@getpaseo/protocol/messages";

type MutableDaemonConfig = import("@getpaseo/protocol/messages").MutableDaemonConfig;
type MutableDaemonConfigPatch = import("@getpaseo/protocol/messages").MutableDaemonConfigPatch;
type ProviderOverride = import("./agent/provider-launch-config.js").ProviderOverride;

interface LoggerLike {
  child(bindings: Record<string, unknown>): LoggerLike;
  info(...args: unknown[]): void;
}

export interface DaemonConfigChangeDetails {
  removedProviders: readonly string[];
  /** Internal-only overrides used to rebuild the registry. Never put these on the wire. */
  providerOverrides?: Record<string, ProviderOverride>;
}

export interface SaveCodexEndpointProfileInput {
  profileId: string;
  label: string;
  baseUrl: string;
  apiKey?: string;
  models: Array<{ id: string; label?: string }>;
  enabled?: boolean;
}

export interface SavedCodexEndpointProfile {
  id: string;
  label: string;
  baseUrl: string;
  models: Array<{ id: string; label: string; isDefault?: boolean }>;
  enabled: boolean;
  hasApiKey: boolean;
}

type ConfigListener = (config: MutableDaemonConfig, details: DaemonConfigChangeDetails) => void;
type FieldChangeHandler = (value: unknown) => void;

function getLogger(logger: LoggerLike | undefined): LoggerLike | undefined {
  return logger?.child({ module: "daemon-config-store" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(
  current: T,
  patch: Record<string, unknown>,
): T {
  const next: Record<string, unknown> = { ...current };

  for (const [key, patchValue] of Object.entries(patch)) {
    if (patchValue === undefined) {
      continue;
    }
    const currentValue = next[key];
    if (isRecord(currentValue) && isRecord(patchValue)) {
      next[key] = deepMerge(currentValue, patchValue);
      continue;
    }
    next[key] = patchValue;
  }

  return next as T;
}

function omitProvidersFromConfig<T extends { providers?: Record<string, unknown> }>(
  config: T,
  providers: readonly string[],
): T {
  if (providers.length === 0 || !config.providers) {
    return config;
  }

  let changed = false;
  const nextProviders = { ...config.providers };
  for (const provider of providers) {
    if (provider in nextProviders) {
      delete nextProviders[provider];
      changed = true;
    }
  }

  return changed ? ({ ...config, providers: nextProviders } as T) : config;
}

function omitMetadataGenerationProvidersFromConfig<
  T extends { metadataGeneration?: { providers?: Array<{ provider?: unknown }> } },
>(config: T, providers: readonly string[]): T {
  if (providers.length === 0 || !config.metadataGeneration?.providers) {
    return config;
  }

  const removedProviderIds = new Set(providers);
  const nextProviders = config.metadataGeneration.providers.filter((entry) => {
    return typeof entry.provider !== "string" || !removedProviderIds.has(entry.provider);
  });
  if (nextProviders.length === config.metadataGeneration.providers.length) {
    return config;
  }

  return {
    ...config,
    metadataGeneration: {
      ...config.metadataGeneration,
      providers: nextProviders,
    },
  } as T;
}

function omitProvidersFromOverrides(
  overrides: Record<string, ProviderOverride> | undefined,
  providers: readonly string[],
): Record<string, ProviderOverride> | undefined {
  if (!overrides) {
    return undefined;
  }

  const nextOverrides = { ...overrides };
  for (const provider of providers) {
    delete nextOverrides[provider];
  }

  return Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined;
}

function omitProvidersFromPersistedAgents(
  agents: PersistedConfig["agents"],
): Record<string, unknown> | undefined {
  if (!agents) {
    return undefined;
  }

  const { providers: _providers, ...rest } = agents as Record<string, unknown>;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

function getValueAtPath(config: MutableDaemonConfig, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((value, segment) => (isRecord(value) ? value[segment] : undefined), config);
}

function isEqualValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function applyMutableProviderConfigToOverrides(
  baseOverrides: Record<string, ProviderOverride> | undefined,
  mutableProviders: MutableDaemonConfig["providers"] | undefined,
): Record<string, ProviderOverride> | undefined {
  if (!baseOverrides && (!mutableProviders || Object.keys(mutableProviders).length === 0)) {
    return undefined;
  }

  const nextOverrides: Record<string, ProviderOverride> = { ...baseOverrides };
  for (const [providerId, providerConfig] of Object.entries(mutableProviders ?? {})) {
    nextOverrides[providerId] = {
      ...nextOverrides[providerId],
      ...ProviderOverrideSchema.strip().parse(providerConfig),
    };
  }

  return nextOverrides;
}

export class DaemonConfigStore {
  private current: MutableDaemonConfig;
  private readonly paseoHome: string;
  private readonly logger: LoggerLike | undefined;
  private readonly changeListeners = new Set<ConfigListener>();
  private readonly fieldChangeHandlers = new Map<string, Set<FieldChangeHandler>>();

  constructor(paseoHome: string, initial: MutableDaemonConfig, logger?: LoggerLike) {
    this.paseoHome = paseoHome;
    this.logger = getLogger(logger);
    this.current = MutableDaemonConfigSchema.parse(initial);
  }

  public get(): MutableDaemonConfig {
    return this.current;
  }

  /** The only daemon config representation allowed to cross the WebSocket boundary. */
  public getClientConfig(): MutableDaemonConfig {
    return redactMutableDaemonConfig(this.current);
  }

  public patch(partial: MutableDaemonConfigPatch): MutableDaemonConfig {
    const parsedPatch = MutableDaemonConfigPatchSchema.parse(partial);
    const { removeProviders = [], ...configPatch } = parsedPatch;
    const removedProviders = Array.from(new Set(removeProviders));
    const merged = deepMerge(this.current, configPatch);
    const next = MutableDaemonConfigSchema.parse(
      omitMetadataGenerationProvidersFromConfig(
        omitProvidersFromConfig(merged, removedProviders),
        removedProviders,
      ),
    );

    const changedFieldPaths = Array.from(this.fieldChangeHandlers.keys()).filter((path) => {
      return !isEqualValue(getValueAtPath(this.current, path), getValueAtPath(next, path));
    });
    const configChanged = !isEqualValue(this.current, next);

    if (!configChanged && removedProviders.length === 0) {
      return this.current;
    }

    // Persist before updating in-memory state so that if persistence fails,
    // runtime and disk stay consistent.
    this.persistConfig(next, removedProviders);
    if (!configChanged) {
      return this.current;
    }

    this.current = next;

    for (const path of changedFieldPaths) {
      const handlers = this.fieldChangeHandlers.get(path);
      if (!handlers) {
        continue;
      }
      const value = getValueAtPath(next, path);
      for (const handler of handlers) {
        handler(value);
      }
    }

    const changeDetails: DaemonConfigChangeDetails = { removedProviders };
    for (const listener of this.changeListeners) {
      listener(next, changeDetails);
    }

    return next;
  }

  /**
   * Persist a custom Codex endpoint profile. API keys are deliberately write-only:
   * this method returns only a redacted profile and updates mutable config with its
   * safe catalog fields, never the full ProviderOverride.
   */
  public saveCodexEndpointProfile(input: SaveCodexEndpointProfileInput): SavedCodexEndpointProfile {
    const persisted = loadPersistedConfig(this.paseoHome, this.logger);
    const currentOverrides = ProviderOverridesSchema.parse(persisted.agents?.providers ?? {});
    const existing = currentOverrides[input.profileId];
    if (existing?.extends && existing.extends !== "codex") {
      throw new Error(`Provider ${input.profileId} is not a Codex endpoint profile`);
    }

    const baseUrl = normalizeCodexEndpointBaseUrl(input.baseUrl);
    const models = input.models.map((model, index) => ({
      id: model.id,
      label: model.label?.trim() || model.id,
      ...(index === 0 ? { isDefault: true } : {}),
    }));
    const apiKey = input.apiKey ?? existing?.env?.OPENAI_API_KEY;
    const providerOverride: ProviderOverride = {
      ...existing,
      extends: "codex",
      label: input.label,
      description: "Codex via custom OpenAI-compatible endpoint",
      env: {
        ...existing?.env,
        OPENAI_BASE_URL: baseUrl,
        ...(apiKey ? { OPENAI_API_KEY: apiKey } : {}),
      },
      models,
      enabled: input.enabled ?? existing?.enabled ?? true,
    };
    const providerOverrides = { ...currentOverrides, [input.profileId]: providerOverride };
    const nextPersisted: PersistedConfig = {
      ...persisted,
      agents: {
        ...persisted.agents,
        providers: providerOverrides,
      } as PersistedConfig["agents"],
    };

    // Persistence precedes runtime mutation so disk and registry never diverge on failure.
    savePersistedConfig(this.paseoHome, nextPersisted, this.logger);

    const next = MutableDaemonConfigSchema.parse({
      ...this.current,
      providers: {
        ...this.current.providers,
        [input.profileId]: {
          enabled: providerOverride.enabled,
        },
      },
    });
    const changedFieldPaths = Array.from(this.fieldChangeHandlers.keys()).filter((path) => {
      return !isEqualValue(getValueAtPath(this.current, path), getValueAtPath(next, path));
    });
    this.current = next;
    for (const path of changedFieldPaths) {
      const handlers = this.fieldChangeHandlers.get(path);
      const value = getValueAtPath(next, path);
      if (handlers) for (const handler of handlers) handler(value);
    }
    for (const listener of this.changeListeners) {
      listener(next, { removedProviders: [], providerOverrides });
    }

    return {
      id: input.profileId,
      label: input.label,
      baseUrl,
      models,
      enabled: providerOverride.enabled ?? true,
      hasApiKey: Boolean(apiKey),
    };
  }

  public onFieldChange(path: string, handler: FieldChangeHandler): () => void {
    const handlers = this.fieldChangeHandlers.get(path) ?? new Set<FieldChangeHandler>();
    handlers.add(handler);
    this.fieldChangeHandlers.set(path, handlers);

    return () => {
      const currentHandlers = this.fieldChangeHandlers.get(path);
      if (!currentHandlers) {
        return;
      }
      currentHandlers.delete(handler);
      if (currentHandlers.size === 0) {
        this.fieldChangeHandlers.delete(path);
      }
    };
  }

  public onChange(listener: ConfigListener): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private persistConfig(config: MutableDaemonConfig, removeProviders: readonly string[]): void {
    const persisted = loadPersistedConfig(this.paseoHome, this.logger);
    const nextPersisted = mergeMutableConfigIntoPersistedConfig({
      persisted,
      mutable: config,
      removeProviders,
    });
    savePersistedConfig(this.paseoHome, nextPersisted, this.logger);
  }
}

function normalizeCodexEndpointBaseUrl(value: string): string {
  const parsed = new URL(value);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = pathname.endsWith("/v1") ? pathname : `${pathname}/v1`;
  return parsed.toString().replace(/\/$/, "");
}

function redactMutableDaemonConfig(config: MutableDaemonConfig): MutableDaemonConfig {
  return {
    ...config,
    providers: Object.fromEntries(
      Object.entries(config.providers).map(([providerId, provider]) => [
        providerId,
        {
          ...(provider.enabled !== undefined ? { enabled: provider.enabled } : {}),
          ...(provider.additionalModels ? { additionalModels: provider.additionalModels } : {}),
        },
      ]),
    ),
  };
}

function mergeMutableConfigIntoPersistedConfig(params: {
  persisted: PersistedConfig;
  mutable: MutableDaemonConfig;
  removeProviders: readonly string[];
}): PersistedConfig {
  const { persisted, mutable, removeProviders } = params;
  const browserToolsEnabled = readBrowserToolsEnabled(mutable);
  const metadataGenerationProviders = readMetadataGenerationProviders(mutable);
  const persistedProviderOverrides = omitProvidersFromOverrides(
    persisted.agents?.providers as Record<string, ProviderOverride> | undefined,
    removeProviders,
  );
  const providerOverrides = applyMutableProviderConfigToOverrides(
    persistedProviderOverrides,
    mutable.providers,
  );
  const persistedAgents = omitProvidersFromPersistedAgents(persisted.agents);
  const persistedMetadataGeneration = {
    providers: metadataGenerationProviders,
  };
  const shouldPersistMetadataGeneration =
    metadataGenerationProviders.length > 0 || persisted.agents?.metadataGeneration !== undefined;

  let nextAgents = persistedAgents as PersistedConfig["agents"];
  if (providerOverrides && Object.keys(providerOverrides).length > 0) {
    nextAgents = {
      ...persistedAgents,
      providers: providerOverrides,
      ...(shouldPersistMetadataGeneration
        ? { metadataGeneration: persistedMetadataGeneration }
        : {}),
    } as PersistedConfig["agents"];
  } else if (shouldPersistMetadataGeneration) {
    nextAgents = {
      ...persistedAgents,
      metadataGeneration: persistedMetadataGeneration,
    } as PersistedConfig["agents"];
  }

  return {
    ...persisted,
    daemon: {
      ...persisted.daemon,
      mcp: {
        ...persisted.daemon?.mcp,
        injectIntoAgents: mutable.mcp.injectIntoAgents,
      },
      browserTools: {
        ...persisted.daemon?.browserTools,
        enabled: browserToolsEnabled,
      },
      autoArchiveAfterMerge: mutable.autoArchiveAfterMerge,
      enableTerminalAgentHooks: mutable.enableTerminalAgentHooks,
      appendSystemPrompt: mutable.appendSystemPrompt,
      ...(mutable.terminalProfiles !== undefined
        ? { terminalProfiles: mutable.terminalProfiles }
        : {}),
    },
    agents: nextAgents,
  } as PersistedConfig;
}

function readBrowserToolsEnabled(mutable: MutableDaemonConfig): boolean {
  const browserTools = mutable.browserTools;
  if (!isRecord(browserTools)) {
    return false;
  }
  return browserTools["enabled"] === true;
}

function readMetadataGenerationProviders(
  mutable: MutableDaemonConfig,
): Array<{ provider: string; model?: string; thinkingOptionId?: string }> {
  const metadataGeneration = mutable.metadataGeneration;
  if (!isRecord(metadataGeneration)) {
    return [];
  }
  const providers = metadataGeneration["providers"];
  if (!Array.isArray(providers)) {
    return [];
  }
  return providers.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry["provider"] !== "string") {
      return [];
    }
    return [
      {
        provider: entry["provider"],
        ...(typeof entry["model"] === "string" ? { model: entry["model"] } : {}),
        ...(typeof entry["thinkingOptionId"] === "string"
          ? { thinkingOptionId: entry["thinkingOptionId"] }
          : {}),
      },
    ];
  });
}

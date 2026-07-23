export interface CodexEndpointProfileInput {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  enabled?: boolean;
  existingProviderIds: ReadonlySet<string>;
}

export interface CodexEndpointProfileErrors {
  name?: "required";
  baseUrl?: "invalid";
  apiKey?: "required";
  modelId?: "required";
}

export type CodexEndpointProfileResult =
  | {
      profileId: string;
      label: string;
      baseUrl: string;
      apiKey: string;
      models: Array<{
        id: string;
        label: string;
      }>;
      enabled: boolean;
    }
  | { errors: CodexEndpointProfileErrors };

function normalizeBaseUrl(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/u, "");
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? trimmed : null;
  } catch {
    return null;
  }
}

function createProviderId(name: string, existingProviderIds: ReadonlySet<string>): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/^[^a-z]+/u, "");
  const preferred = base || "codex-provider";
  if (!existingProviderIds.has(preferred)) return preferred;

  let suffix = 2;
  while (existingProviderIds.has(`${preferred}-${suffix}`)) {
    suffix += 1;
  }
  return `${preferred}-${suffix}`;
}

export function buildCodexEndpointProfile(
  input: CodexEndpointProfileInput,
): CodexEndpointProfileResult {
  const name = input.name.trim();
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const apiKey = input.apiKey.trim();
  const modelId = input.modelId.trim();
  const errors: CodexEndpointProfileErrors = {
    ...(name ? {} : { name: "required" }),
    ...(baseUrl ? {} : { baseUrl: "invalid" }),
    ...(apiKey ? {} : { apiKey: "required" }),
    ...(modelId ? {} : { modelId: "required" }),
  };

  if (Object.keys(errors).length > 0) return { errors };
  if (!name || !baseUrl || !apiKey || !modelId) return { errors };

  return {
    profileId: createProviderId(name, input.existingProviderIds),
    label: name,
    baseUrl,
    apiKey,
    models: [
      {
        id: modelId,
        label: modelId,
      },
    ],
    enabled: input.enabled ?? true,
  };
}

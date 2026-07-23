import { describe, expect, test } from "vitest";
import {
  GetProvidersSnapshotResponseMessageSchema,
  MutableDaemonConfigPatchSchema,
  MutableDaemonConfigSchema,
  ProviderCodexEndpointSaveRequestSchema,
  ProviderCodexEndpointSaveResponseSchema,
  ProviderSnapshotEntrySchema,
  ProvidersSnapshotUpdateMessageSchema,
} from "./messages.js";

describe("provider snapshot message schemas", () => {
  test("defaults missing provider snapshot entry enabled state to true", () => {
    const parsed = ProviderSnapshotEntrySchema.parse({
      provider: "codex",
      status: "ready",
      label: "Codex",
    });

    expect(parsed.enabled).toBe(true);
  });

  test("preserves disabled provider snapshot entries", () => {
    const parsed = ProviderSnapshotEntrySchema.parse({
      provider: "claude",
      status: "unavailable",
      enabled: false,
      label: "Claude",
    });

    expect(parsed.enabled).toBe(false);
  });

  test("preserves enabled provider snapshot entries", () => {
    const parsed = ProviderSnapshotEntrySchema.parse({
      provider: "opencode",
      status: "loading",
      enabled: true,
      label: "OpenCode",
    });

    expect(parsed.enabled).toBe(true);
  });

  test("preserves provider snapshot entry source", () => {
    const parsed = ProviderSnapshotEntrySchema.parse({
      provider: "gemini",
      status: "ready",
      enabled: true,
      source: "custom",
      label: "Gemini",
    });

    expect(parsed.source).toBe("custom");
  });

  test("defaults missing enabled state in providers snapshot response entries", () => {
    const parsed = GetProvidersSnapshotResponseMessageSchema.parse({
      type: "get_providers_snapshot_response",
      payload: {
        entries: [
          {
            provider: "codex",
            status: "ready",
            label: "Codex",
          },
          {
            provider: "claude",
            status: "unavailable",
            enabled: false,
            label: "Claude",
          },
        ],
        generatedAt: "2026-04-24T00:00:00.000Z",
        requestId: "req-providers",
      },
    });

    expect(parsed.payload.entries.map((entry) => entry.enabled)).toEqual([true, false]);
  });

  test("defaults missing enabled state in providers snapshot update entries", () => {
    const parsed = ProvidersSnapshotUpdateMessageSchema.parse({
      type: "providers_snapshot_update",
      payload: {
        cwd: "/tmp/repo",
        entries: [
          {
            provider: "codex",
            status: "ready",
            label: "Codex",
          },
        ],
        generatedAt: "2026-04-24T00:00:00.000Z",
      },
    });

    expect(parsed.payload.entries[0]?.enabled).toBe(true);
  });
});

describe("Codex endpoint profile protocol", () => {
  test("keeps mutable config backward-compatible while endpoint RPC is write-only", () => {
    const config = MutableDaemonConfigSchema.parse({
      mcp: { injectIntoAgents: false },
      providers: {
        "gateway-codex": {
          enabled: true,
          additionalModels: [{ id: "gateway-model", label: "Gateway model" }],
          env: { OPENAI_API_KEY: "test-secret-must-not-roundtrip" },
          extends: "codex",
        },
      },
    });
    const patch = MutableDaemonConfigPatchSchema.parse({
      providers: {
        "gateway-codex": {
          env: { OPENAI_API_KEY: "test-secret-must-not-roundtrip" },
          label: "Gateway",
        },
      },
    });

    expect(config.providers["gateway-codex"]?.env).toEqual({
      OPENAI_API_KEY: "test-secret-must-not-roundtrip",
    });
    expect(patch.providers?.["gateway-codex"]?.env).toEqual({
      OPENAI_API_KEY: "test-secret-must-not-roundtrip",
    });
  });

  test("accepts a write-only endpoint API key and a redacted response", () => {
    const request = ProviderCodexEndpointSaveRequestSchema.parse({
      type: "provider.codex_endpoint.save.request",
      requestId: "req-codex-endpoint",
      profileId: "gateway-codex",
      label: "Gateway Codex",
      baseUrl: "https://gateway.example/v1",
      apiKey: "test-secret-must-not-roundtrip",
      models: [
        {
          id: "gateway-model",
          thinkingOptions: [{ id: "low" }, { id: "high" }],
        },
      ],
    });
    const response = ProviderCodexEndpointSaveResponseSchema.parse({
      type: "provider.codex_endpoint.save.response",
      payload: {
        requestId: request.requestId,
        profile: {
          id: request.profileId,
          label: request.label,
          baseUrl: request.baseUrl,
          models: [{ id: "gateway-model", label: "gateway-model", isDefault: true }],
          enabled: true,
          hasApiKey: true,
        },
      },
    });

    expect(JSON.stringify(response)).not.toContain("test-secret-must-not-roundtrip");
  });
});

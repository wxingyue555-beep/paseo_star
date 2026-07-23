import { describe, expect, it } from "vitest";
import { buildCodexEndpointProfile } from "./codex-endpoint-profile";

describe("buildCodexEndpointProfile", () => {
  it("builds an isolated Codex profile for an OpenAI-compatible endpoint", () => {
    expect(
      buildCodexEndpointProfile({
        name: "CCSwitch Work",
        baseUrl: "https://ccswitch.example.com/",
        apiKey: "test-key",
        modelId: "gpt-5.4",
        existingProviderIds: new Set(["codex"]),
      }),
    ).toEqual({
      providerId: "ccswitch-work",
      config: {
        extends: "codex",
        enabled: true,
        label: "CCSwitch Work",
        description: "Codex via CCSwitch Work",
        env: {
          OPENAI_BASE_URL: "https://ccswitch.example.com",
          OPENAI_API_KEY: "test-key",
        },
        models: [{ id: "gpt-5.4", label: "gpt-5.4", isDefault: true }],
      },
    });
  });

  it("returns field errors rather than making an invalid profile", () => {
    expect(
      buildCodexEndpointProfile({
        name: " ",
        baseUrl: "not-a-url",
        apiKey: " ",
        modelId: " ",
        existingProviderIds: new Set(),
      }),
    ).toEqual({
      errors: {
        name: "required",
        baseUrl: "invalid",
        apiKey: "required",
        modelId: "required",
      },
    });
  });

  it("chooses an unused provider id", () => {
    expect(
      buildCodexEndpointProfile({
        name: "CCSwitch",
        baseUrl: "https://ccswitch.example.com/v1",
        apiKey: "test-key",
        modelId: "gpt-5.4",
        existingProviderIds: new Set(["ccswitch", "ccswitch-2"]),
      }),
    ).toMatchObject({ providerId: "ccswitch-3" });
  });

  it("preserves an explicit disabled choice", () => {
    expect(
      buildCodexEndpointProfile({
        name: "CCSwitch",
        baseUrl: "https://ccswitch.example.com/v1",
        apiKey: "test-key",
        modelId: "gpt-5.4",
        enabled: false,
        existingProviderIds: new Set(),
      }),
    ).toMatchObject({ config: { enabled: false } });
  });
});

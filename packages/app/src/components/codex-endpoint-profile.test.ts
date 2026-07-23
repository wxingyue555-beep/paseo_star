import { describe, expect, it } from "vitest";
import { buildCodexEndpointProfile } from "./codex-endpoint-profile";
import { openCodexEndpointProfileForm } from "./codex-endpoint-profile-form-model";

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
      profileId: "ccswitch-work",
      label: "CCSwitch Work",
      baseUrl: "https://ccswitch.example.com",
      apiKey: "test-key",
      models: [{ id: "gpt-5.4", label: "gpt-5.4" }],
      enabled: true,
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
    ).toMatchObject({ profileId: "ccswitch-3" });
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
    ).toMatchObject({ enabled: false });
  });
});

describe("openCodexEndpointProfileForm", () => {
  it("starts with one editable manual model ID and no model presets", () => {
    const form = openCodexEndpointProfileForm({ existingProviderIds: new Set() });

    expect(form.getState()).toMatchObject({
      name: "",
      baseUrl: "",
      apiKey: "",
      modelId: "",
      enabled: true,
      errors: {},
      savedProvider: null,
    });
  });

  it("uses the manually entered model ID when preparing a profile", () => {
    const form = openCodexEndpointProfileForm({ existingProviderIds: new Set(["codex"]) });
    form.setName("CCSwitch Work");
    form.setBaseUrl("https://ccswitch.example.com/");
    form.setApiKey("test-key");
    form.setModelId("gpt-5.6-terra");

    expect(form.prepareSave()).toEqual({
      profileId: "ccswitch-work",
      label: "CCSwitch Work",
      baseUrl: "https://ccswitch.example.com",
      apiKey: "test-key",
      models: [{ id: "gpt-5.6-terra", label: "gpt-5.6-terra" }],
      enabled: true,
    });
  });

  it("keeps a disabled provider disabled in the saved state", () => {
    const form = openCodexEndpointProfileForm({ existingProviderIds: new Set() });
    form.setEnabled(false);
    form.markSaved({ id: "ccswitch", label: "CCSwitch", enabled: false });

    expect(form.getState().savedProvider).toEqual({
      id: "ccswitch",
      label: "CCSwitch",
      enabled: false,
    });
  });
});

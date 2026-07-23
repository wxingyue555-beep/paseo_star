import { describe, expect, it } from "vitest";
import { resolveInitialSelectorView } from "./combined-model-selector-state";

describe("resolveInitialSelectorView", () => {
  const providers = [
    { id: "codex", label: "Codex" },
    { id: "aimapi", label: "aimapi" },
  ];

  it("opens a draft at the provider list so the provider is selectable before its model", () => {
    expect(
      resolveInitialSelectorView({
        providers,
        selectedProvider: "codex",
        selectedModel: "gpt-5.4",
        favoriteKeys: new Set(),
        openAtProviderList: true,
      }),
    ).toEqual({ kind: "all" });
  });
});

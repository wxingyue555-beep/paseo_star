import { describe, expect, it } from "vitest";
import { buildGroupedModelRows, resolveInitialSelectorView } from "./combined-model-selector-state";

describe("resolveInitialSelectorView", () => {
  const providers = [
    { id: "codex", label: "Codex" },
    { id: "aimapi", label: "aimapi" },
  ];

  it("always opens the unified model list", () => {
    expect(
      resolveInitialSelectorView({
        providers,
        selectedProvider: "codex",
        selectedModel: "gpt-5.4",
        favoriteKeys: new Set(),
      }),
    ).toEqual({ kind: "all" });
  });

  it("groups matching models by provider and searches provider name, model name, and model ID", () => {
    expect(
      buildGroupedModelRows({
        providers: [
          {
            id: "codex",
            label: "Codex",
            modelSelection: {
              kind: "models",
              rows: [
                {
                  favoriteKey: "codex:gpt-5.4",
                  provider: "codex",
                  providerLabel: "Codex",
                  modelId: "gpt-5.4",
                  modelLabel: "GPT 5.4",
                },
              ],
            },
          },
          {
            id: "aimapi",
            label: "AIM API",
            modelSelection: {
              kind: "models",
              rows: [
                {
                  favoriteKey: "aimapi:gpt-5.6-terra",
                  provider: "aimapi",
                  providerLabel: "AIM API",
                  modelId: "gpt-5.6-terra",
                  modelLabel: "Terra",
                },
              ],
            },
          },
        ],
        normalizedQuery: "aim",
      }),
    ).toEqual([
      {
        provider: expect.objectContaining({ id: "aimapi", label: "AIM API" }),
        rows: [expect.objectContaining({ modelId: "gpt-5.6-terra" })],
      },
    ]);
  });
});

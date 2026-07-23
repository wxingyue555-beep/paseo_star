import type { ProviderSelectorProvider } from "@/provider-selection/provider-selection";
import {
  filterAndRankModelRows,
  getProviderModelRows,
  type ProviderSelectionModelRow,
} from "@/provider-selection/provider-selection";

export type SelectorInitialView =
  | { kind: "all" }
  | { kind: "provider"; providerId: string; providerLabel: string };

export interface GroupedModelRows {
  provider: ProviderSelectorProvider;
  rows: ProviderSelectionModelRow[];
}

export function resolveInitialSelectorView(_input: {
  providers: ReadonlyArray<Pick<ProviderSelectorProvider, "id" | "label">>;
  selectedProvider: string;
  selectedModel: string;
  favoriteKeys: ReadonlySet<string>;
}): SelectorInitialView {
  return { kind: "all" };
}

/**
 * The all-model view is the primary chooser. Each group preserves its provider
 * identity so a row press always produces an atomic provider + model selection.
 */
export function buildGroupedModelRows(input: {
  providers: ReadonlyArray<ProviderSelectorProvider>;
  normalizedQuery: string;
}): GroupedModelRows[] {
  return input.providers.flatMap((provider) => {
    const rows = filterAndRankModelRows(getProviderModelRows(provider), input.normalizedQuery);
    return rows.length > 0 ? [{ provider, rows }] : [];
  });
}

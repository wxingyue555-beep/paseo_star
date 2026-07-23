import type { ProviderSelectorProvider } from "@/provider-selection/provider-selection";

export type SelectorInitialView =
  | { kind: "all" }
  | { kind: "provider"; providerId: string; providerLabel: string };

export function resolveInitialSelectorView(input: {
  providers: ReadonlyArray<Pick<ProviderSelectorProvider, "id" | "label">>;
  selectedProvider: string;
  selectedModel: string;
  favoriteKeys: ReadonlySet<string>;
  openAtProviderList: boolean;
}): SelectorInitialView {
  const singleProvider = input.providers.length === 1 ? input.providers[0] : undefined;
  if (singleProvider) {
    return {
      kind: "provider",
      providerId: singleProvider.id,
      providerLabel: singleProvider.label,
    };
  }
  if (input.openAtProviderList) return { kind: "all" };

  const selectedFavoriteKey = `${input.selectedProvider}:${input.selectedModel}`;
  if (
    input.selectedProvider &&
    input.selectedModel &&
    !input.favoriteKeys.has(selectedFavoriteKey)
  ) {
    const provider = input.providers.find((entry) => entry.id === input.selectedProvider);
    if (provider) {
      return { kind: "provider", providerId: provider.id, providerLabel: provider.label };
    }
  }

  return { kind: "all" };
}

import {
  buildCodexEndpointProfile,
  type CodexEndpointProfileErrors,
  type CodexEndpointProfileResult,
} from "./codex-endpoint-profile";

export interface CodexEndpointProfileSavedProvider {
  id: string;
  label: string;
  enabled: boolean;
}

export interface CodexEndpointProfileFormState {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  reasoningEfforts: string;
  enabled: boolean;
  errors: CodexEndpointProfileErrors;
  saveError: string | null;
  saving: boolean;
  savedProvider: CodexEndpointProfileSavedProvider | null;
}

export interface CodexEndpointProfileFormModel {
  getState: () => CodexEndpointProfileFormState;
  subscribe: (listener: () => void) => () => void;
  close: () => void;
  applyExistingProviderIds: (providerIds: ReadonlySet<string>) => void;
  setName: (value: string) => void;
  setBaseUrl: (value: string) => void;
  setApiKey: (value: string) => void;
  setModelId: (value: string) => void;
  setReasoningEfforts: (value: string) => void;
  setEnabled: (value: boolean) => void;
  prepareSave: () => Exclude<
    CodexEndpointProfileResult,
    { errors: CodexEndpointProfileErrors }
  > | null;
  setSaving: (value: boolean) => void;
  setSaveError: (value: string | null) => void;
  markSaved: (provider: CodexEndpointProfileSavedProvider) => void;
}

export function openCodexEndpointProfileForm(input: {
  existingProviderIds: ReadonlySet<string>;
}): CodexEndpointProfileFormModel {
  const listeners = new Set<() => void>();
  let closed = false;
  let existingProviderIds = input.existingProviderIds;
  let state: CodexEndpointProfileFormState = {
    name: "",
    baseUrl: "",
    apiKey: "",
    modelId: "",
    reasoningEfforts: "",
    enabled: true,
    errors: {},
    saveError: null,
    saving: false,
    savedProvider: null,
  };

  function publish(nextState: CodexEndpointProfileFormState): void {
    if (closed) return;
    state = nextState;
    for (const listener of listeners) listener();
  }

  function updateField(
    field: "name" | "baseUrl" | "apiKey" | "modelId" | "reasoningEfforts" | "enabled",
    value: string | boolean,
  ): void {
    publish({
      ...state,
      [field]: value,
      errors: { ...state.errors, [field]: undefined },
      saveError: null,
    });
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => {
      closed = true;
      listeners.clear();
    },
    applyExistingProviderIds: (providerIds) => {
      existingProviderIds = providerIds;
    },
    setName: (value) => updateField("name", value),
    setBaseUrl: (value) => updateField("baseUrl", value),
    setApiKey: (value) => updateField("apiKey", value),
    setModelId: (value) => updateField("modelId", value),
    setReasoningEfforts: (value) => updateField("reasoningEfforts", value),
    setEnabled: (value) => updateField("enabled", value),
    prepareSave: () => {
      const result = buildCodexEndpointProfile({ ...state, existingProviderIds });
      if ("errors" in result) {
        publish({ ...state, errors: result.errors });
        return null;
      }
      return result;
    },
    setSaving: (value) => publish({ ...state, saving: value }),
    setSaveError: (value) => publish({ ...state, saveError: value }),
    markSaved: (provider) => publish({ ...state, savedProvider: provider, saving: false }),
  };
}

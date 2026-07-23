import { useEffect, useState } from "react";
import { openCodexEndpointProfileForm } from "./codex-endpoint-profile-form-model";

export function useCodexEndpointProfileForm(existingProviderIds: ReadonlySet<string>) {
  const [model] = useState(() => openCodexEndpointProfileForm({ existingProviderIds }));

  useEffect(() => {
    return () => model.close();
  }, [model]);

  useEffect(() => {
    model.applyExistingProviderIds(existingProviderIds);
  }, [existingProviderIds, model]);

  return model;
}

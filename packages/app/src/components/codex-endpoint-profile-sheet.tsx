import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AdaptiveModalSheet, type SheetHeader } from "@/components/adaptive-modal-sheet";
import { Field, FormTextInput } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { useDaemonConfig } from "@/hooks/use-daemon-config";
import { useProvidersSnapshot } from "@/hooks/use-providers-snapshot";
import {
  buildCodexEndpointProfile,
  type CodexEndpointProfileErrors,
} from "./codex-endpoint-profile";

interface CodexEndpointProfileSheetProps {
  serverId: string;
  visible: boolean;
  onClose: () => void;
}

const EMPTY_FORM = { name: "", baseUrl: "", apiKey: "", modelId: "", enabled: true };

function errorMessage(
  errors: CodexEndpointProfileErrors,
  field: keyof CodexEndpointProfileErrors,
  t: ReturnType<typeof useTranslation>["t"],
): string | undefined {
  const error = errors[field];
  if (!error) return undefined;
  return error === "invalid"
    ? t("settings.providers.codexEndpoint.invalidBaseUrl")
    : t("settings.providers.codexEndpoint.required");
}

export function CodexEndpointProfileSheet({
  serverId,
  visible,
  onClose,
}: CodexEndpointProfileSheetProps) {
  const { t } = useTranslation();
  const { entries, refresh } = useProvidersSnapshot(serverId);
  const { patchConfig } = useDaemonConfig(serverId);
  const modelPresetOptions = useMemo<SelectFieldOption<string>[]>(
    () => [
      { id: "gpt-5.4", value: "gpt-5.4", label: "gpt-5.4" },
      { id: "gpt-5.3-codex", value: "gpt-5.3-codex", label: "gpt-5.3-codex" },
      { id: "gpt-5.2-codex", value: "gpt-5.2-codex", label: "gpt-5.2-codex" },
      { id: "custom", value: "", label: t("settings.providers.codexEndpoint.customModel") },
    ],
    [t],
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<CodexEndpointProfileErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedProvider, setSavedProvider] = useState<{ id: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm(EMPTY_FORM);
    setErrors({});
    setSaveError(null);
    setSavedProvider(null);
    setSaving(false);
  }, [visible]);

  const updateField = useCallback(
    <K extends keyof typeof EMPTY_FORM>(field: K, value: (typeof EMPTY_FORM)[K]) => {
      setForm((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setSaveError(null);
    },
    [],
  );
  const handleNameChange = useCallback(
    (value: string) => updateField("name", value),
    [updateField],
  );
  const handleBaseUrlChange = useCallback(
    (value: string) => updateField("baseUrl", value),
    [updateField],
  );
  const handleApiKeyChange = useCallback(
    (value: string) => updateField("apiKey", value),
    [updateField],
  );
  const handleModelIdChange = useCallback(
    (value: string) => updateField("modelId", value),
    [updateField],
  );
  const handleEnabledChange = useCallback(
    (value: boolean) => updateField("enabled", value),
    [updateField],
  );
  const handleModelPresetChange = useCallback(
    (value: string) => {
      if (value) updateField("modelId", value);
    },
    [updateField],
  );

  const handleSave = useCallback(() => {
    if (saving) return;
    const result = buildCodexEndpointProfile({
      ...form,
      existingProviderIds: new Set(entries?.map((entry) => entry.provider) ?? []),
    });
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }

    setSaving(true);
    void patchConfig({ providers: { [result.providerId]: result.config } })
      .then(() => refresh([result.providerId]))
      .then(() =>
        setSavedProvider({
          id: result.providerId,
          label: result.config.label ?? result.providerId,
        }),
      )
      .catch((error) => {
        setSaveError(error instanceof Error ? error.message : t("common.errors.unableToSave"));
      })
      .finally(() => setSaving(false));
  }, [entries, form, patchConfig, refresh, saving, t]);

  const header = useMemo<SheetHeader>(
    () => ({ title: t("settings.providers.codexEndpoint.title") }),
    [t],
  );
  const selectedModelPresetDisplay = useMemo(() => {
    const preset = modelPresetOptions.find((option) => option.value === form.modelId);
    return {
      label: preset
        ? form.modelId || t("settings.providers.codexEndpoint.customModel")
        : t("settings.providers.codexEndpoint.customModel"),
    };
  }, [form.modelId, modelPresetOptions, t]);

  return (
    <AdaptiveModalSheet
      header={header}
      visible={visible}
      onClose={onClose}
      desktopMaxWidth={480}
      testID="codex-endpoint-profile-sheet"
    >
      <View style={styles.body}>
        {savedProvider ? (
          <>
            <Text style={styles.success}>
              {t("settings.providers.codexEndpoint.saved", { name: savedProvider.label })}
            </Text>
            <Text style={styles.description}>
              {t("settings.providers.codexEndpoint.selectInComposer", {
                name: savedProvider.label,
              })}
            </Text>
            <View style={styles.actions}>
              <Button
                variant="default"
                size="sm"
                onPress={onClose}
                testID="codex-endpoint-profile-done"
              >
                {t("common.actions.done")}
              </Button>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.description}>
              {t("settings.providers.codexEndpoint.description")}
            </Text>
            <Field
              label={t("settings.providers.codexEndpoint.name")}
              error={errorMessage(errors, "name", t)}
            >
              <FormTextInput
                value={form.name}
                onChangeText={handleNameChange}
                placeholder={t("settings.providers.codexEndpoint.namePlaceholder")}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!saving}
                testID="codex-endpoint-profile-name"
              />
            </Field>
            <Field
              label={t("settings.providers.codexEndpoint.baseUrl")}
              error={errorMessage(errors, "baseUrl", t)}
            >
              <FormTextInput
                value={form.baseUrl}
                onChangeText={handleBaseUrlChange}
                placeholder={t("settings.providers.codexEndpoint.baseUrlPlaceholder")}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!saving}
                testID="codex-endpoint-profile-base-url"
              />
            </Field>
            <Field
              label={t("settings.providers.codexEndpoint.apiKey")}
              error={errorMessage(errors, "apiKey", t)}
            >
              <FormTextInput
                value={form.apiKey}
                onChangeText={handleApiKeyChange}
                placeholder={t("settings.providers.codexEndpoint.apiKeyPlaceholder")}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                editable={!saving}
                testID="codex-endpoint-profile-api-key"
              />
            </Field>
            <SelectField
              label={t("settings.providers.codexEndpoint.modelPreset")}
              value={
                modelPresetOptions.some((option) => option.value === form.modelId)
                  ? form.modelId
                  : ""
              }
              selectedDisplay={selectedModelPresetDisplay}
              options={modelPresetOptions}
              onChange={handleModelPresetChange}
              placeholder={t("settings.providers.codexEndpoint.modelPreset")}
              emptyText={t("settings.providers.codexEndpoint.noModels")}
              disabled={saving}
              searchable
              title={t("settings.providers.codexEndpoint.modelPreset")}
              triggerTestID="codex-endpoint-profile-model-preset"
            />
            <Field
              label={t("settings.providers.codexEndpoint.modelId")}
              error={errorMessage(errors, "modelId", t)}
            >
              <FormTextInput
                value={form.modelId}
                onChangeText={handleModelIdChange}
                placeholder={t("settings.providers.codexEndpoint.modelIdPlaceholder")}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
                onSubmitEditing={handleSave}
                testID="codex-endpoint-profile-model-id"
              />
            </Field>
            <View style={styles.enabledRow}>
              <View style={styles.enabledCopy}>
                <Text style={styles.enabledLabel}>
                  {t("settings.providers.codexEndpoint.enable")}
                </Text>
                <Text style={styles.enabledDescription}>
                  {t("settings.providers.codexEndpoint.enableDescription")}
                </Text>
              </View>
              <Switch
                value={form.enabled}
                onValueChange={handleEnabledChange}
                disabled={saving}
                accessibilityLabel={t("settings.providers.codexEndpoint.enable")}
                testID="codex-endpoint-profile-enabled"
              />
            </View>
            {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
            <View style={styles.actions}>
              <Button variant="secondary" size="sm" onPress={onClose} disabled={saving}>
                {t("common.actions.cancel")}
              </Button>
              <Button
                variant="default"
                size="sm"
                onPress={handleSave}
                disabled={saving}
                testID="codex-endpoint-profile-save"
              >
                {saving
                  ? t("settings.providers.codexEndpoint.saving")
                  : t("settings.providers.codexEndpoint.save")}
              </Button>
            </View>
          </>
        )}
      </View>
    </AdaptiveModalSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing[3],
    paddingBottom: theme.spacing[2],
  },
  description: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    lineHeight: Math.round(theme.fontSize.sm * 1.4),
  },
  error: {
    color: theme.colors.palette.red[300],
    fontSize: theme.fontSize.sm,
  },
  success: {
    color: theme.colors.statusSuccess,
    fontSize: theme.fontSize.sm,
  },
  enabledRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing[3],
  },
  enabledCopy: {
    flex: 1,
    gap: theme.spacing[1],
  },
  enabledLabel: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
  },
  enabledDescription: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing[2],
  },
}));

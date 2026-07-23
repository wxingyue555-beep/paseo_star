import { useCallback, useMemo, useSyncExternalStore, type ReactElement } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AdaptiveModalSheet, type SheetHeader } from "@/components/adaptive-modal-sheet";
import { Field, FormTextInput } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useProvidersSnapshot } from "@/hooks/use-providers-snapshot";
import { useHostRuntimeClient } from "@/runtime/host-runtime";
import type { CodexEndpointProfileErrors } from "./codex-endpoint-profile";
import { useCodexEndpointProfileForm } from "./use-codex-endpoint-profile-form";

interface CodexEndpointProfileSheetProps {
  serverId: string;
  visible: boolean;
  onClose: () => void;
}

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
}: CodexEndpointProfileSheetProps): ReactElement | null {
  if (!visible) return null;

  return <CodexEndpointProfileSheetContent key={serverId} serverId={serverId} onClose={onClose} />;
}

function CodexEndpointProfileSheetContent({
  serverId,
  onClose,
}: Omit<CodexEndpointProfileSheetProps, "visible">) {
  const { t } = useTranslation();
  const { entries, refresh } = useProvidersSnapshot(serverId);
  const client = useHostRuntimeClient(serverId);
  const existingProviderIds = new Set(entries?.map((entry) => entry.provider) ?? []);
  const model = useCodexEndpointProfileForm(existingProviderIds);
  const form = useSyncExternalStore(model.subscribe, model.getState, model.getState);

  const handleSave = useCallback(() => {
    if (form.saving) return;
    const result = model.prepareSave();
    if (!result) return;

    if (!client) {
      model.setSaveError(t("workspace.terminal.hostDisconnected"));
      return;
    }

    model.setSaving(true);
    void client
      .saveCodexEndpointProfile(result)
      .then(() => refresh([result.profileId]))
      .then(() =>
        model.markSaved({
          id: result.profileId,
          label: result.label,
          enabled: result.enabled,
        }),
      )
      .catch((error) => {
        model.setSaveError(
          error instanceof Error ? error.message : t("common.errors.unableToSave"),
        );
      })
      .finally(() => model.setSaving(false));
  }, [client, form.saving, model, refresh, t]);

  const header = useMemo<SheetHeader>(
    () => ({ title: t("settings.providers.codexEndpoint.title") }),
    [t],
  );
  return (
    <AdaptiveModalSheet
      header={header}
      visible
      onClose={onClose}
      desktopMaxWidth={480}
      testID="codex-endpoint-profile-sheet"
    >
      <View style={styles.body}>
        {form.savedProvider ? (
          <>
            <Text style={styles.success}>
              {t(
                form.savedProvider.enabled
                  ? "settings.providers.codexEndpoint.savedEnabled"
                  : "settings.providers.codexEndpoint.savedDisabled",
                { name: form.savedProvider.label },
              )}
            </Text>
            <Text style={styles.description}>
              {t("settings.providers.codexEndpoint.selectInComposer", {
                name: form.savedProvider.label,
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
              error={errorMessage(form.errors, "name", t)}
            >
              <FormTextInput
                value={form.name}
                onChangeText={model.setName}
                placeholder={t("settings.providers.codexEndpoint.namePlaceholder")}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!form.saving}
                testID="codex-endpoint-profile-name"
              />
            </Field>
            <Field
              label={t("settings.providers.codexEndpoint.baseUrl")}
              error={errorMessage(form.errors, "baseUrl", t)}
            >
              <FormTextInput
                value={form.baseUrl}
                onChangeText={model.setBaseUrl}
                placeholder={t("settings.providers.codexEndpoint.baseUrlPlaceholder")}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!form.saving}
                testID="codex-endpoint-profile-base-url"
              />
            </Field>
            <Field
              label={t("settings.providers.codexEndpoint.apiKey")}
              error={errorMessage(form.errors, "apiKey", t)}
            >
              <FormTextInput
                value={form.apiKey}
                onChangeText={model.setApiKey}
                placeholder={t("settings.providers.codexEndpoint.apiKeyPlaceholder")}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                editable={!form.saving}
                testID="codex-endpoint-profile-api-key"
              />
            </Field>
            <Field
              label={t("settings.providers.codexEndpoint.modelId")}
              error={errorMessage(form.errors, "modelId", t)}
            >
              <FormTextInput
                value={form.modelId}
                onChangeText={model.setModelId}
                placeholder={t("settings.providers.codexEndpoint.modelIdPlaceholder")}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!form.saving}
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
                onValueChange={model.setEnabled}
                disabled={form.saving}
                accessibilityLabel={t("settings.providers.codexEndpoint.enable")}
                testID="codex-endpoint-profile-enabled"
              />
            </View>
            {form.saveError ? <Text style={styles.error}>{form.saveError}</Text> : null}
            <View style={styles.actions}>
              <Button variant="secondary" size="sm" onPress={onClose} disabled={form.saving}>
                {t("common.actions.cancel")}
              </Button>
              <Button
                variant="default"
                size="sm"
                onPress={handleSave}
                disabled={form.saving}
                testID="codex-endpoint-profile-save"
              >
                {form.saving
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

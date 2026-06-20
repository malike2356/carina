import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import {
  loadVoiceWakeSettings,
  saveVoiceWakeEnabled,
  type VoiceWakeSettings,
} from '@/lib/voice-wake-settings';
import { colors, radii, spacing } from '@/theme/tokens';

export default function VoiceSettingsScreen() {
  const [settings, setSettings] = useState<VoiceWakeSettings | null>(null);

  useEffect(() => {
    void loadVoiceWakeSettings().then(setSettings);
  }, []);

  async function toggleEnabled(value: boolean) {
    setSettings((prev) => (prev ? { ...prev, enabled: value } : prev));
    await saveVoiceWakeEnabled(value);
  }

  if (!settings) {
    return (
      <ScreenShell title="Voice" subtitle="Loading voice wake settings...">
        <Text style={styles.meta}>Loading...</Text>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Voice" subtitle="Hands-free wake word and privacy hours.">
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Wake phrase ("Hey Carina")</Text>
          <Switch
            value={settings.enabled}
            onValueChange={(next) => void toggleEnabled(next)}
            trackColor={{ false: colors.inkLift, true: colors.teal }}
            thumbColor={colors.white}
          />
        </View>
        <Text style={styles.hint}>
          Carina passively listens for your wake phrase. Audio is processed on-device only.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Privacy hours</Text>
        <Text style={styles.hint}>
          {settings.privacyStart}:00 - {settings.privacyEnd}:00 (wake listening paused overnight)
        </Text>
        <Text style={styles.meta}>Wake detections: {settings.wakeCount}</Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.inkMid,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    color: colors.white,
    fontSize: 15,
    flex: 1,
  },
  sectionLabel: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  hint: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    color: colors.silverMid,
    fontSize: 13,
  },
});

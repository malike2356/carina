import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import { useNativeCapabilities } from '@/hooks/useNativeCapabilities';
import { useRelaySettings } from '@/hooks/useRelaySettings';
import { colors, radii, spacing } from '@/theme/tokens';

function SettingRow({
  title,
  description,
  value,
  disabled,
  onToggle,
}: {
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.value}>{title}</Text>
        <Text style={styles.meta}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(next) => void onToggle(next)}
        disabled={disabled}
        trackColor={{ false: colors.inkLift, true: colors.teal }}
        thumbColor={colors.white}
      />
    </View>
  );
}

export default function PrivacyRelayScreen() {
  const native = useNativeCapabilities();
  const {
    prefs,
    loading,
    permissionDenied,
    toggleSms,
    toggleCall,
    toggleNotification,
    setAllowedSenders,
    setPrivacyHours,
  } = useRelaySettings();
  const [senderInput, setSenderInput] = useState('');

  if (loading || !prefs) {
    return (
      <ScreenShell title="Message relay" subtitle="Loading privacy settings...">
        <ActivityIndicator color={colors.tealLight} />
      </ScreenShell>
    );
  }

  const relayAvailable = !native.expoGo;

  function addSender() {
    if (!prefs) return;
    const trimmed = senderInput.trim();
    if (!trimmed) return;
    const next = Array.from(new Set([...prefs.allowedSenders, trimmed]));
    void setAllowedSenders(next);
    setSenderInput('');
  }

  return (
    <ScreenShell
      title="Message relay"
      subtitle="Opt-in relay from your device to Carina. Sensitive content is redacted before send."
    >
      {!relayAvailable ? (
        <View style={styles.card}>
          <Text style={styles.meta}>
            Message relay needs an EAS development or store build. Expo Go cannot access SMS,
            call log, or notification extensions.
          </Text>
        </View>
      ) : null}

      {permissionDenied ? (
        <View style={styles.card}>
          <Text style={styles.warning}>
            Android denied SMS or call log permissions. Relay stays off until you grant them in
            system settings.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Relay toggles</Text>
        {Platform.OS === 'android' ? (
          <>
            <SettingRow
              title="SMS relay"
              description="Forward incoming SMS messages to Carina."
              value={prefs.smsEnabled}
              disabled={!relayAvailable}
              onToggle={(next) => void toggleSms(next)}
            />
            <SettingRow
              title="Missed call alerts"
              description="Notify Carina when you miss a call (checked every 30 minutes)."
              value={prefs.callEnabled}
              disabled={!relayAvailable}
              onToggle={(next) => void toggleCall(next)}
            />
          </>
        ) : null}
        <SettingRow
          title="Notification relay"
          description={
            Platform.OS === 'ios'
              ? 'Forward app notifications via the notification service extension.'
              : 'Forward app notifications to Carina when supported.'
          }
          value={prefs.notificationEnabled}
          disabled={!relayAvailable}
          onToggle={(next) => void toggleNotification(next)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Privacy hours</Text>
        <Text style={styles.meta}>
          Only relay between {String(prefs.privacyStartHour).padStart(2, '0')}:00 and{' '}
          {String(prefs.privacyEndHour).padStart(2, '0')}:00. Messages outside these hours are
          not forwarded.
        </Text>
        <View style={styles.hourRow}>
          <Pressable
            style={styles.hourButton}
            onPress={() => void setPrivacyHours(7, prefs.privacyEndHour)}
          >
            <Text style={styles.hourButtonText}>Day start 07:00</Text>
          </Pressable>
          <Pressable
            style={styles.hourButton}
            onPress={() => void setPrivacyHours(prefs.privacyStartHour, 22)}
          >
            <Text style={styles.hourButtonText}>Day end 22:00</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Allowed senders</Text>
        <Text style={styles.meta}>
          Only messages from these contacts or sources are forwarded. Leave empty to block all
          relay.
        </Text>
        <View style={styles.senderRow}>
          <TextInput
            style={styles.input}
            value={senderInput}
            onChangeText={setSenderInput}
            placeholder="+447..."
            placeholderTextColor={colors.silverMid}
            autoCapitalize="none"
          />
          <Pressable style={styles.addButton} onPress={addSender}>
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>
        {prefs.allowedSenders.length === 0 ? (
          <Text style={styles.meta}>No allowed senders configured.</Text>
        ) : (
          prefs.allowedSenders.map((sender) => (
            <Pressable
              key={sender}
              style={styles.senderChip}
              onPress={() =>
                void setAllowedSenders(prefs.allowedSenders.filter((item) => item !== sender))
              }
            >
              <Text style={styles.senderChipText}>{sender}</Text>
              <Text style={styles.senderChipRemove}>Remove</Text>
            </Pressable>
          ))
        )}
        <Pressable
          style={styles.linkRow}
          onPress={() => void setAllowedSenders(['ALL'])}
        >
          <Text style={styles.linkText}>Allow all senders (explicit opt-in)</Text>
        </Pressable>
      </View>

      <Pressable style={styles.backRow} onPress={() => router.back()}>
        <Text style={styles.linkText}>Back to More</Text>
      </Pressable>
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
  },
  label: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  value: {
    color: colors.white,
    fontSize: 15,
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  warning: {
    color: colors.amber,
    fontSize: 13,
    lineHeight: 18,
  },
  hourRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hourButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  hourButtonText: {
    color: colors.tealLight,
    fontSize: 13,
    textAlign: 'center',
  },
  senderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.white,
  },
  addButton: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  senderChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  senderChipText: {
    color: colors.white,
  },
  senderChipRemove: {
    color: colors.tealLight,
    fontSize: 12,
  },
  linkRow: {
    paddingTop: spacing.xs,
  },
  linkText: {
    color: colors.tealLight,
    fontSize: 14,
    fontWeight: '600',
  },
  backRow: {
    marginTop: spacing.md,
  },
});

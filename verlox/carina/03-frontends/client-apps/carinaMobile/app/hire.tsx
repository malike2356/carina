import { router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AivaApiError, createAivaWorker } from '@/api/aiva-client';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

const CHANNEL_OPTIONS = ['email', 'telegram', 'slack', 'whatsapp', 'web'] as const;

function HireBody() {
  const { instance, gatewayAuth } = useAuth();
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [channels, setChannels] = useState<string[]>(['email']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleChannel = useCallback((id: string) => {
    setChannels((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const submit = useCallback(async () => {
    if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
      setError('Sign in to Carina Cloud before hiring.');
      return;
    }
    const name = roleName.trim();
    const description = roleDescription.trim();
    if (!name || !description) {
      setError('Name and role description are required.');
      return;
    }
    if (channels.length === 0) {
      setError('Select at least one channel.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const worker = await createAivaWorker(
        instance.baseUrl,
        {
          roleName: name,
          roleDescription: description,
          channels,
        },
        gatewayAuth,
      );
      router.replace(`/employee/${worker.id}` as Href);
    } catch (err) {
      if (err instanceof AivaApiError && err.status === 402) {
        setError(
          'You have reached your Aiva employee limit. Open Usage and billing to upgrade.',
        );
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  }, [channels, gatewayAuth, instance?.baseUrl, roleDescription, roleName]);

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Employee name</Text>
      <TextInput
        style={styles.input}
        value={roleName}
        onChangeText={setRoleName}
        placeholder="e.g. Front desk"
        placeholderTextColor={colors.silverMid}
        autoCapitalize="words"
        editable={!busy}
      />

      <Text style={styles.label}>Role description</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={roleDescription}
        onChangeText={setRoleDescription}
        placeholder="What should this employee handle?"
        placeholderTextColor={colors.silverMid}
        multiline
        textAlignVertical="top"
        editable={!busy}
      />

      <Text style={styles.label}>Channels</Text>
      <View style={styles.chips}>
        {CHANNEL_OPTIONS.map((channel) => {
          const selected = channels.includes(channel);
          return (
            <Pressable
              key={channel}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleChannel(channel)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {channel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.submit, busy && styles.submitDisabled]}
        onPress={() => void submit()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Create employee"
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitText}>Create employee</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function HireScreen() {
  return (
    <ScreenShell title="Hire" subtitle="Create an AI employee." showBack scroll>
      <CloudFeatureGate feature="aiva">
        <HireBody />
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  label: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.white,
    backgroundColor: colors.inkMid,
    fontSize: 15,
  },
  textarea: {
    minHeight: 110,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  chipText: {
    color: colors.silver,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  chipTextSelected: {
    color: colors.white,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  submit: {
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});

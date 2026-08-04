import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { CarinaClient } from '@/api/carina-client';
import { ScreenShell } from '@/components/ScreenShell';
import { DEFAULT_CLOUD_URL } from '@/config/defaults';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { instance } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [emailDisabled, setEmailDisabled] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setDone(false);
    setEmailDisabled(false);
    try {
      const trimmed = email.trim();
      if (!trimmed.includes('@')) {
        throw new Error('Enter a valid email address.');
      }
      const baseUrl = instance?.baseUrl || DEFAULT_CLOUD_URL;
      const client = new CarinaClient({
        baseUrl,
        credentials: 'omit',
      });
      const result = await client.forgotPassword(trimmed);
      if (result.emailDisabled) {
        setEmailDisabled(true);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenShell
      title="Reset password"
      subtitle="We will email a reset link if that address has a Carina Cloud account."
      showBack
      onBack={() => router.replace('/(auth)/login')}
    >
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={colors.silverMid}
        editable={!loading}
        autoComplete="email"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {done ? (
        <Text style={styles.success}>
          {emailDisabled
            ? 'Password reset email is not configured on this server yet. Sign in on the web or contact support.'
            : 'If an account exists for that email, a reset link is on its way. Open it on this device or the web, then sign in here.'}
        </Text>
      ) : null}
      <Pressable
        style={[styles.primaryBtn, loading && styles.disabled]}
        onPress={() => void handleSubmit()}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Send reset link"
      >
        <Text style={styles.primaryBtnText}>
          {loading ? 'Sending...' : 'Send reset link'}
        </Text>
      </Pressable>
      <Pressable
        style={styles.linkBtn}
        onPress={() => router.replace('/(auth)/login')}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Back to sign in"
      >
        <Text style={styles.linkText}>Back to sign in</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.white,
    fontSize: 15,
    minHeight: 44,
  },
  primaryBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '600',
  },
  linkBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  linkText: {
    color: colors.tealLight,
    fontSize: 14,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  success: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
});

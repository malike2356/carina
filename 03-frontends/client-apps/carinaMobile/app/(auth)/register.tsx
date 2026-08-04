import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CarinaClient } from '@/api/carina-client';
import { ScreenShell } from '@/components/ScreenShell';
import { DEFAULT_CLOUD_URL } from '@/config/defaults';
import { useAuth } from '@/store/auth-store';
import { setInstanceMode } from '@/store/instance-store';
import { colors, radii, spacing } from '@/theme/tokens';

const MIN_PASSWORD = 10;

export default function RegisterScreen() {
  const router = useRouter();
  const { refresh, instance } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);
    setError(null);
    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail.includes('@')) {
        throw new Error('Enter a valid email address.');
      }
      if (password.length < MIN_PASSWORD) {
        throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
      }
      if (password !== confirm) {
        throw new Error('Passwords do not match.');
      }

      const baseUrl =
        instance?.mode === 'cloud' && instance.baseUrl
          ? instance.baseUrl
          : DEFAULT_CLOUD_URL;
      if (!instance?.baseUrl || instance.mode !== 'cloud') {
        await setInstanceMode('cloud', DEFAULT_CLOUD_URL);
      }

      const client = new CarinaClient({
        baseUrl,
        credentials: 'omit',
      });
      const result = await client.register(
        trimmedEmail,
        password,
        name.trim() || undefined,
      );
      if (!result.token) {
        throw new Error('Account created, but sign-in token was missing. Try signing in.');
      }

      const { saveCloudSessionToken } = await import('@/store/cloud-session-store');
      await saveCloudSessionToken(baseUrl, result.token);

      const authed = new CarinaClient({
        baseUrl,
        credentials: 'omit',
        apiKey: result.token,
      });
      const ctx = await authed.hostedContext();
      if (!ctx.user) {
        throw new Error('Account created, but session could not be loaded. Try signing in.');
      }

      await refresh();
      router.replace('/(tabs)/employees' as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenShell
      title="Create account"
      subtitle="Register for Carina Cloud / Aiva with email and password. Same account works on the web."
      showBack
      onBack={() => router.replace('/(auth)/login')}
    >
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        placeholder="Name (optional)"
        placeholderTextColor={colors.silverMid}
        editable={!loading}
      />
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
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder={`Password (min ${MIN_PASSWORD} characters)`}
        placeholderTextColor={colors.silverMid}
        editable={!loading}
        autoComplete="new-password"
      />
      <TextInput
        style={styles.input}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        placeholder="Confirm password"
        placeholderTextColor={colors.silverMid}
        editable={!loading}
        autoComplete="new-password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.primaryBtn, loading && styles.disabled]}
        onPress={() => void handleRegister()}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Create account"
      >
        <Text style={styles.primaryBtnText}>
          {loading ? 'Creating account...' : 'Create account'}
        </Text>
      </Pressable>
      <Pressable
        style={styles.linkBtn}
        onPress={() => router.replace('/(auth)/login')}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Already have an account? Sign in"
      >
        <Text style={styles.linkText}>Already have an account? Sign in</Text>
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
});

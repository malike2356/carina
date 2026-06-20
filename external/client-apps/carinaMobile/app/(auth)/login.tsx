import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CarinaClient } from '@/api/carina-client';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { refresh, instance } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = instance?.baseUrl;
      if (!baseUrl) {
        throw new Error('Carina Cloud gateway is not configured');
      }
      const client = new CarinaClient({
        baseUrl,
        credentials: 'include',
      });
      await client.login(email.trim(), password);
      await refresh();
      router.replace('/(tabs)/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenShell title="Sign in to Carina Cloud" subtitle="Same agent as web and CLI.">
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={colors.silverMid}
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor={colors.silverMid}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.primaryBtn, loading && styles.disabled]}
        onPress={() => void handleLogin()}
        disabled={loading}
      >
        <Text style={styles.primaryBtnText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
      </Pressable>
      <View style={styles.hint}>
        <Text style={styles.hintText}>Self-hosted? Go back and choose a gateway URL instead.</Text>
      </View>
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
  },
  primaryBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  hint: {
    marginTop: spacing.sm,
  },
  hintText: {
    color: colors.silverMid,
    fontSize: 13,
  },
});

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CarinaClient } from '@/api/carina-client';
import { ScreenShell } from '@/components/ScreenShell';
import { SESSION_EXPIRED_MESSAGE } from '@/lib/auth-messages';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { expired } = useLocalSearchParams<{ expired?: string }>();
  const { refresh, instance, cloudSessionExpired } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showExpiredBanner = expired === '1' || cloudSessionExpired;

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
        credentials: 'omit',
      });
      const loginResult = await client.login(email.trim(), password);
      if (loginResult.token) {
        const { saveCloudSessionToken } = await import('@/store/cloud-session-store');
        await saveCloudSessionToken(baseUrl, loginResult.token);
      }
      const authed = new CarinaClient({
        baseUrl,
        credentials: 'omit',
        apiKey: loginResult.token,
      });
      const ctx = await authed.hostedContext();
      if (!ctx.user) {
        throw new Error('Sign in failed. Check your email and password.');
      }
      await refresh();
      router.replace('/(tabs)/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenShell
      title="Sign in to Carina Cloud"
      subtitle="Scan a login QR from the web (easiest), or use the same email and password as the web workspace."
    >
      {showExpiredBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{SESSION_EXPIRED_MESSAGE}</Text>
        </View>
      ) : null}

      <Pressable
        style={styles.scanBtn}
        onPress={() => router.push('/(auth)/login-scan' as Href)}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Scan to sign in"
      >
        <Text style={styles.scanBtnText}>Scan to sign in</Text>
        <Text style={styles.scanMeta}>
          Open Settings → Device pairing on the web while signed in, then scan that QR.
        </Text>
      </Pressable>

      <Text style={styles.or}>Or sign in with email</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={colors.silverMid}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor={colors.silverMid}
        editable={!loading}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.primaryBtn, loading && styles.disabled]}
        onPress={() => void handleLogin()}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Sign in to Carina Cloud"
      >
        <Text style={styles.primaryBtnText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryBtn}
        onPress={() => router.replace('/(auth)/onboarding')}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Change gateway or use self-hosted"
      >
        <Text style={styles.secondaryBtnText}>Use a different gateway</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  bannerText: {
    color: colors.amber,
    fontSize: 13,
    lineHeight: 18,
  },
  scanBtn: {
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: 'rgba(26, 95, 122, 0.18)',
    gap: spacing.xs,
  },
  scanBtnText: {
    color: colors.tealLight,
    fontSize: 16,
    fontWeight: '700',
  },
  scanMeta: {
    color: colors.silver,
    fontSize: 12,
    lineHeight: 17,
  },
  or: {
    color: colors.silverMid,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
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
  secondaryBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  secondaryBtnText: {
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

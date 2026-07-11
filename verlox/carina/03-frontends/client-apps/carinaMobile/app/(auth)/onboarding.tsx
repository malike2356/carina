import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AGENT_MODE, DEFAULT_CLOUD_URL } from '@/config/defaults';
import { ScreenShell } from '@/components/ScreenShell';
import { authFromInstance } from '@/lib/gateway-auth';
import { testGatewayConnection } from '@/lib/connection-test';
import { isValidGatewayUrl, normalizeGatewayUrl } from '@/lib/url-utils';
import { saveApiKey } from '@/store/api-key-store';
import { useAuth } from '@/store/auth-store';
import { setInstanceMode } from '@/store/instance-store';
import { colors, radii, spacing } from '@/theme/tokens';

type Step = 'welcome' | 'instance';

export default function OnboardingScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [selfHostedUrl, setSelfHostedUrl] = useState('http://192.168.1.10:3000');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startScanLogin() {
    await setInstanceMode('cloud', DEFAULT_CLOUD_URL);
    await refresh();
    router.replace('/(auth)/login-scan' as Href);
  }

  async function connectCloudEmail() {
    await setInstanceMode('cloud', DEFAULT_CLOUD_URL);
    await refresh();
    router.replace('/(auth)/login');
  }

  async function connectSelfHosted() {
    setError(null);
    const url = normalizeGatewayUrl(selfHostedUrl);
    if (!isValidGatewayUrl(url)) {
      setError('Enter a valid http or https gateway URL. Use your LAN IP; localhost will not work on a physical device.');
      return;
    }

    setTesting(true);
    const auth = authFromInstance('self-hosted', apiKey.trim() || null);
    const result = await testGatewayConnection(url, auth);
    setTesting(false);

    if (result.status === 'offline') {
      setError(result.message);
      return;
    }

    if (apiKey.trim()) {
      await saveApiKey(url, apiKey.trim());
    }

    await setInstanceMode('self-hosted', url);
    await refresh();
    router.replace('/(tabs)/chat');
  }

  if (step === 'welcome') {
    return (
      <ScreenShell
        title="The autonomous agent that proves its security"
        subtitle={`General-purpose mode (${AGENT_MODE}). Vertical property workflows live in Propreneur.`}
      >
        <Pressable
          style={styles.primaryBtn}
          onPress={() => void startScanLogin()}
          accessibilityRole="button"
          accessibilityLabel="Scan to sign in"
        >
          <Text style={styles.primaryBtnText}>Scan to sign in</Text>
          <Text style={styles.primaryBtnMeta}>
            Fastest: scan the login QR from Settings → Device pairing on the web.
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => setStep('instance')}>
          <Text style={styles.secondaryBtnText}>Other options</Text>
        </Pressable>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Connect your agent"
      subtitle="Scan a web login QR, use email for Carina Cloud, or connect a self-hosted gateway."
      showBack
      onBack={() => setStep('welcome')}
    >
      <Pressable
        style={styles.primaryBtn}
        onPress={() => void startScanLogin()}
        accessibilityRole="button"
        accessibilityLabel="Scan to sign in with Carina Cloud"
      >
        <Text style={styles.primaryBtnText}>Scan to sign in</Text>
        <Text style={styles.primaryBtnMeta}>Carina Cloud · no password on the phone</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => void connectCloudEmail()}>
        <Text style={styles.secondaryBtnText}>Sign in with email</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Self-hosted URL</Text>
        <Text style={styles.hint}>Use your machine LAN IP so the phone can reach the gateway.</Text>
        <TextInput
          style={styles.input}
          value={selfHostedUrl}
          onChangeText={setSelfHostedUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.10:3000"
          placeholderTextColor={colors.silverMid}
        />
        <Text style={styles.cardTitle}>API key (optional)</Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="Bearer token if required"
          placeholderTextColor={colors.silverMid}
        />
        <Pressable
          style={[styles.secondaryBtn, testing && styles.secondaryBtnDisabled]}
          onPress={() => void connectSelfHosted()}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color={colors.tealLight} />
          ) : (
            <Text style={styles.secondaryBtnText}>Test and connect</Text>
          )}
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 56,
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  primaryBtnMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryBtnDisabled: {
    opacity: 0.7,
  },
  secondaryBtnText: {
    color: colors.silver,
    fontWeight: '500',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.inkMid,
  },
  cardTitle: {
    color: colors.offWhite,
    fontWeight: '500',
  },
  hint: {
    color: colors.silverMid,
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.white,
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
});

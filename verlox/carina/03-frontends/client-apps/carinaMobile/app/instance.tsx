import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DEFAULT_CLOUD_URL } from '@/config/defaults';
import { ScreenShell } from '@/components/ScreenShell';
import { ConnectionStatusChip } from '@/components/ConnectionStatusChip';
import { authFromInstance } from '@/lib/gateway-auth';
import { testGatewayConnection } from '@/lib/connection-test';
import { isValidGatewayUrl, normalizeGatewayUrl } from '@/lib/url-utils';
import { clearApiKey, loadApiKey, saveApiKey } from '@/store/api-key-store';
import { setInstanceMode } from '@/store/instance-store';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

export default function InstanceScreen() {
  const { instance, refresh, signOut } = useAuth();
  const [mode, setMode] = useState<'cloud' | 'self-hosted'>(instance?.mode ?? 'cloud');
  const [baseUrl, setBaseUrl] = useState(instance?.baseUrl ?? DEFAULT_CLOUD_URL);
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'online' | 'offline' | 'auth-error' | 'checking'>(
    'checking',
  );
  const [error, setError] = useState<string | null>(null);

  const loadKey = useCallback(async () => {
    if (!instance?.baseUrl || instance.mode !== 'self-hosted') {
      setHasStoredKey(false);
      return;
    }
    const stored = await loadApiKey(instance.baseUrl);
    setHasStoredKey(Boolean(stored));
    setApiKey('');
  }, [instance?.baseUrl, instance?.mode]);

  useEffect(() => {
    if (instance) {
      setMode(instance.mode);
      setBaseUrl(instance.baseUrl);
    }
    void loadKey();
  }, [instance, loadKey]);

  const runConnectionTest = useCallback(
    async (url: string, testMode: 'cloud' | 'self-hosted', keyOverride?: string | null) => {
      setTesting(true);
      setError(null);
      const normalized = normalizeGatewayUrl(url);
      const storedKey =
        testMode === 'self-hosted' ? keyOverride ?? (await loadApiKey(normalized)) : null;
      const auth = authFromInstance(testMode, storedKey);
      const result = await testGatewayConnection(normalized, auth);
      setTestStatus(result.status);
      setTestMessage(`${result.message}${result.latencyMs ? ` (${result.latencyMs}ms)` : ''}`);
      setTesting(false);
    },
    [],
  );

  useEffect(() => {
    if (!instance?.baseUrl) return;
    void runConnectionTest(instance.baseUrl, instance.mode);
  }, [instance?.baseUrl, instance?.mode, runConnectionTest]);

  async function handleTest() {
    const url = normalizeGatewayUrl(baseUrl);
    await runConnectionTest(url, mode, mode === 'self-hosted' ? apiKey || null : null);
  }

  async function persistGateway() {
    const url = normalizeGatewayUrl(baseUrl);
    if (!isValidGatewayUrl(url)) {
      throw new Error(
        'Enter a valid http or https gateway URL. Use your machine LAN IP; localhost will not work on a physical device.',
      );
    }

    if (mode === 'self-hosted' && apiKey.trim()) {
      await saveApiKey(url, apiKey.trim());
    }

    await setInstanceMode(mode, url);
    await refresh();

    if (mode === 'cloud') {
      router.replace('/(auth)/login');
      return;
    }

    setTestMessage('Saved. Gateway connection updated.');
    await loadKey();
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const modeChanged = instance && (instance.mode !== mode || instance.baseUrl !== normalizeGatewayUrl(baseUrl));
      if (modeChanged) {
        Alert.alert(
          'Reset active chat session?',
          'Changing gateway mode or URL starts a new server session ID. Local chat history for the previous session remains on this device.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setSaving(false) },
            {
              text: 'Save',
              style: 'default',
              onPress: () => {
                void persistGateway()
                  .catch((err) => setError(err instanceof Error ? err.message : String(err)))
                  .finally(() => setSaving(false));
              },
            },
          ],
        );
        return;
      }

      await persistGateway();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (instance?.mode === 'self-hosted' && instance.baseUrl) {
      await clearApiKey(instance.baseUrl);
    }
    await signOut();
    router.replace('/(auth)/onboarding');
  }

  return (
    <ScreenShell
      title="Gateway"
      subtitle="Carina Cloud or a self-hosted agent on your network."
      showBack
      scroll={false}
    >
      <View style={styles.card}>
        <Text style={styles.label}>Connection</Text>
        <View style={styles.statusRow}>
          <ConnectionStatusChip status={testStatus} />
          <Pressable style={styles.testBtn} onPress={() => void handleTest()} disabled={testing}>
            {testing ? (
              <ActivityIndicator color={colors.tealLight} size="small" />
            ) : (
              <Text style={styles.testBtnText}>Test</Text>
            )}
          </Pressable>
        </View>
        {testMessage ? <Text style={styles.meta}>{testMessage}</Text> : null}
        {testStatus === 'offline' ? (
          <Text style={styles.meta}>
            Check the gateway URL and network, then tap Test again. Use your computer LAN IP on a
            physical device.
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Mode</Text>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeBtn, mode === 'cloud' && styles.modeBtnActive]}
            onPress={() => {
              setMode('cloud');
              setBaseUrl(DEFAULT_CLOUD_URL);
            }}
          >
            <Text style={[styles.modeText, mode === 'cloud' && styles.modeTextActive]}>
              Carina Cloud
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === 'self-hosted' && styles.modeBtnActive]}
            onPress={() => setMode('self-hosted')}
          >
            <Text style={[styles.modeText, mode === 'self-hosted' && styles.modeTextActive]}>
              Self-hosted
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Gateway URL</Text>
        <TextInput
          style={styles.input}
          value={baseUrl}
          onChangeText={setBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          editable={mode === 'self-hosted'}
          placeholder="http://192.168.1.10:3000"
          placeholderTextColor={colors.silverMid}
        />
        {mode === 'self-hosted' ? (
          <Text style={styles.meta}>
            Use your computer LAN IP (for example 192.168.1.10). localhost and 127.0.0.1 only work in simulators.
          </Text>
        ) : (
          <Text style={styles.meta}>Carina Cloud URL is fixed for hosted accounts.</Text>
        )}
      </View>

      {mode === 'self-hosted' ? (
        <View style={styles.card}>
          <Text style={styles.label}>API key (optional)</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholder={hasStoredKey ? 'Key saved (enter to replace)' : 'Bearer token from gateway'}
            placeholderTextColor={colors.silverMid}
          />
          <Text style={styles.meta}>
            Stored in SecureStore. Required if your gateway enforces tenant API keys.
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={() => void handleSave()}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save gateway'}</Text>
      </Pressable>

      <Pressable onPress={() => void handleDisconnect()}>
        <Text style={styles.disconnect}>Disconnect and return to onboarding</Text>
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  testBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: {
    color: colors.tealLight,
    fontSize: 13,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modeBtnActive: {
    borderColor: colors.teal,
    backgroundColor: 'rgba(26, 95, 122, 0.2)',
  },
  modeText: {
    color: colors.silver,
    fontSize: 13,
    fontWeight: '600',
  },
  modeTextActive: {
    color: colors.tealLight,
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
  meta: {
    color: colors.silver,
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
  disconnect: {
    color: colors.tealLight,
    fontSize: 14,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});

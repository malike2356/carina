import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { claimMobileLogin } from '@/api/mobile-login';
import { ScreenShell } from '@/components/ScreenShell';
import { DEFAULT_CLOUD_URL } from '@/config/defaults';
import { extractLoginTokenFromUrl } from '@/lib/login-url';
import { useAuth } from '@/store/auth-store';
import { saveCloudSessionToken } from '@/store/cloud-session-store';
import { setInstanceMode } from '@/store/instance-store';
import { colors, radii, spacing } from '@/theme/tokens';

export default function LoginScanScreen() {
  const { token: paramToken } = useLocalSearchParams<{ token?: string }>();
  const { refresh } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualToken, setManualToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const claiming = useRef(false);

  const claim = useCallback(
    async (raw: string) => {
      if (claiming.current) return;
      const token = extractLoginTokenFromUrl(raw);
      if (!token) {
        setError('Invalid login QR. Open Settings → Device pairing on the web and scan that code.');
        return;
      }

      claiming.current = true;
      setBusy(true);
      setError(null);
      try {
        await setInstanceMode('cloud', DEFAULT_CLOUD_URL);
        const result = await claimMobileLogin(token, DEFAULT_CLOUD_URL);
        await saveCloudSessionToken(DEFAULT_CLOUD_URL, result.token);
        await refresh();
        router.replace('/(tabs)/chat');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        claiming.current = false;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    if (paramToken) {
      void claim(paramToken);
    }
  }, [claim, paramToken]);

  useEffect(() => {
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  return (
    <ScreenShell
      title="Scan to sign in"
      subtitle="On the web (signed in): Settings → Device pairing → scan the login QR here. Or paste the login token below."
      showBack
      onBack={() => router.replace('/(auth)/login' as Href)}
    >
      {busy ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.tealLight} />
          <Text style={styles.meta}>Signing you in...</Text>
        </View>
      ) : (
        <>
          {permission?.granted ? (
            <View style={styles.cameraWrap}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => {
                  void claim(data);
                }}
              />
            </View>
          ) : (
            <View style={styles.permBox}>
              <Text style={styles.meta}>
                Camera access is needed to scan the login QR. You can also paste the token below.
              </Text>
              <Pressable style={styles.secondaryBtn} onPress={() => void requestPermission()}>
                <Text style={styles.secondaryBtnText}>Allow camera</Text>
              </Pressable>
            </View>
          )}

          <TextInput
            style={styles.input}
            value={manualToken}
            onChangeText={setManualToken}
            placeholder="Paste login token"
            placeholderTextColor={colors.silverMid}
            autoCapitalize="none"
            editable={!busy}
          />
          <Pressable
            style={[styles.primaryBtn, (!manualToken.trim() || busy) && styles.disabled]}
            onPress={() => void claim(manualToken)}
            disabled={busy || !manualToken.trim()}
          >
            <Text style={styles.primaryBtnText}>Sign in with token</Text>
          </Pressable>
          <Pressable
            style={styles.linkBtn}
            onPress={() => router.replace('/(auth)/login' as Href)}
            disabled={busy}
          >
            <Text style={styles.linkBtnText}>Sign in with email instead</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  meta: { color: colors.silver, fontSize: 13, lineHeight: 18 },
  permBox: { gap: spacing.sm },
  cameraWrap: {
    height: 280,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  camera: { flex: 1 },
  input: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.white,
    backgroundColor: colors.inkMid,
    minHeight: 44,
  },
  primaryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryBtnText: { color: colors.tealLight, fontWeight: '600' },
  linkBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  linkBtnText: { color: colors.tealLight, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, marginTop: spacing.sm, fontSize: 13 },
});

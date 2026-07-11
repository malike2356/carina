import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pairingApi } from '@/api/pairing';
import { requestCameraPermission } from '@/lib/camera-permission';
import { extractPairingTokenFromUrl } from '@/lib/pairing-url';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

export default function PairScanScreen() {
  const { instance, gatewayAuth, refresh } = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const handledRef = useRef(false);

  const askCameraPermission = useCallback(async () => {
    try {
      const granted = await requestCameraPermission();
      setPermissionGranted(granted);
      if (!granted) {
        setError('Camera permission is required to scan the Carina pairing QR code.');
      } else {
        setError(null);
      }
      return granted;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPermissionGranted(false);
      setError(`Camera unavailable: ${message}`);
      return false;
    }
  }, []);

  useEffect(() => {
    void askCameraPermission();
  }, [askCameraPermission]);

  const completePairing = useCallback(
    async (rawToken: string) => {
      if (!instance?.baseUrl || handledRef.current) return;
      handledRef.current = true;
      setScanning(false);
      setError(null);

      const token = extractPairingTokenFromUrl(rawToken);
      if (!token) {
        setError('Invalid QR code. Scan the pairing code from Carina desktop or web settings.');
        handledRef.current = false;
        setScanning(true);
        return;
      }

      try {
        const result = await pairingApi.completePairing(
          instance.baseUrl,
          gatewayAuth ?? undefined,
          token,
        );
        if (result.paired) {
          await refresh();
          router.replace({
            pathname: '/pair-success',
            params: { scopes: result.grantedScopes.join(',') },
          });
          return;
        }
        setError('Pairing failed. The token may have expired. Generate a new QR code on desktop.');
        handledRef.current = false;
        setScanning(true);
      } catch {
        setError('Could not connect to Carina. Check your gateway URL and network, then try again.');
        handledRef.current = false;
        setScanning(true);
      }
    },
    [gatewayAuth, instance?.baseUrl, refresh],
  );

  useEffect(() => {
    if (typeof params.token === 'string' && params.token.length > 0) {
      void completePairing(params.token);
    }
  }, [completePairing, params.token]);

  if (!instance?.baseUrl) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Pair device</Text>
        <Text style={styles.meta}>Configure a gateway before pairing.</Text>
        <Pressable style={styles.button} onPress={() => router.push('/instance')}>
          <Text style={styles.buttonText}>Open instance settings</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (permissionGranted === null) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <ActivityIndicator color={colors.tealLight} />
        <Text style={styles.meta}>Preparing camera...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {permissionGranted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onCameraReady={() => setCameraReady(true)}
          onBarcodeScanned={
            scanning
              ? ({ data }) => {
                  void completePairing(data);
                }
              : undefined
          }
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.deniedBackdrop]} />
      )}

      {/* Transparent chrome so the live preview stays visible. */}
      <SafeAreaView style={styles.overlay} edges={['top', 'left', 'right', 'bottom']} pointerEvents="box-none">
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Scan pairing code</Text>
        <Text style={styles.subtitle}>
          Scan the QR code shown in Carina desktop or web settings.
        </Text>

        <View style={styles.scanFrame} pointerEvents="none" />

        {permissionGranted && !cameraReady ? (
          <View style={styles.readyRow}>
            <ActivityIndicator color={colors.tealLight} />
            <Text style={styles.meta}>Opening camera...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!permissionGranted ? (
          <View style={styles.manualBlock}>
            <Text style={styles.meta}>
              Camera access was denied. Paste the pairing token manually, or allow camera access in
              system settings.
            </Text>
            <TextInput
              style={styles.input}
              value={manualToken}
              onChangeText={setManualToken}
              placeholder="Paste pairing token"
              placeholderTextColor={colors.silverMid}
              autoCapitalize="none"
            />
            <Pressable
              style={styles.button}
              onPress={() => void completePairing(manualToken)}
              disabled={!manualToken.trim()}
            >
              <Text style={styles.buttonText}>Pair with token</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => void askCameraPermission()}>
              <Text style={styles.secondaryButtonText}>Retry camera permission</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => void Linking.openSettings()}>
              <Text style={styles.secondaryButtonText}>Open system settings</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.manualBlock}>
            <Text style={styles.meta}>Or paste the pairing token if the QR code will not scan.</Text>
            <TextInput
              style={styles.input}
              value={manualToken}
              onChangeText={setManualToken}
              placeholder="Paste pairing token"
              placeholderTextColor={colors.silverMid}
              autoCapitalize="none"
            />
            <Pressable
              style={styles.secondaryButton}
              onPress={() => void completePairing(manualToken)}
              disabled={!manualToken.trim()}
            >
              <Text style={styles.secondaryButtonText}>Pair with token</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'transparent',
  },
  deniedBackdrop: {
    backgroundColor: colors.ink,
  },
  backBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  backText: {
    color: colors.tealLight,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    color: colors.silver,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  scanFrame: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: colors.tealLight,
    borderRadius: radii.md,
    marginVertical: spacing.lg,
    backgroundColor: 'transparent',
  },
  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  errorBanner: {
    backgroundColor: 'rgba(9, 22, 30, 0.88)',
    borderColor: colors.amber,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.amber,
    fontSize: 14,
    lineHeight: 20,
  },
  manualBlock: {
    marginTop: 'auto',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(9, 22, 30, 0.82)',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.white,
    backgroundColor: colors.inkMid,
  },
  button: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.tealLight,
    fontWeight: '600',
  },
});

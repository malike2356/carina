import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { ScreenShell } from '@/components/ScreenShell';
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
  const [manualToken, setManualToken] = useState('');
  const handledRef = useRef(false);

  useEffect(() => {
    void (async () => {
      const granted = await requestCameraPermission();
      setPermissionGranted(granted);
      if (!granted) {
        setError('Camera permission is required to scan the Carina pairing QR code.');
      }
    })();
  }, []);

  const completePairing = useCallback(async (rawToken: string) => {
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
      const result = await pairingApi.completePairing(instance.baseUrl, gatewayAuth ?? undefined, token);
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
  }, [gatewayAuth, instance?.baseUrl, refresh]);

  useEffect(() => {
    if (typeof params.token === 'string' && params.token.length > 0) {
      void completePairing(params.token);
    }
  }, [completePairing, params.token]);

  if (!instance?.baseUrl) {
    return (
      <ScreenShell title="Pair device" subtitle="Configure a gateway before pairing.">
        <Text style={styles.meta}>Open Instance settings and connect to your Carina gateway first.</Text>
        <Pressable style={styles.button} onPress={() => router.push('/instance')}>
          <Text style={styles.buttonText}>Open instance settings</Text>
        </Pressable>
      </ScreenShell>
    );
  }

  if (permissionGranted === null) {
    return (
      <ScreenShell title="Pair device" subtitle="Preparing camera...">
        <ActivityIndicator color={colors.tealLight} />
      </ScreenShell>
    );
  }

  return (
    <View style={styles.root}>
      {permissionGranted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            scanning
              ? ({ data }) => {
                  void completePairing(data);
                }
              : undefined
          }
        />
      ) : null}

      <ScreenShell
        title="Scan pairing code"
        subtitle="Scan the QR code shown in Carina desktop or web settings."
        scroll={false}
        showBack
        style={permissionGranted ? styles.overlayShell : undefined}
      >
        <View style={styles.scanFrame} />

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!permissionGranted ? (
          <View style={styles.manualBlock}>
            <Text style={styles.meta}>
              Camera access was denied. Paste the pairing token manually or grant camera permission
              in system settings.
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
            <Pressable
              style={styles.secondaryButton}
              onPress={() => void requestCameraPermission().then(setPermissionGranted)}
            >
              <Text style={styles.secondaryButtonText}>Retry camera permission</Text>
            </Pressable>
          </View>
        ) : null}
      </ScreenShell>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  overlayShell: {
    backgroundColor: 'rgba(9, 22, 30, 0.72)',
  },
  scanFrame: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: colors.tealLight,
    borderRadius: radii.md,
    marginVertical: spacing.lg,
  },
  errorBanner: {
    backgroundColor: colors.inkMid,
    borderColor: colors.amber,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  errorText: {
    color: colors.amber,
    fontSize: 14,
    lineHeight: 20,
  },
  manualBlock: {
    gap: spacing.sm,
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

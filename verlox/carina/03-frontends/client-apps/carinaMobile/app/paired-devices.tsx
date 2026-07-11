import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import {
  formatRelativeTime,
  pairingApi,
  platformLabel,
  type PairedDeviceRow,
} from '@/api/pairing';
import { useAuth } from '@/store/auth-store';
import { loadDeviceToken } from '@/store/device-token-store';
import { colors, radii, spacing } from '@/theme/tokens';

export default function PairedDevicesScreen() {
  const { instance, refresh, gatewayAuth } = useAuth();
  const [devices, setDevices] = useState<PairedDeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    if (!instance?.baseUrl) {
      setDevices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const deviceToken = await loadDeviceToken(instance.baseUrl);
      // Cloud lists devices via signed-in session; self-hosted uses device token.
      if (instance.mode === 'cloud' && gatewayAuth?.apiKey) {
        const result = await pairingApi.getDevices(instance.baseUrl, gatewayAuth.apiKey);
        setDevices(result.devices);
        return;
      }
      if (!deviceToken) {
        setDevices([]);
        setError('This phone is not paired yet. Scan a QR code to pair with Carina.');
        return;
      }
      const result = await pairingApi.getDevices(instance.baseUrl, deviceToken);
      setDevices(result.devices);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message.includes('401') || message.includes('Unauthorized')
        ? 'Pair this device first, or sign in to a gateway account with device management access.'
        : 'Could not load paired devices.');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [gatewayAuth?.apiKey, instance?.baseUrl, instance?.mode]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  async function revokeDevice(device: PairedDeviceRow) {
    if (!instance?.baseUrl) return;
    Alert.alert(
      'Revoke device',
      `Remove "${device.name}"? It will no longer have access to Carina.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const authToken =
                instance.mode === 'cloud' && gatewayAuth?.apiKey
                  ? gatewayAuth.apiKey
                  : await loadDeviceToken(instance.baseUrl);
              if (!authToken) return;
              await pairingApi.revokeDevice(instance.baseUrl, authToken, device.id);
              setDevices((prev) => prev.filter((row) => row.id !== device.id));
              await refresh();
            })();
          },
        },
      ],
    );
  }

  return (
    <ScreenShell
      title="Paired devices"
      subtitle="Devices authorized to talk to your Carina gateway."
      showBack
    >
      {loading ? (
        <ActivityIndicator color={colors.tealLight} />
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.deviceRow}>
              <View style={styles.deviceBadge}>
                <Text style={styles.deviceBadgeText}>{platformLabel(item.platform)}</Text>
              </View>
              <View style={styles.deviceBody}>
                <Text style={styles.deviceName}>{item.name}</Text>
                <Text style={styles.deviceMeta}>
                  Last seen {formatRelativeTime(item.lastSeen)}
                </Text>
              </View>
              <Pressable style={styles.revokeButton} onPress={() => void revokeDevice(item)}>
                <Text style={styles.revokeText}>Revoke</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No paired devices yet. Pair from desktop or scan a QR code on this phone.
            </Text>
          }
        />
      )}

      <Pressable style={styles.primaryButton} onPress={() => router.push('/pair-scan')}>
        <Text style={styles.primaryButtonText}>Pair this device</Text>
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
    backgroundColor: colors.inkMid,
  },
  errorText: {
    color: colors.amber,
    fontSize: 14,
    lineHeight: 20,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.inkMid,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderDim,
  },
  deviceBadge: {
    backgroundColor: colors.inkLift,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  deviceBadgeText: {
    color: colors.tealLight,
    fontSize: 11,
    fontWeight: '700',
  },
  deviceBody: {
    flex: 1,
    gap: 2,
  },
  deviceName: {
    color: colors.white,
    fontWeight: '600',
  },
  deviceMeta: {
    color: colors.silverMid,
    fontSize: 12,
  },
  revokeButton: {
    padding: spacing.sm,
  },
  revokeText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  emptyText: {
    color: colors.silver,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
});

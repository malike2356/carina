# Gap 03 - Prompt 04: Companion Pairing (Mobile Frontend)

**Agent:** Codex (fallback: Cursor)
**Estimated hours:** 2-3 hrs (backend is COMPLETE)
**Depends on:** 01-background-connection.md done

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## CRITICAL NOTE - Read First

The entire pairing backend is already built at:
```
core.carinaai.uk/src/pairing/pairing.ts
core.carinaai.uk/src/infrastructure/device-pairing.ts
core.carinaai.uk/src/infrastructure/device-scopes.ts
```

This prompt is FRONTEND ONLY. You are building the mobile UI that calls the existing API. Do not touch the backend.

Also read:
```
carinaMobile/src/services/CarinaConnectionService.ts   (from 01)
carinaMobile/src/api/                                  (existing API client)
core.carinaai.uk/src/pairing/pairing.ts               (to understand the token API shape)
```

---

## What the Backend Provides

From `pairing.ts`, the API endpoints are:

```
POST /api/pairing/tokens
  body: { deviceName: string, platform: 'ios' | 'android', scopes: string[] }
  response: { token: string, expiresAt: string, pairingUrl: string }

POST /api/pairing/complete
  body: { token: string, deviceId: string }
  response: { paired: boolean, deviceToken: string, grantedScopes: string[] }

GET /api/pairing/devices
  response: { devices: Device[] }
  Device: { id, name, platform, pairedAt, lastSeen, scopes }

DELETE /api/pairing/devices/:id
  response: { revoked: boolean }
```

The `pairingUrl` from the first endpoint is what gets encoded in the QR code shown on desktop. On mobile, the user scans that QR. The mobile app then extracts the token from the URL and calls `/api/pairing/complete`.

---

## What to Build

### 1. QR Scanner Screen (`src/screens/PairScanScreen.tsx`)

This is the primary pairing flow: the user opens this screen and scans the QR code shown in the desktop app settings.

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera, useCameraDevices, useCodeScanner } from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
import { pairingApi } from '../api/pairing';

export function PairScanScreen() {
  const navigation = useNavigation();
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const devices = useCameraDevices();
  const device = devices.back;

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: async (codes) => {
      if (!scanning || codes.length === 0) return;
      setScanning(false);

      const url = codes[0].value;
      const token = extractTokenFromUrl(url);
      if (!token) {
        setError('Invalid QR code. Please scan the Carina pairing code.');
        setScanning(true);
        return;
      }

      try {
        const result = await pairingApi.completePairing(token);
        if (result.paired) {
          navigation.navigate('PairSuccess', { scopes: result.grantedScopes });
        } else {
          setError('Pairing failed. Token may have expired. Generate a new QR code.');
          setScanning(true);
        }
      } catch (err) {
        setError('Could not connect to Carina. Check your connection and try again.');
        setScanning(true);
      }
    },
  });

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Camera not available</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={scanning}
        codeScanner={codeScanner}
      />
      <View style={styles.overlay}>
        <Text style={styles.instruction}>
          Scan the QR code from Carina desktop or web app
        </Text>
        <View style={styles.scanFrame} />
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function extractTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // carina://pair/<token>  OR  https://app.carinaai.uk/pair?token=<token>
    if (parsed.protocol === 'carina:' && parsed.pathname.startsWith('/pair/')) {
      return parsed.pathname.split('/pair/')[1];
    }
    if (parsed.searchParams.has('token')) {
      return parsed.searchParams.get('token');
    }
    return null;
  } catch {
    return null;
  }
}
```

### 2. Pairing Success Screen (`src/screens/PairSuccessScreen.tsx`)

```tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export function PairSuccessScreen({ route }) {
  const { scopes } = route.params;

  const scopeLabels: Record<string, string> = {
    'session.read':     'Read chat sessions',
    'session.write':    'Send messages',
    'camera.use':       'Camera access',
    'sms.relay':        'SMS relay',
    'call.relay':       'Call log',
    'notification.relay': 'Notification relay',
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>Connected</Text>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
        Device paired with Carina
      </Text>
      <Text style={{ color: '#888', marginBottom: 24, textAlign: 'center' }}>
        This device can now communicate with your Carina agent.
      </Text>

      <Text style={{ fontWeight: '600', marginBottom: 8 }}>Granted permissions:</Text>
      {scopes.map((scope: string) => (
        <Text key={scope} style={{ color: '#4ade80', marginBottom: 4 }}>
          + {scopeLabels[scope] ?? scope}
        </Text>
      ))}

      <TouchableOpacity
        style={{ marginTop: 32, padding: 16, backgroundColor: '#6366f1', borderRadius: 8 }}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>Start using Carina</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 3. Paired Devices Management Screen (`src/screens/PairedDevicesScreen.tsx`)

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { pairingApi } from '../api/pairing';

interface Device {
  id: string;
  name: string;
  platform: 'ios' | 'android' | 'desktop' | 'web';
  pairedAt: string;
  lastSeen: string;
  scopes: string[];
}

export function PairedDevicesScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, []);

  async function loadDevices() {
    try {
      const result = await pairingApi.getDevices();
      setDevices(result.devices);
    } finally {
      setLoading(false);
    }
  }

  async function revokeDevice(device: Device) {
    Alert.alert(
      'Revoke Device',
      `Remove "${device.name}"? It will no longer have access to Carina.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            await pairingApi.revokeDevice(device.id);
            setDevices(prev => prev.filter(d => d.id !== device.id));
          },
        },
      ]
    );
  }

  function platformIcon(platform: string) {
    switch (platform) {
      case 'ios':     return '[iOS]';
      case 'android': return '[Android]';
      case 'desktop': return '[Desktop]';
      case 'web':     return '[Web]';
      default:        return '[Device]';
    }
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
        Paired Devices
      </Text>

      {loading ? (
        <Text style={{ color: '#888' }}>Loading...</Text>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={{
              padding: 12, marginBottom: 8, backgroundColor: '#1a1a2e',
              borderRadius: 8, flexDirection: 'row', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 24, marginRight: 12 }}>{platformIcon(item.platform)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>{item.name}</Text>
                <Text style={{ color: '#888', fontSize: 12 }}>
                  Paired {new Date(item.pairedAt).toLocaleDateString()}
                </Text>
                <Text style={{ color: '#666', fontSize: 11 }}>
                  Last seen {formatRelativeTime(item.lastSeen)}
                </Text>
              </View>
              <TouchableOpacity
                style={{ padding: 8 }}
                onPress={() => revokeDevice(item)}
              >
                <Text style={{ color: '#ef4444' }}>Revoke</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={{ color: '#888', textAlign: 'center', marginTop: 32 }}>
              No paired devices. Pair from desktop or web settings.
            </Text>
          }
        />
      )}

      <TouchableOpacity
        style={{ marginTop: 16, padding: 14, backgroundColor: '#6366f1', borderRadius: 8, alignItems: 'center' }}
        onPress={() => navigation.navigate('PairScan')}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>+ Pair Another Device</Text>
      </TouchableOpacity>
    </View>
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
```

### 4. Pairing API Client (`src/api/pairing.ts`)

```typescript
import { apiClient } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUniqueId } from 'react-native-device-info';
import { Platform } from 'react-native';

export const pairingApi = {

  async completePairing(token: string) {
    const deviceId = await getUniqueId();
    const result = await apiClient.post('/api/pairing/complete', {
      token,
      deviceId,
      deviceName: await getDeviceName(),
      platform: Platform.OS as 'ios' | 'android',
    });

    // Store device token for authenticated requests
    if (result.deviceToken) {
      await AsyncStorage.setItem('device_token', result.deviceToken);
    }

    return result;
  },

  async getDevices() {
    return apiClient.get('/api/pairing/devices');
  },

  async revokeDevice(deviceId: string) {
    return apiClient.delete(`/api/pairing/devices/${deviceId}`);
  },
};

async function getDeviceName(): Promise<string> {
  const { getDeviceName } = await import('react-native-device-info');
  return getDeviceName();
}
```

### 5. Permission Handler for Camera

```typescript
// src/lib/camera-permission.ts
import { Camera } from 'react-native-vision-camera';

export async function requestCameraPermission(): Promise<boolean> {
  const status = await Camera.requestCameraPermission();
  return status === 'granted';
}
```

### 6. Navigation Integration

Add to `src/navigation/SettingsNavigator.tsx` (or wherever settings routes live):

```tsx
<Stack.Screen name="PairedDevices" component={PairedDevicesScreen} options={{ title: 'Paired Devices' }} />
<Stack.Screen name="PairScan" component={PairScanScreen} options={{ title: 'Scan QR Code', headerShown: false }} />
<Stack.Screen name="PairSuccess" component={PairSuccessScreen} options={{ title: 'Connected!', headerBackVisible: false }} />
```

Add "Paired Devices" entry to the main settings screen linking to `PairedDevices`.

---

## Files to Create

```
carinaMobile/src/
├── screens/
│   ├── PairScanScreen.tsx
│   ├── PairSuccessScreen.tsx
│   └── PairedDevicesScreen.tsx
├── api/
│   └── pairing.ts
└── lib/
    └── camera-permission.ts
```

## Files to Modify

```
src/navigation/SettingsNavigator.tsx   → add PairedDevices, PairScan, PairSuccess routes
src/screens/SettingsScreen.tsx         → add "Paired Devices" row linking to /PairedDevices
```

## Packages to Install (if not already)

```bash
npm install react-native-vision-camera react-native-device-info
# Camera permission is already in app.config.js from 02-camera-motion.md
# If not: add NSCameraUsageDescription to ios plist + camera permission in Android manifest
```

---

## Done When

- [ ] Opening PairScanScreen activates the camera with a scan frame overlay
- [ ] Scanning the QR from desktop settings navigates to PairSuccessScreen with granted scopes
- [ ] PairSuccessScreen shows the correct scope list from the backend response
- [ ] Navigating to "Paired Devices" in settings shows all paired devices with platform icons
- [ ] Revoking a device removes it from the list immediately
- [ ] The device token from pairing is stored and used in subsequent API calls (check that apiClient sends X-Device-Token header)
- [ ] Scanning an expired QR shows a clear error message and re-enables scanning

import { useCallback, useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { evaluateNativeCapabilities } from '@/lib/native-capabilities';
import { loadRemotePushEnabled } from '@/lib/notification-prefs';
import {
  clearPushRegistration,
  getExpoPushToken,
  resyncPushFromPrefs,
} from '@/lib/push-registration';
import { useAuth } from '@/store/auth-store';

async function unregisterCurrentToken(baseUrl: string, knownToken: string | null): Promise<void> {
  const token = knownToken ?? (await getExpoPushToken());
  if (!token) return;
  await clearPushRegistration(baseUrl, token);
}

export function usePushRegistration(): void {
  const { instance, user, ready } = useAuth();
  const tokenRef = useRef<string | null>(null);

  const sync = useCallback(async () => {
    const baseUrl = instance?.baseUrl ?? '';

    if (!ready || !user || instance?.mode !== 'cloud' || !baseUrl) {
      if (baseUrl) {
        await unregisterCurrentToken(baseUrl, tokenRef.current);
      }
      tokenRef.current = null;
      return;
    }

    const remoteEnabled = await loadRemotePushEnabled();
    if (!remoteEnabled) {
      await unregisterCurrentToken(baseUrl, tokenRef.current);
      tokenRef.current = null;
      return;
    }

    const native = evaluateNativeCapabilities({
      appOwnership: Constants.appOwnership ?? null,
      isDevice: Device.isDevice,
      easProjectId:
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId,
      platform: Platform.OS,
    });

    if (!native.remotePush.available) {
      return;
    }

    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') {
      return;
    }

    const token = await resyncPushFromPrefs(baseUrl);
    tokenRef.current = token;
  }, [instance?.baseUrl, instance?.mode, ready, user]);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    const sub = Notifications.addPushTokenListener(() => {
      void sync();
    });
    return () => sub.remove();
  }, [sync]);
}

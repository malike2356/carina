import { useCallback, useEffect, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { MessageRelay } from '@/lib/message-relay';
import { loadRelayPrefs, saveRelayPrefs, type RelayPrefs } from '@/lib/relay-prefs';
import { loadApiKey } from '@/store/api-key-store';
import { loadDeviceToken } from '@/store/device-token-store';
import { useAuth } from '@/store/auth-store';

async function requestAndroidRelayPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
  ]);

  const allGranted = Object.values(granted).every(
    (value) => value === PermissionsAndroid.RESULTS.GRANTED,
  );

  if (!allGranted) {
    Alert.alert(
      'Permissions required',
      'SMS and call log access are required before Carina can relay messages from your device.',
    );
  }

  return allGranted;
}

export function useRelaySettings() {
  const { instance } = useAuth();
  const [prefs, setPrefs] = useState<RelayPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await loadRelayPrefs();
    setPrefs(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!instance?.baseUrl) return;
    void (async () => {
      const apiKey =
        instance.mode === 'self-hosted' ? await loadApiKey(instance.baseUrl) : null;
      const deviceToken = await loadDeviceToken(instance.baseUrl);
      await MessageRelay.configure(instance.baseUrl, deviceToken, apiKey);
    })();
  }, [instance]);

  useEffect(() => {
    if (!prefs || !instance?.baseUrl) return;
    void (async () => {
      await MessageRelay.setAllowedSenders(prefs.allowedSenders);
      await MessageRelay.setPrivacyHours(prefs.privacyStartHour, prefs.privacyEndHour);
      await MessageRelay.setSmsEnabled(prefs.smsEnabled);
      await MessageRelay.setCallEnabled(prefs.callEnabled);
      await MessageRelay.setNotificationEnabled(prefs.notificationEnabled);
    })();
  }, [instance?.baseUrl, prefs]);

  const updatePrefs = useCallback(async (patch: Partial<RelayPrefs>) => {
    const current = prefs ?? (await loadRelayPrefs());
    const next = { ...current, ...patch };
    await saveRelayPrefs(next);
    setPrefs(next);

    if (patch.allowedSenders !== undefined) {
      await MessageRelay.setAllowedSenders(next.allowedSenders);
    }
    if (patch.privacyStartHour !== undefined || patch.privacyEndHour !== undefined) {
      await MessageRelay.setPrivacyHours(next.privacyStartHour, next.privacyEndHour);
    }
    if (patch.smsEnabled !== undefined) {
      await MessageRelay.setSmsEnabled(next.smsEnabled);
    }
    if (patch.callEnabled !== undefined) {
      await MessageRelay.setCallEnabled(next.callEnabled);
    }
    if (patch.notificationEnabled !== undefined) {
      await MessageRelay.setNotificationEnabled(next.notificationEnabled);
    }
  }, [prefs]);

  const toggleSms = useCallback(async (enabled: boolean) => {
    if (enabled && Platform.OS === 'android') {
      const granted = await requestAndroidRelayPermissions();
      setPermissionDenied(!granted);
      if (!granted) return;
    }
    await updatePrefs({ smsEnabled: enabled });
  }, [updatePrefs]);

  const toggleCall = useCallback(async (enabled: boolean) => {
    if (enabled && Platform.OS === 'android') {
      const granted = await requestAndroidRelayPermissions();
      setPermissionDenied(!granted);
      if (!granted) return;
    }
    await updatePrefs({ callEnabled: enabled });
  }, [updatePrefs]);

  const toggleNotification = useCallback(async (enabled: boolean) => {
    await updatePrefs({ notificationEnabled: enabled });
  }, [updatePrefs]);

  const setAllowedSenders = useCallback(async (senders: string[]) => {
    await updatePrefs({ allowedSenders: senders });
  }, [updatePrefs]);

  const setPrivacyHours = useCallback(async (startHour: number, endHour: number) => {
    await updatePrefs({ privacyStartHour: startHour, privacyEndHour: endHour });
  }, [updatePrefs]);

  return {
    prefs,
    loading,
    permissionDenied,
    reload,
    toggleSms,
    toggleCall,
    toggleNotification,
    setAllowedSenders,
    setPrivacyHours,
  };
}

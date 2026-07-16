import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { DEFAULT_CLOUD_URL } from '@/config/defaults';
import {
  buildMobileUpdateState,
  fetchMobileReleaseManifest,
  type MobileUpdateState,
} from '@/lib/mobile-update';

const LAST_CHECK_KEY = 'carina.mobile-update.last-check';
const DISMISSED_VERSION_KEY = 'carina.mobile-update.dismissed-version';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

function installedVersion(): string {
  return Application.nativeApplicationVersion || '0.0.0';
}

async function openDownload(url: string): Promise<void> {
  await Linking.openURL(url);
}

export function useMobileUpdateCheck(options?: { auto?: boolean }) {
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<MobileUpdateState | null>(null);

  const promptForUpdate = useCallback(async (state: MobileUpdateState, manual: boolean) => {
    if (!state.updateAvailable && !state.updateRequired) {
      if (manual) {
        Alert.alert('Carina Mobile is up to date', `Installed version: ${state.installedVersion}`);
      }
      return;
    }

    const dismissed = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
    if (!manual && !state.updateRequired && dismissed === state.latestVersion) return;

    const notes = state.releaseNotes.slice(0, 3).join('\n');
    const message = [
      `Installed: v${state.installedVersion}`,
      `Latest: v${state.latestVersion}`,
      notes,
    ].filter(Boolean).join('\n\n');

    const buttons = state.updateRequired
      ? [
          {
            text: 'Download update',
            onPress: () => void openDownload(state.downloadUrl),
          },
        ]
      : [
          {
            text: 'Later',
            style: 'cancel' as const,
            onPress: () => void AsyncStorage.setItem(DISMISSED_VERSION_KEY, state.latestVersion),
          },
          {
            text: 'Download update',
            onPress: () => void openDownload(state.downloadUrl),
          },
        ];

    Alert.alert(
      state.updateRequired ? 'Carina Mobile update required' : 'Carina Mobile update available',
      message,
      buttons,
      { cancelable: !state.updateRequired },
    );
  }, []);

  const checkForUpdate = useCallback(async (options?: { manual?: boolean; force?: boolean }) => {
    const manual = options?.manual ?? false;
    const force = options?.force ?? false;

    if (Platform.OS !== 'android') return null;

    if (!force) {
      const lastCheck = Number(await AsyncStorage.getItem(LAST_CHECK_KEY));
      if (!manual && Number.isFinite(lastCheck) && Date.now() - lastCheck < CHECK_INTERVAL_MS) {
        return update;
      }
    }

    setChecking(true);
    try {
      const manifest = await fetchMobileReleaseManifest(DEFAULT_CLOUD_URL);
      await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));

      const state = manifest
        ? buildMobileUpdateState(installedVersion(), manifest, DEFAULT_CLOUD_URL)
        : null;

      setUpdate(state);

      if (state) {
        await promptForUpdate(state, manual);
      } else if (manual) {
        Alert.alert('Update check unavailable', 'Carina could not read the latest APK manifest.');
      }

      return state;
    } catch {
      if (manual) {
        Alert.alert('Update check unavailable', 'Check your connection and try again.');
      }
      return null;
    } finally {
      setChecking(false);
    }
  }, [promptForUpdate, update]);

  useEffect(() => {
    if (options?.auto === false) return;
    void checkForUpdate();
  }, [checkForUpdate, options?.auto]);

  return {
    checking,
    update,
    checkForUpdate,
  };
}

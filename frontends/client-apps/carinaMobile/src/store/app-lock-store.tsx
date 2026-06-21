import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  loadBiometricEnabled,
  saveBiometricEnabled,
} from '@/lib/biometric-prefs';

interface AppLockContextValue {
  enabled: boolean;
  locked: boolean;
  available: boolean;
  loading: boolean;
  unlock: () => Promise<boolean>;
  toggle: (next: boolean) => Promise<boolean>;
}

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshAvailability = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const ready = hasHardware && enrolled;
    setAvailable(ready);
    return ready;
  }, []);

  useEffect(() => {
    void (async () => {
      const value = await loadBiometricEnabled();
      await refreshAvailability();
      setEnabled(value);
      setLocked(value);
      setLoading(false);
    })();
  }, [refreshAvailability]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && enabled) {
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const unlock = useCallback(async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Carina',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    if (result.success) {
      setLocked(false);
      return true;
    }
    return false;
  }, []);

  const toggle = useCallback(
    async (next: boolean): Promise<boolean> => {
      if (next) {
        const ready = await refreshAvailability();
        if (!ready) return false;
        const ok = await unlock();
        if (!ok) return false;
      }
      await saveBiometricEnabled(next);
      setEnabled(next);
      setLocked(false);
      return true;
    },
    [refreshAvailability, unlock],
  );

  const value = useMemo(
    () => ({ enabled, locked, available, loading, unlock, toggle }),
    [enabled, locked, available, loading, unlock, toggle],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) {
    throw new Error('useAppLock must be used within AppLockProvider');
  }
  return ctx;
}

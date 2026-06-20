import { useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { clearPushRegistration, resyncPushFromPrefs } from '@/lib/push-registration';
import { useAuth } from '@/store/auth-store';

export function usePushRegistration(): void {
  const { instance, user, ready } = useAuth();
  const tokenRef = useRef<string | null>(null);

  const sync = useCallback(async () => {
    if (!ready || !user || instance?.mode !== 'cloud' || !instance.baseUrl) {
      if (tokenRef.current && instance?.baseUrl) {
        await clearPushRegistration(instance.baseUrl, tokenRef.current);
        tokenRef.current = null;
      }
      return;
    }

    const token = await resyncPushFromPrefs(instance.baseUrl);
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

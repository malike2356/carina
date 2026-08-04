import { router } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/store/auth-store';

/**
 * Redirects cloud users to login when the hosted session is missing or expired.
 * Mount from the tabs layout so chat/trust cannot show stale cloud state.
 */
export function useCloudSessionGuard(): void {
  const { ready, instance, user, cloudSessionExpired } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (instance?.mode !== 'cloud') return;
    if (user && !cloudSessionExpired) return;

    router.replace({
      pathname: '/(auth)/login',
      ...(cloudSessionExpired ? { params: { expired: '1' } } : {}),
    });
  }, [cloudSessionExpired, instance?.mode, ready, user]);
}

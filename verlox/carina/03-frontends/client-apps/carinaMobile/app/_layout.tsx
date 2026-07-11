import '@/widgets/register-widget';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppLockOverlay } from '@/components/AppLockOverlay';
import { useAppLock } from '@/hooks/useAppLock';
import { useDeepLinks } from '@/hooks/useDeepLinks';
import { useLocalModelLifecycle } from '@/hooks/useLocalModelLifecycle';
import { useNotificationSetup } from '@/hooks/useNotificationSetup';
import { AppLockProvider } from '@/store/app-lock-store';
import { AuthProvider } from '@/store/auth-store';
import { colors } from '@/theme/tokens';

function RootShell() {
  useDeepLinks();
  useNotificationSetup();
  useLocalModelLifecycle();
  const { locked, unlock } = useAppLock();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ink },
        }}
      />
      <AppLockOverlay visible={locked} onUnlock={() => void unlock()} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppLockProvider>
        <StatusBar style="light" />
        <RootShell />
      </AppLockProvider>
    </AuthProvider>
  );
}

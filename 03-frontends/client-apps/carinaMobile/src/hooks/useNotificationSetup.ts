import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { configureNotificationHandler, requestNotificationPermission } from '@/lib/notifications';
import { loadNotificationsEnabled } from '@/lib/notification-prefs';
import { usePushRegistration } from './usePushRegistration';
import { useScoutAlertMonitor } from './useScoutAlertMonitor';

function navigateFromNotification(screen: unknown): void {
  if (screen === 'tasks') {
    router.push('/(tabs)/tasks');
    return;
  }
  if (screen === 'trust') {
    router.push('/(tabs)/trust');
  }
}

export function useNotificationSetup(): void {
  usePushRegistration();
  useScoutAlertMonitor();

  useEffect(() => {
    configureNotificationHandler();

    void (async () => {
      const enabled = await loadNotificationsEnabled();
      if (enabled) {
        await requestNotificationPermission();
      }
    })();

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotification(response.notification.request.content.data?.screen);
    });

    return () => {
      responseSub.remove();
    };
  }, []);
}

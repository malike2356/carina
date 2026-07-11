import { useCallback, useEffect, useState } from 'react';
import {
  loadNotificationsEnabled,
  loadRemotePushEnabled,
  loadScoutAlertsEnabled,
  saveNotificationsEnabled,
  saveRemotePushEnabled,
  saveScoutAlertsEnabled,
} from '@/lib/notification-prefs';
import { requestNotificationPermission } from '@/lib/notifications';
import { resyncPushFromPrefs } from '@/lib/push-registration';
import { useAuth } from '@/store/auth-store';

export function useNotificationPrefs() {
  const { instance, user } = useAuth();
  const [taskEnabled, setTaskEnabled] = useState(true);
  const [scoutEnabled, setScoutEnabled] = useState(true);
  const [remoteEnabled, setRemoteEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [tasks, scout, remote] = await Promise.all([
      loadNotificationsEnabled(),
      loadScoutAlertsEnabled(),
      loadRemotePushEnabled(),
    ]);
    setTaskEnabled(tasks);
    setScoutEnabled(scout);
    setRemoteEnabled(remote);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ensurePermission = useCallback(async () => {
    return requestNotificationPermission();
  }, []);

  const syncRemoteRegistration = useCallback(async () => {
    if (!user || instance?.mode !== 'cloud' || !instance.baseUrl) return;
    await resyncPushFromPrefs(instance.baseUrl);
  }, [instance?.baseUrl, instance?.mode, user]);

  const toggleTasks = useCallback(async (next: boolean) => {
    if (next) {
      const granted = await ensurePermission();
      if (!granted) return false;
    }
    await saveNotificationsEnabled(next);
    setTaskEnabled(next);
    await syncRemoteRegistration();
    return true;
  }, [ensurePermission, syncRemoteRegistration]);

  const toggleScout = useCallback(async (next: boolean) => {
    if (next) {
      const granted = await ensurePermission();
      if (!granted) return false;
    }
    await saveScoutAlertsEnabled(next);
    setScoutEnabled(next);
    await syncRemoteRegistration();
    return true;
  }, [ensurePermission, syncRemoteRegistration]);

  const toggleRemote = useCallback(async (next: boolean) => {
    if (next) {
      const granted = await ensurePermission();
      if (!granted) return false;
    }
    await saveRemotePushEnabled(next);
    setRemoteEnabled(next);
    await syncRemoteRegistration();
    return true;
  }, [ensurePermission, syncRemoteRegistration]);

  return {
    taskEnabled,
    scoutEnabled,
    remoteEnabled,
    loading,
    toggleTasks,
    toggleScout,
    toggleRemote,
    refresh,
    enabled: taskEnabled,
    toggle: toggleTasks,
  };
}

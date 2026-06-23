import { useEffect, useState } from 'react';
import { useAuth } from '@/store/auth-store';

export interface MobileLauncherUser {
  firstName: string;
  email: string;
  role: string;
}

export function useLauncherUser(): { user: MobileLauncherUser | null } {
  const { user, instance } = useAuth();
  const [launcherUser, setLauncherUser] = useState<MobileLauncherUser | null>(null);

  useEffect(() => {
    if (user) {
      const nameParts = ((user as { name?: string }).name ?? user.email ?? '').split(/\s+/);
      setLauncherUser({
        firstName: nameParts[0] ?? 'there',
        email: user.email ?? '',
        role: 'Owner',
      });
    } else if (instance?.baseUrl) {
      fetch(`${instance.baseUrl}/api/cloud/launcher/me`, {
        headers: { Authorization: `Bearer ${(instance as { token?: string }).token ?? ''}` },
      })
        .then(r => r.json())
        .then((d: { firstName?: string; email?: string }) => {
          setLauncherUser({
            firstName: d.firstName ?? 'there',
            email: d.email ?? '',
            role: 'Owner',
          });
        })
        .catch(() => {});
    }
  }, [user, instance]);

  return { user: launcherUser };
}

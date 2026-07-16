import { useEffect, useState } from 'react';
import type { LauncherUser } from '../lib/types/launcher';

export function useCurrentUser() {
  const [user, setUser] = useState<LauncherUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cloud/launcher/me', {
      headers: { Authorization: `Bearer ${localStorage.getItem('carina_cloud_token') ?? ''}` },
    })
      .then(r => r.json())
      .then((d: LauncherUser) => { setUser(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { user, loading };
}

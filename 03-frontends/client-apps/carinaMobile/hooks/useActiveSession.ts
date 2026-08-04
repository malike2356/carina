import { useEffect, useState } from 'react';
import { useAuth } from '@/store/auth-store';

interface ActiveSession {
  id: string;
}

export function useActiveSession() {
  const { instance } = useAuth();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instance?.baseUrl) {
      setLoading(false);
      return;
    }

    const token = (instance as { token?: string }).token ?? '';
    fetch(`${instance.baseUrl}/api/cloud/launcher/session/active`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : { session: null }))
      .then((data: { session: ActiveSession | null }) => {
        setSession(data.session ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [instance]);

  return { session, loading };
}

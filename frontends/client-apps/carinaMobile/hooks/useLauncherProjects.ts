import { useEffect, useState } from 'react';
import { useAuth } from '@/store/auth-store';

export interface MobileProject {
  id: string;
  name: string;
  workspaceType: string;
  color: string;
  lastActivityAgo: string;
}

export function useLauncherProjects(limit = 3) {
  const { instance } = useAuth();
  const [projects, setProjects] = useState<MobileProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instance?.baseUrl) { setLoading(false); return; }
    fetch(`${instance.baseUrl}/api/cloud/launcher/projects/recent?limit=${limit}`, {
      headers: { Authorization: `Bearer ${(instance as { token?: string }).token ?? ''}` },
    })
      .then(r => r.json())
      .then((d: { projects: MobileProject[] }) => {
        setProjects(d.projects ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [instance, limit]);

  return { projects, loading };
}

import { useEffect, useState } from 'react';
import type { LauncherProject } from '../lib/types/launcher';

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('carina_cloud_token') ?? ''}` };
}

export function useRecentProjects(limit = 3) {
  const [recentProjects, setRecentProjects] = useState<LauncherProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/cloud/launcher/projects/recent?limit=${limit}`, { headers: authHeader() })
      .then(r => r.json())
      .then((d: { projects: LauncherProject[] }) => {
        setRecentProjects(d.projects ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [limit]);

  return { recentProjects, loading };
}

import { useEffect, useState } from 'react';

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('carina_cloud_token') ?? ''}` };
}

export function useProjects() {
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetch('/api/cloud/launcher/projects', { headers: authHeader() })
      .then(r => r.json())
      .then((d: { total: number }) => setTotalCount(d.total ?? 0))
      .catch(() => {});
  }, []);

  return { totalCount };
}

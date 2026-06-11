import { useCallback, useEffect, useState } from 'react';
import type { ChatSessionMeta } from '@/api/types';
import { reconcileSessionIndex } from '@/lib/session-registry';

export function useSessionIndex() {
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSessions(await reconcileSessionIndex());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { sessions, loading, reload };
}

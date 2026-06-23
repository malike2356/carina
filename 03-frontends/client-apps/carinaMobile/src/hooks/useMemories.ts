import { useCallback, useState } from 'react';
import { deleteMemory, listMemories, updateMemory } from '@/api/memory-client';
import type { EpisodicMemory } from '@/api/types';
import { useAuth } from '@/store/auth-store';

export function useMemories() {
  const { instance, gatewayAuth } = useAuth();
  const [entries, setEntries] = useState<EpisodicMemory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(
    async (nextPage = page, q = query) => {
      if (!instance?.baseUrl) return;
      setLoading(true);
      setError(null);
      try {
        const result = await listMemories(instance.baseUrl, {
          page: nextPage,
          q: q || undefined,
          auth: gatewayAuth ?? undefined,
        });
        setEntries(result.entries);
        setPage(result.page);
        setTotalPages(result.total_pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [gatewayAuth, instance?.baseUrl, page, query],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!instance?.baseUrl) return;
      await deleteMemory(instance.baseUrl, id, gatewayAuth ?? undefined);
      await refresh(page, query);
    },
    [gatewayAuth, instance?.baseUrl, page, query, refresh],
  );

  const search = useCallback(
    async (q: string) => {
      setQuery(q);
      await refresh(1, q);
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, content: string) => {
      if (!instance?.baseUrl) return false;
      setSaving(true);
      setError(null);
      try {
        await updateMemory(instance.baseUrl, id, content, gatewayAuth ?? undefined);
        await refresh(page, query);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [gatewayAuth, instance?.baseUrl, page, query, refresh],
  );

  return { entries, loading, saving, error, page, totalPages, query, refresh, remove, search, update };
}

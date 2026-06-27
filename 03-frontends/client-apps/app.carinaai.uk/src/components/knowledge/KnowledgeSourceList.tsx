'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';

interface RagSource {
  source: string;
  pack: string;
  ingestedAt: string;
  chunkCount: number;
}

interface SourcesResponse {
  sources: RagSource[];
  total: number;
  page: number;
  limit: number;
}

interface KnowledgeSourceListProps {
  refreshTrigger?: number;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function KnowledgeSourceList({ refreshTrigger }: KnowledgeSourceListProps) {
  const { push: toast } = useToast();
  const [sources, setSources] = useState<RagSource[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/knowledge/sources?page=${p}&limit=${limit}`);
      if (!res.ok) return;
      const data = (await res.json()) as SourcesResponse;
      setSources(data.sources ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // fetch failed silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page, refreshTrigger]);

  async function handleDelete(source: string) {
    setDeleting(source);
    setConfirmDelete(null);
    try {
      const res = await fetch('/api/knowledge/sources', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        toast(body.error ?? 'Delete failed', 'error');
        return;
      }
      const data = (await res.json()) as { deleted: number };
      toast(`Deleted ${data.deleted} chunk${data.deleted !== 1 ? 's' : ''}.`, 'success');
      await load(page);
    } catch {
      toast('Delete failed', 'error');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Ingested Sources</h2>
          <p className="mt-0.5 text-xs text-text-muted">{total} source{total !== 1 ? 's' : ''} in the knowledge base</p>
        </div>
        <button
          onClick={() => void load(page)}
          className="rounded p-1 text-text-muted hover:text-text-secondary"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : sources.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-text-muted">No sources ingested yet.</p>
          <p className="mt-1 text-xs text-text-muted">Upload a file, paste text, or add a URL above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/40">
                <th className="px-5 py-2.5 text-left text-xs font-medium text-text-muted">Source</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-text-muted">Pack</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-text-muted">Chunks</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-text-muted">Ingested</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.source} className="border-b border-border last:border-0">
                  <td className="max-w-xs truncate px-5 py-3 font-mono text-xs text-text-secondary">
                    {s.source}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-text-muted">
                      {s.pack}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-text-secondary">{s.chunkCount}</td>
                  <td className="px-3 py-3 text-xs text-text-muted">{formatDate(s.ingestedAt)}</td>
                  <td className="px-3 py-3">
                    {confirmDelete === s.source ? (
                      <span className="flex items-center gap-2 text-xs">
                        <span className="text-text-muted">Delete {s.chunkCount} chunks?</span>
                        <button
                          onClick={() => void handleDelete(s.source)}
                          disabled={deleting === s.source}
                          className="text-red-400 hover:text-red-300"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-text-muted hover:text-text-secondary"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(s.source)}
                        disabled={deleting === s.source}
                        className="rounded p-1 text-text-muted hover:text-red-400 disabled:opacity-40"
                        title="Delete source"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-xs text-text-muted hover:text-text-secondary disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-xs text-text-muted hover:text-text-secondary disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

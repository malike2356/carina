'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type MetaPage = {
  id: string;
  name: string;
  instagramBusinessAccountId?: string;
};

type Props = {
  workerId: string;
  connectToken: string;
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
};

export function MetaPagePickerModal({
  workerId,
  connectToken,
  open,
  onClose,
  onConnected,
}: Props) {
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [enableInstagram, setEnableInstagram] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !connectToken) return;
    setLoading(true);
    setError('');
    void fetch(`/api/aiva/social/oauth/meta/pages?connectToken=${encodeURIComponent(connectToken)}`)
      .then(async (res) => {
        const data = (await res.json()) as { pages?: MetaPage[]; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? 'Could not load Meta pages');
        }
        setPages(data.pages ?? []);
        setSelectedPageId(data.pages?.[0]?.id ?? '');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load Meta pages');
      })
      .finally(() => setLoading(false));
  }, [open, connectToken]);

  if (!open) return null;

  const selectedPage = pages.find((page) => page.id === selectedPageId);

  async function connect() {
    if (!selectedPageId) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/aiva/social/oauth/meta/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          connectToken,
          pageId: selectedPageId,
          enableInstagram: Boolean(enableInstagram && selectedPage?.instagramBusinessAccountId),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'Could not connect Meta page');
        return;
      }
      onConnected();
      onClose();
    } catch {
      setError('Could not connect Meta page');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-elevated p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Connect Meta page</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </div>
        <p className="mb-4 text-xs text-text-muted">
          Choose the Facebook Page inbox this Aiva should handle. Instagram DMs can be enabled when the Page has a linked business account.
        </p>
        {loading ? (
          <p className="text-sm text-text-muted">Loading pages...</p>
        ) : pages.length === 0 ? (
          <p className="text-sm text-text-muted">No managed Pages were returned for this Meta account.</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-text-primary">Facebook Page</label>
            <select
              value={selectedPageId}
              onChange={(event) => setSelectedPageId(event.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.name}
                </option>
              ))}
            </select>
            {selectedPage?.instagramBusinessAccountId ? (
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={enableInstagram}
                  onChange={(event) => setEnableInstagram(event.target.checked)}
                />
                Also connect Instagram DMs for this Page
              </label>
            ) : (
              <p className="text-xs text-text-muted">This Page has no linked Instagram business account.</p>
            )}
          </div>
        )}
        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
        <button
          type="button"
          disabled={pending || loading || !selectedPageId}
          onClick={() => void connect()}
          className={cn('btn-primary mt-4 w-full py-2 text-sm', pending && 'opacity-70')}
        >
          {pending ? 'Connecting...' : 'Connect selected Page'}
        </button>
      </div>
    </div>
  );
}

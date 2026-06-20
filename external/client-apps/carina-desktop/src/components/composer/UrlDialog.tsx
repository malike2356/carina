import { useState, type FormEvent } from 'react';
import { fetchUrlMetadata } from '../../lib/gateway-client.js';
import type { Attachment } from '../../lib/composer-types.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (attachment: Attachment) => void;
}

export default function UrlDialog({ open, onClose, onAdd }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const meta = await fetchUrlMetadata(trimmed);
      onAdd({
        kind: 'url',
        id: `url-${Date.now()}`,
        url: meta.url,
        title: meta.title,
        description: meta.description,
        favicon: meta.favicon,
      });
      setUrl('');
      onClose();
    } catch {
      setError('Could not fetch URL metadata');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
      >
        <h2 className="text-sm font-semibold text-zinc-100">Attach URL</h2>
        <p className="mt-1 text-xs text-zinc-400">Paste a link to include as an attachment preview.</p>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com"
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          autoFocus
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {loading ? 'Fetching...' : 'Add URL'}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Pin, Plus, Trash2 } from 'lucide-react';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';

type Memory = {
  id: string;
  kind: string;
  content: string;
  pinned: boolean;
};

export function AivaWorkerMemoriesPanel({ workerId }: { workerId: string }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/aiva/workers/${workerId}/memories`);
    const data = (await res.json()) as { memories?: Memory[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? 'Could not load memories');
      return;
    }
    setMemories(data.memories ?? []);
  }

  useEffect(() => {
    void load();
  }, [workerId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, pinned: true, kind: 'preference' }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not save memory');
        return;
      }
      setContent('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/aiva/workers/${workerId}/memories/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Pinned memories</h3>
        <p className="mt-1 text-sm text-text-muted">
          Preferences injected into this worker&apos;s prompt on every turn.
        </p>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <ul className="space-y-2">
        {memories.map((memory) => (
          <li
            key={memory.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border bg-elevated px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-text-primary">{memory.content}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-text-muted">
                {memory.pinned ? <Pin className="h-3 w-3" /> : null}
                {memory.kind}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void remove(memory.id)}
              className="rounded-lg p-2 text-text-muted hover:text-danger"
              aria-label="Delete memory"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => void add(e)} className="flex flex-wrap gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="e.g. Prefer concise replies and UK spelling"
          className={AIVA_INPUT_CLASS}
          required
        />
        <button type="submit" disabled={busy} className="btn-primary inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" />
          Pin memory
        </button>
      </form>
    </section>
  );
}

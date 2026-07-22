'use client';

import { useEffect, useState } from 'react';
import type { AivaWorker } from '@/lib/aiva-types';
import { cn } from '@/lib/utils';

/** Default off: missing config means text replies unless audio is requested. */
export function isPreferVoiceRepliesOn(worker: AivaWorker): boolean {
  return worker.workerConfig?.telegram?.preferVoiceReplies === true;
}

export function TelegramVoicePreferenceToggle({
  worker,
  onWorkerUpdate,
  compact,
  embedded,
}: {
  worker: AivaWorker;
  onWorkerUpdate: (worker: AivaWorker) => void;
  compact?: boolean;
  /** Inside a parent SettingsCard: no extra border box. */
  embedded?: boolean;
}) {
  const [enabled, setEnabled] = useState(isPreferVoiceRepliesOn(worker));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(isPreferVoiceRepliesOn(worker));
  }, [worker]);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/aiva/workers/${worker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerConfig: {
            telegram: { preferVoiceReplies: next },
          },
        }),
      });
      if (!res.ok) {
        setEnabled(!next);
        return;
      }
      const data = (await res.json()) as { worker?: AivaWorker };
      if (data.worker) onWorkerUpdate(data.worker);
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  }

  const body = (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={enabled}
        disabled={saving}
        onChange={() => void toggle()}
        className="mt-1"
      />
      <span>
        <span className="block text-sm font-medium text-text-primary">
          Prefer voice replies
        </span>
        <span className="mt-0.5 block text-xs text-text-muted">
          On Telegram, longer answers and asks like summarise, tell me, or read me
          are sent as voice when this is enabled. Text replies remain the default.
        </span>
      </span>
    </label>
  );

  if (embedded) return body;

  return (
    <div
      className={cn(
        compact
          ? 'rounded-lg border border-border bg-overlay/40 px-3 py-2.5'
          : 'rounded-xl border border-border bg-elevated px-4 py-3',
      )}
    >
      {body}
    </div>
  );
}

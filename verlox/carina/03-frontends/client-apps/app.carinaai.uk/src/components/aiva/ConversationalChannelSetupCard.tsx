'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, LockKeyhole, X } from 'lucide-react';
import type { ConversationalChannelSetup } from '@/lib/conversational-channel-setup';
import { cn } from '@/lib/utils';

type Props = {
  workerId: string;
  setup: ConversationalChannelSetup;
  onCancel: () => void;
  onComplete: (message: string) => void;
};

export function ConversationalChannelSetupCard({ workerId, setup, onCancel, onComplete }: Props) {
  const [fieldIndex, setFieldIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [value, setValue] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const field = setup.fields[fieldIndex];
  const isLast = fieldIndex >= setup.fields.length - 1;

  async function connect(credentials: Record<string, string>) {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, channel: setup.channel, credentials }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `Could not connect ${setup.label}`);
      onComplete(`${setup.label} is connected. Your credentials were encrypted and were not added to this chat.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not connect ${setup.label}`);
    } finally {
      setPending(false);
    }
  }

  async function submitCurrent(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!field.optional && !trimmed) return;
    const nextValues = trimmed ? { ...values, [field.key]: trimmed } : values;
    if (isLast) return connect(nextValues);
    setValues(nextValues);
    setValue('');
    setShowSecret(false);
    setError('');
    setFieldIndex((current) => current + 1);
  }

  if (!field) {
    return (
      <div className="mr-auto max-w-[min(92%,30rem)] rounded-xl border border-accent/30 bg-accent/5 p-3">
        <p className="text-sm font-medium text-text-primary">Connect {setup.label}?</p>
        <p className="mt-1 text-xs text-text-secondary">This connection does not require credentials.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={pending} onClick={() => void connect({})} className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-60">
            {pending ? 'Connecting...' : `Connect ${setup.label}`}
          </button>
          <button type="button" onClick={onCancel} className="px-2 text-xs text-text-muted">Cancel</button>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mr-auto max-w-[min(92%,30rem)] rounded-xl border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-lg bg-accent/10 p-1.5 text-accent"><LockKeyhole className="h-4 w-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">Connect {setup.label}</p>
          <p className="mt-0.5 text-xs text-text-muted">Secure step {fieldIndex + 1} of {setup.fields.length}</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Cancel setup" className="text-text-muted"><X className="h-4 w-4" /></button>
      </div>
      <form onSubmit={(event) => void submitCurrent(event)} className="mt-3">
        <label className="text-sm font-medium text-text-primary" htmlFor={`setup-${field.key}`}>{field.label}{field.optional ? ' (optional)' : ''}</label>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{field.help}</p>
        <div className="relative mt-2">
          <input
            id={`setup-${field.key}`}
            type={field.sensitive && !showSecret ? 'password' : 'text'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={field.placeholder}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            className={cn('w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15', field.sensitive && 'pr-10')}
          />
          {field.sensitive ? (
            <button type="button" onClick={() => setShowSecret((current) => !current)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-muted" aria-label={showSecret ? 'Hide value' : 'Show value'}>
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
        {field.sensitive ? <p className="mt-1.5 flex items-center gap-1 text-[11px] text-text-muted"><Check className="h-3 w-3 text-success" aria-hidden />This value goes directly to encrypted storage and is not sent to Aiva.</p> : null}
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        <button type="submit" disabled={pending || (!field.optional && !value.trim())} className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? 'Connecting...' : isLast ? `Connect ${setup.label}` : 'Continue'}
        </button>
      </form>
    </div>
  );
}

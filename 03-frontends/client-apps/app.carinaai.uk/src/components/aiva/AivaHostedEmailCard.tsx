'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

type HostedEmailState = {
  address: string;
  status: string;
};

async function fetchHostedEmail(workerId: string): Promise<HostedEmailState | null> {
  const res = await fetch(`/api/aiva/workers/${encodeURIComponent(workerId)}/email-address`);
  const json = (await res.json().catch(() => ({}))) as {
    address?: string;
    status?: string;
    error?: string;
  };
  if (!res.ok || !json.address) return null;
  return {
    address: json.address,
    status: json.status ?? 'active',
  };
}

export function useHostedEmailAddress(workerId: string | null) {
  const [data, setData] = useState<HostedEmailState | null>(null);
  const [loading, setLoading] = useState(Boolean(workerId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workerId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let next = await fetchHostedEmail(workerId);
      // Hosted address can lag a beat after hire.
      if (!next) {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        next = await fetchHostedEmail(workerId);
      }
      if (!next) {
        setError('Email address not available yet. Open your Aiva to find it under Channels.');
        setData(null);
        return;
      }
      setData(next);
    } catch {
      setError('Unable to load email address');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

type AivaHostedEmailCardProps = {
  workerId: string;
  workerName?: string;
  className?: string;
  emphasize?: boolean;
  compact?: boolean;
};

export function AivaHostedEmailCard({
  workerId,
  workerName,
  className,
  emphasize = false,
  compact = false,
}: AivaHostedEmailCardProps) {
  const { data, loading, error } = useHostedEmailAddress(workerId);
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    if (!data?.address) return;
    try {
      await navigator.clipboard.writeText(data.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard failures; address stays visible to select manually.
    }
  }

  const subject = workerName
    ? encodeURIComponent(`Hello ${workerName}`)
    : encodeURIComponent('Hello');
  const mailto = data?.address
    ? `mailto:${data.address}?subject=${subject}`
    : null;

  if (compact) {
    if (loading) {
      return (
        <div className={cn('rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-text-muted', className)}>
          Loading email address...
        </div>
      );
    }
    if (!data?.address) {
      return error ? (
        <div className={cn('rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-danger', className)}>
          {error}
        </div>
      ) : null;
    }
    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/5 px-3 py-2',
          className,
        )}
      >
        <Mail className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <span className="min-w-0 flex-1 break-all font-mono text-xs text-text-primary">
          {data.address}
        </span>
        <button
          type="button"
          onClick={() => void copyAddress()}
          className="btn-ghost inline-flex items-center gap-1 text-[11px]"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        {mailto ? (
          <a href={mailto} className="btn-ghost inline-flex items-center gap-1 text-[11px]">
            <ExternalLink className="h-3 w-3" />
            Email
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-elevated p-4',
        emphasize && 'border-amber-400/50 bg-amber-500/5',
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">
            {workerName ? `${workerName}'s email` : 'Email address'}
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            Send tasks, messages, PDFs, or instructions here.
            {workerName ? ` ${workerName} can reply to that thread.` : ' Your Aiva can reply to that thread.'}
          </p>
        </div>
        {data ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
              data.status === 'active'
                ? 'bg-green-500/15 text-green-800 dark:text-green-300'
                : 'bg-overlay text-text-muted',
            )}
          >
            {data.status}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-xs text-text-muted">Loading address...</p>
      ) : error && !data ? (
        <p className="text-xs text-danger">{error}</p>
      ) : data ? (
        <>
          <div className="mb-3 break-all rounded-md border border-border bg-base px-3 py-2 font-mono text-sm text-text-primary">
            <span className="inline-flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
              <span className="min-w-0 flex-1">{data.address}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="btn-ghost inline-flex items-center gap-1.5 text-xs"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy address'}
            </button>
            {mailto ? (
              <a
                href={mailto}
                className="btn-ghost inline-flex items-center gap-1.5 text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in email app
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

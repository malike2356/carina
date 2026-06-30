'use client';

import { useState, type FormEvent } from 'react';
import { ExternalLink, Mail } from 'lucide-react';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type Props = {
  workerId: string;
  onConnected: () => void;
  onClose: () => void;
};

type Provider = 'gmail' | 'outlook';
type Mode = 'choice' | 'webhook';

export function EmailConnectOptions({ workerId, onConnected, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('choice');
  const [fromAddress, setFromAddress] = useState('');
  const [pending, setPending] = useState<Provider | 'webhook' | null>(null);
  const [error, setError] = useState('');

  async function connectViaOAuth(provider: Provider) {
    setPending(provider);
    setError('');
    try {
      const response = await fetch(
        `/api/aiva/email/oauth/${provider}/auth-url?workerId=${encodeURIComponent(workerId)}`,
      );
      const data = (await response.json()) as { authUrl?: string; error?: string };
      if (!response.ok || !data.authUrl) {
        setError(data.error ?? `Could not start ${provider} connection`);
        return;
      }
      window.location.href = data.authUrl;
    } catch {
      setError('Could not reach server');
    } finally {
      setPending(null);
    }
  }

  async function connectViaWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending('webhook');
    setError('');
    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          channel: 'email',
          credentials: fromAddress.trim() ? { from_address: fromAddress.trim() } : {},
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'Could not connect channel');
        return;
      }
      onConnected();
      onClose();
    } catch {
      setError('Could not connect channel');
    } finally {
      setPending(null);
    }
  }

  if (mode === 'webhook') {
    return (
      <form onSubmit={(event) => void connectViaWebhook(event)} className="space-y-4">
        <p className="text-xs text-text-muted">
          Use inbound forwarding for Zoho, Fastmail, custom IMAP, or another provider.
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-primary">
            Inbound address (optional)
          </label>
          <input
            className={AIVA_INPUT_CLASS}
            placeholder="Auto-generated if empty"
            value={fromAddress}
            onChange={(event) => setFromAddress(event.target.value)}
          />
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('choice')}
            className="btn-ghost flex-1 py-2 text-sm"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={pending === 'webhook'}
            className={cn('btn-primary flex-1 py-2 text-sm', pending === 'webhook' && 'opacity-70')}
          >
            {pending === 'webhook' ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        Choose how this Aiva should receive email.
      </p>
      <OAuthButton
        title={pending === 'gmail' ? 'Redirecting...' : 'Connect Gmail'}
        description="Sign in with Google. No mailbox password stored."
        iconClassName="text-red-400"
        disabled={pending === 'gmail'}
        onClick={() => void connectViaOAuth('gmail')}
      />
      <OAuthButton
        title={pending === 'outlook' ? 'Redirecting...' : 'Connect Outlook / Microsoft 365'}
        description="Works with Outlook.com and Microsoft 365 mailboxes."
        iconClassName="text-blue-400"
        disabled={pending === 'outlook'}
        onClick={() => void connectViaOAuth('outlook')}
      />
      <button
        type="button"
        onClick={() => setMode('webhook')}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm hover:bg-muted"
      >
        <Mail className="h-4 w-4 shrink-0 text-text-muted" />
        <div>
          <p className="font-medium text-text-primary">Other email provider</p>
          <p className="text-xs text-text-muted">Zoho, Fastmail, custom IMAP, or inbound forwarding.</p>
        </div>
      </button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

function OAuthButton({
  title,
  description,
  iconClassName,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  iconClassName: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm hover:bg-muted disabled:opacity-60"
    >
      <Mail className={cn('h-4 w-4 shrink-0', iconClassName)} />
      <div>
        <p className="font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <ExternalLink className="ml-auto h-3 w-3 text-text-muted" />
    </button>
  );
}

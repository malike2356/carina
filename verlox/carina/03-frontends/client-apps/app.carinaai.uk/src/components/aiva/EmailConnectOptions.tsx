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
type Mode = 'choice' | 'webhook' | 'imap';

export function EmailConnectOptions({ workerId, onConnected, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('choice');
  const [fromAddress, setFromAddress] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<Provider | 'webhook' | 'imap' | null>(null);
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

  async function connectViaImap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending('imap');
    setError('');
    try {
      const response = await fetch('/api/aiva/email/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          imapHost: imapHost.trim(),
          imapPort: Number(imapPort) || 993,
          imapTls: true,
          username: username.trim(),
          password,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'IMAP connection failed');
        return;
      }
      onConnected();
      onClose();
    } catch {
      setError('Could not connect IMAP');
    } finally {
      setPending(null);
    }
  }

  if (mode === 'imap') {
    return (
      <form onSubmit={(event) => void connectViaImap(event)} className="space-y-3">
        <p className="text-xs text-text-muted">
          Direct IMAP. Use this when Gmail/Outlook OAuth is not configured. Then add client
          senders on the Channels tab.
        </p>
        <input
          className={AIVA_INPUT_CLASS}
          placeholder="IMAP host (imap.example.com)"
          value={imapHost}
          onChange={(event) => setImapHost(event.target.value)}
          required
        />
        <input
          className={AIVA_INPUT_CLASS}
          placeholder="Port"
          value={imapPort}
          onChange={(event) => setImapPort(event.target.value)}
          inputMode="numeric"
        />
        <input
          className={AIVA_INPUT_CLASS}
          placeholder="Username / email"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
        <input
          className={AIVA_INPUT_CLASS}
          placeholder="Password / app password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('choice')}
            className="btn-ghost min-h-11 flex-1 py-2 text-sm"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={pending === 'imap'}
            className={cn('btn-primary min-h-11 flex-1 py-2 text-sm', pending === 'imap' && 'opacity-70')}
          >
            {pending === 'imap' ? 'Testing...' : 'Connect IMAP'}
          </button>
        </div>
      </form>
    );
  }

  if (mode === 'webhook') {
    return (
      <form onSubmit={(event) => void connectViaWebhook(event)} className="space-y-4">
        <p className="text-xs text-text-muted">
          Use inbound forwarding for Zoho, Fastmail, or another provider that can forward to Carina.
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
            className="btn-ghost min-h-11 flex-1 py-2 text-sm"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={pending === 'webhook'}
            className={cn('btn-primary min-h-11 flex-1 py-2 text-sm', pending === 'webhook' && 'opacity-70')}
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
        onClick={() => setMode('imap')}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm hover:bg-overlay"
      >
        <Mail className="h-5 w-5 shrink-0 text-text-muted" />
        <div>
          <p className="font-medium text-text-primary">IMAP (username + password)</p>
          <p className="text-xs text-text-muted">Best path when OAuth is not configured on the server.</p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => setMode('webhook')}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm hover:bg-overlay"
      >
        <Mail className="h-5 w-5 shrink-0 text-text-muted" />
        <div>
          <p className="font-medium text-text-primary">Inbound forwarding</p>
          <p className="text-xs text-text-muted">Forward mail into a Carina address.</p>
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
      className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm hover:bg-overlay disabled:opacity-60"
    >
      <Mail className={cn('h-5 w-5 shrink-0', iconClassName)} />
      <div>
        <p className="font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <ExternalLink className="ml-auto h-3 w-3 text-text-muted" />
    </button>
  );
}

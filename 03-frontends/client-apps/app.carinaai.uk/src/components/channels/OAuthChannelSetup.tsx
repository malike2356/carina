'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { EmailConnectOptions } from '@/components/aiva/EmailConnectOptions';
import type { ChannelSetupProps } from '@/components/channels/channel-setup-types';
import { connectWorkerChannel } from '@/lib/channel-connect';
import { cn } from '@/lib/utils';

type OAuthChannelSetupProps = ChannelSetupProps & {
  channelType: 'email' | 'whatsapp' | 'slack';
};

const TOKEN_FIELDS: Record<
  'whatsapp' | 'slack',
  Array<{ key: string; label: string; placeholder: string; secret?: boolean }>
> = {
  whatsapp: [
    { key: 'access_token', label: 'Access token', placeholder: 'Permanent system user token', secret: true },
    { key: 'phone_number_id', label: 'Phone number ID', placeholder: 'From Meta WhatsApp dashboard' },
  ],
  slack: [
    { key: 'bot_token', label: 'Bot token', placeholder: 'xoxb-...', secret: true },
    { key: 'team_id', label: 'Team ID', placeholder: 'T...' },
  ],
};

export function OAuthChannelSetup({
  workerId,
  channelType,
  channelLabel,
  onComplete,
  onCancel,
}: OAuthChannelSetupProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  if (channelType === 'email') {
    return (
      <EmailConnectOptions
        workerId={workerId}
        onConnected={onComplete}
        onClose={onCancel ?? onComplete}
      />
    );
  }

  async function startOAuth() {
    setPending(true);
    setError('');
    try {
      const params = new URLSearchParams({ workerId });
      if (channelType === 'whatsapp') params.set('channel', 'whatsapp');
      const provider = channelType === 'whatsapp' ? 'meta' : 'slack';
      const response = await fetch(`/api/aiva/social/oauth/${provider}/auth-url?${params}`);
      const data = (await response.json()) as { authUrl?: string; error?: string; code?: string };
      if (!response.ok || !data.authUrl) {
        if (data.code === 'NOT_IMPLEMENTED' || response.status === 501 || response.status === 503) {
          setShowManual(true);
        } else {
          setError(data.error ?? `Could not start ${channelLabel} connection`);
        }
        return;
      }
      window.location.href = data.authUrl;
    } catch {
      setError('Could not reach server');
    } finally {
      setPending(false);
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (channelType !== 'whatsapp' && channelType !== 'slack') return;
    setPending(true);
    setError('');
    const credentials: Record<string, string> = {};
    for (const field of TOKEN_FIELDS[channelType]) {
      const value = values[field.key]?.trim();
      if (value) credentials[field.key] = value;
    }
    const result = await connectWorkerChannel(workerId, channelType, credentials);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onComplete();
  }

  const oauthLabel = channelType === 'whatsapp' ? 'Connect WhatsApp' : 'Connect Slack';

  if (showManual) {
    return (
      <form onSubmit={(e) => void submitManual(e)} className="space-y-3">
        {TOKEN_FIELDS[channelType].map((field) => (
          <div key={field.key} className="form-group">
            <label className="text-xs font-medium text-text-primary">{field.label}</label>
            <input
              type={field.secret ? 'password' : 'text'}
              value={values[field.key] ?? ''}
              onChange={(ev) => setValues({ ...values, [field.key]: ev.target.value })}
              placeholder={field.placeholder}
              className="form-input"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setShowManual(false)}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          Back to OAuth
        </button>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className={cn('btn-primary mobile-btn w-full', pending && 'opacity-70')}
        >
          {pending ? 'Connecting...' : `Connect ${channelLabel}`}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        {channelType === 'whatsapp'
          ? 'Connect your WhatsApp Business account. Your Aiva will reply to messages automatically.'
          : 'Connect your Slack workspace. Your Aiva will reply to direct messages.'}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => void startOAuth()}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm hover:bg-elevated disabled:opacity-60"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-primary">
            {pending ? 'Redirecting...' : oauthLabel}
          </p>
          <p className="text-xs text-text-muted">
            You will be redirected to authorize. We never see your password.
          </p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-text-muted" />
      </button>
      <button
        type="button"
        onClick={() => setShowManual(true)}
        className="text-xs text-text-muted hover:text-text-primary"
      >
        Enter credentials manually
      </button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

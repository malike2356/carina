'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { GuideMeLink } from '@/components/integrations/GuideMeLink';
import { guideIdForChannel } from '@/lib/integration-guides';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import {
  isSocialChannelId,
  socialChannelLabel,
  socialOAuthProvider,
} from '@/lib/social-channels';
import { cn } from '@/lib/utils';

type Props = {
  workerId: string;
  channelType: string;
  onConnected: () => void;
  onClose: () => void;
};

const MANUAL_FIELDS: Record<string, Array<{ key: string; label: string; secret?: boolean }>> = {
  linkedin: [
    { key: 'access_token', label: 'Access token', secret: true },
    { key: 'refresh_token', label: 'Refresh token', secret: true },
    { key: 'member_id', label: 'Member ID' },
    { key: 'webhook_secret', label: 'Webhook secret', secret: true },
  ],
  instagram: [
    { key: 'page_access_token', label: 'Page access token', secret: true },
    { key: 'instagram_business_account_id', label: 'Instagram business account ID' },
    { key: 'verify_token', label: 'Verify token', secret: true },
  ],
  messenger: [
    { key: 'page_access_token', label: 'Page access token', secret: true },
    { key: 'page_id', label: 'Page ID' },
    { key: 'verify_token', label: 'Verify token', secret: true },
  ],
  twitter: [
    { key: 'access_token', label: 'Access token', secret: true },
    { key: 'access_token_secret', label: 'Access token secret', secret: true },
    { key: 'user_id', label: 'User ID' },
  ],
  tiktok: [
    { key: 'access_token', label: 'Access token', secret: true },
    { key: 'open_id', label: 'Open ID' },
    { key: 'refresh_token', label: 'Refresh token', secret: true },
  ],
};

export function SocialConnectOptions({ workerId, channelType, onConnected, onClose }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});

  if (!isSocialChannelId(channelType)) {
    return <p className="text-xs text-danger">Unsupported social channel.</p>;
  }

  const provider = socialOAuthProvider(channelType);
  const providerLabel = socialChannelLabel(channelType);
  const socialGuideId = guideIdForChannel(channelType);
  // Always offer manual tokens: production Meta OAuth may be unset (META_APP_ID / SECRET).
  const showAdvanced = true;

  async function connectViaOAuth() {
    if (!provider) return;
    setPending(true);
    setError('');
    try {
      const params = new URLSearchParams({ workerId });
      if (provider === 'meta') params.set('channel', channelType);
      const response = await fetch(
        `/api/aiva/social/oauth/${provider}/auth-url?${params.toString()}`,
      );
      const data = (await response.json()) as { authUrl?: string; error?: string; code?: string };
      if (!response.ok || !data.authUrl) {
        if (data.code === 'NOT_IMPLEMENTED') {
          setError('Social OAuth is not configured yet. Use manual tokens in development or wait for setup.');
        } else {
          setError(data.error ?? `Could not start ${providerLabel} connection`);
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

  async function connectViaManualTokens(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    const credentials: Record<string, string> = {};
    for (const field of MANUAL_FIELDS[channelType] ?? []) {
      const value = manualValues[field.key]?.trim();
      if (value) credentials[field.key] = value;
    }
    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, channel: channelType, credentials }),
      });
      const data = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        if (data.code === 'OAUTH_REQUIRED') {
          setError('OAuth connection required. Add the tokens listed in Advanced.');
        } else {
          setError(data.error ?? 'Could not connect channel');
        }
        return;
      }
      onConnected();
      onClose();
    } catch {
      setError('Could not connect channel');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-muted">
          Messages are drafted in your Aiva voice. You approve before anything is sent.
        </p>
        {socialGuideId ? <GuideMeLink guideId={socialGuideId} /> : null}
      </div>
      {channelType === 'tiktok' ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-text-muted">
          TikTok requires a Business account and TikTok for Business Messaging API approval.
          The channel may show as pending until review completes. See{' '}
          <a
            href="https://core.carinaai.uk/docs/gateways/tiktok"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            TikTok setup guide
          </a>
          .
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => void connectViaOAuth()}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm hover:bg-muted disabled:opacity-60"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-primary">
            {pending ? 'Redirecting...' : `Connect with ${providerLabel}`}
          </p>
          <p className="text-xs text-text-muted">
            Sign in with {providerLabel} to authorize DMs for this Aiva.
          </p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-text-muted" />
      </button>

      {showAdvanced ? (
        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-text-primary"
          >
            Advanced: manual tokens
            {advancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {advancedOpen ? (
            <form onSubmit={(event) => void connectViaManualTokens(event)} className="space-y-3 border-t border-border p-3">
              {(MANUAL_FIELDS[channelType] ?? []).map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-xs font-medium text-text-primary">{field.label}</label>
                  <input
                    type={field.secret ? 'password' : 'text'}
                    value={manualValues[field.key] ?? ''}
                    onChange={(event) => setManualValues({ ...manualValues, [field.key]: event.target.value })}
                    className={AIVA_INPUT_CLASS}
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={pending}
                className={cn('btn-ghost w-full py-2 text-xs', pending && 'opacity-70')}
              >
                Save manual tokens
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

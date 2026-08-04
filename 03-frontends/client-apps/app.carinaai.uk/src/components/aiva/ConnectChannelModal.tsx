'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { EmailConnectOptions } from '@/components/aiva/EmailConnectOptions';
import { SocialConnectOptions } from '@/components/aiva/SocialConnectOptions';
import { GuideMeLink } from '@/components/integrations/GuideMeLink';
import { guideIdForChannel } from '@/lib/integration-guides';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { isSocialChannelId } from '@/lib/social-channels';
import { cn } from '@/lib/utils';

const CHANNEL_FIELDS: Record<
  string,
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
  telegram: [
    { key: 'bot_token', label: 'Bot token', placeholder: 'From @BotFather', secret: true },
  ],
  sms: [
    { key: 'account_sid', label: 'Account SID', placeholder: 'AC...' },
    { key: 'auth_token', label: 'Auth token', placeholder: 'From Twilio console', secret: true },
    { key: 'from_number', label: 'From number', placeholder: '+447700900000' },
  ],
  voice: [
    { key: 'account_sid', label: 'Account SID', placeholder: 'AC...' },
    { key: 'auth_token', label: 'Auth token', placeholder: 'From Twilio console', secret: true },
    { key: 'from_number', label: 'Voice-capable number', placeholder: '+447700900000' },
  ],
  discord: [
    { key: 'bot_token', label: 'Bot token', placeholder: 'From Discord developer portal', secret: true },
  ],
  teams: [
    { key: 'app_id', label: 'Microsoft App ID', placeholder: 'Azure Bot application ID' },
    { key: 'app_password', label: 'Client secret', placeholder: 'Azure client secret', secret: true },
    { key: 'tenant_id', label: 'Tenant ID (optional)', placeholder: 'botframework.com or your tenant UUID' },
  ],
  web: [],
};

type ConnectChannelModalProps = {
  workerId: string;
  channelType: string;
  channelLabel: string;
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
};

export function ConnectChannelModal({
  workerId,
  channelType,
  channelLabel,
  open,
  onClose,
  onConnected,
}: ConnectChannelModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (!open) return null;

  const fields = CHANNEL_FIELDS[channelType] ?? [];
  const isSocial = isSocialChannelId(channelType);
  const channelGuideId = guideIdForChannel(channelType);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');

    const credentials: Record<string, string> = {};
    for (const field of fields) {
      const value = values[field.key]?.trim();
      if (value) credentials[field.key] = value;
    }

    const body: Record<string, unknown> = {
      workerId,
      channel: channelType,
      credentials,
    };
    if (values.identifier?.trim()) {
      body.identifier = values.identifier.trim();
    }

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not connect channel');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-elevated p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Connect {channelLabel}</h2>
          <div className="flex items-center gap-2">
            {channelGuideId ? <GuideMeLink guideId={channelGuideId} /> : null}
            <button type="button" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4 text-text-muted" />
            </button>
          </div>
        </div>
        {channelType === 'email' ? (
          <div className="mb-4 text-xs text-text-muted">
            Connect a mailbox directly with OAuth, or use inbound forwarding for another provider.
          </div>
        ) : isSocial ? (
          <p className="mb-4 text-xs text-text-muted">
            Prefer OAuth when configured. Otherwise open Advanced and paste your Page ID and page
            access token from Meta Business Suite.
          </p>
        ) : (
          <p className="mb-4 text-xs text-text-muted">
            {channelType === 'sms'
              ? 'Use your Twilio account SID, auth token, and SMS-capable from number. Set the Twilio messaging webhook to https://core.carinaai.uk/api/channels/webhook/sms.'
              : channelType === 'voice'
                ? 'Use a voice-capable Twilio number (Account SID, auth token, E.164). In Twilio Console set Voice → A call comes in → Webhook POST to https://core.carinaai.uk/api/channels/webhook/voice. Callers speak turn-by-turn; your Aiva answers with full tools. Outbound Dial from the Call tab uses the same number.'
                : channelType === 'discord'
                  ? 'Enable Message Content Intent on your bot. Carina connects the gateway when you save the bot token.'
                  : channelType === 'teams'
                    ? 'Set your Azure Bot messaging endpoint to https://core.carinaai.uk/api/channels/webhook/teams/{app-id} using the App ID below.'
                    : 'Credentials are encrypted before storage. See CHANNEL-SETUP.md on core for provider steps.'}
          </p>
        )}
        {channelType === 'email' ? (
          <EmailConnectOptions
            workerId={workerId}
            onConnected={onConnected}
            onClose={onClose}
          />
        ) : isSocial ? (
          <SocialConnectOptions
            workerId={workerId}
            channelType={channelType}
            onConnected={onConnected}
            onClose={onClose}
          />
        ) : (
          <form onSubmit={(e) => void submit(e)} className="space-y-3">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-xs font-medium text-text-primary">{field.label}</label>
                <input
                  type={field.secret ? 'password' : 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(ev) => setValues({ ...values, [field.key]: ev.target.value })}
                  placeholder={field.placeholder}
                  className={AIVA_INPUT_CLASS}
                />
              </div>
            ))}
            {channelType === 'web' ? (
              <p className="text-sm text-text-secondary">
                Web chat uses the embed widget. No credentials required; connect enables the widget for this Aiva.
              </p>
            ) : null}
            {error ? <p className="text-xs text-danger">{error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className={cn('btn-primary w-full py-2 text-sm', pending && 'opacity-70')}
            >
              {pending ? 'Connecting...' : 'Connect channel'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

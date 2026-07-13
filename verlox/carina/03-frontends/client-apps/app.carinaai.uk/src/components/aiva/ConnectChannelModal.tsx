'use client';

import { useState } from 'react';
import { EmailConnectOptions } from '@/components/aiva/EmailConnectOptions';
import { MobileSheet } from '@/components/aiva/mobile';
import { QRCodeCanvas } from '@/components/ui/QRCode';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
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
  const [whatsappMode, setWhatsappMode] = useState<'web' | 'business'>('web');
  const [webPairing, setWebPairing] = useState<{
    status: string;
    qrPayload: string | null;
    pairingCode: string | null;
    expiresAt: string;
    warnings?: string[];
  } | null>(null);

  const fields = CHANNEL_FIELDS[channelType] ?? [];

  async function startWhatsAppWebPairing() {
    setPending(true);
    setError('');
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/whatsapp-web/pairing`, {
        method: 'POST',
      });
      const data = (await res.json()) as {
        error?: string;
        session?: typeof webPairing;
        warnings?: string[];
      };
      if (!res.ok || !data.session) {
        setError(data.error ?? 'Could not start WhatsApp Web pairing');
        return;
      }
      setWebPairing({ ...data.session, warnings: data.warnings });
    } catch {
      setError('Could not start WhatsApp Web pairing');
    } finally {
      setPending(false);
    }
  }

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
      setValues({});
    } catch {
      setError('Could not connect channel');
    } finally {
      setPending(false);
    }
  }

  return (
    <MobileSheet open={open} onClose={onClose} title={`Connect ${channelLabel}`} className="lg:max-w-lg">
      <div className="space-y-4">
        {channelType === 'whatsapp' ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setWhatsappMode('web')}
                className={cn(
                  'rounded-xl border p-4 text-left',
                  whatsappMode === 'web'
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-elevated hover:bg-overlay',
                )}
              >
                <span className="block text-sm font-semibold text-text-primary">WhatsApp Web</span>
                <span className="mt-1 block text-xs leading-5 text-text-muted">
                  Easiest setup. Scan a QR code from the phone that owns the WhatsApp account.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setWhatsappMode('business')}
                className={cn(
                  'rounded-xl border p-4 text-left',
                  whatsappMode === 'business'
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-elevated hover:bg-overlay',
                )}
              >
                <span className="block text-sm font-semibold text-text-primary">Business API</span>
                <span className="mt-1 block text-xs leading-5 text-text-muted">
                  Best for scale, templates, compliance, and business messaging through Meta.
                </span>
              </button>
            </div>

            {whatsappMode === 'web' ? (
              <div className="space-y-4 rounded-xl border border-border bg-elevated p-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Pair with WhatsApp Web</h3>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-text-secondary">
                    <li>Open WhatsApp on your phone.</li>
                    <li>Go to Linked devices.</li>
                    <li>Scan the QR code or enter the pairing code.</li>
                    <li>Keep the phone connected while Aiva uses this channel.</li>
                  </ol>
                </div>
                {webPairing?.qrPayload ? (
                  <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                    <div className="rounded-xl bg-white p-3">
                      <QRCodeCanvas value={webPairing.qrPayload} size={156} />
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-text-muted">Pairing code</p>
                      <p className="rounded-lg border border-border bg-base px-3 py-2 font-mono text-lg text-text-primary">
                        {webPairing.pairingCode ?? 'Pending'}
                      </p>
                      <p className="text-xs text-text-muted">
                        Expires {new Date(webPairing.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startWhatsAppWebPairing()}
                    disabled={pending}
                    className="btn-primary flex min-h-12 w-full items-center justify-center rounded-xl text-sm font-medium disabled:opacity-70"
                  >
                    {pending ? 'Starting pairing...' : 'Start WhatsApp Web pairing'}
                  </button>
                )}
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">Operational warning</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-amber-100/90">
                    {(webPairing?.warnings ?? [
                      'WhatsApp Web pairing is easier, but it is not the official Business API.',
                      'WhatsApp can change Web behaviour without notice.',
                      'Do not use this path for spam, cold outreach, or high-volume automation.',
                    ]).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </div>
            ) : null}
          </div>
        ) : channelType === 'email' ? (
          <p className="text-sm text-text-muted">
            Connect a mailbox with OAuth, or use inbound forwarding for another provider.
          </p>
        ) : (
          <p className="text-sm text-text-muted">
            {channelType === 'sms'
              ? 'Use your Twilio account SID, auth token, and SMS-capable from number. Set the Twilio webhook to https://core.carinaai.uk/api/channels/webhook/sms.'
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
        ) : channelType === 'whatsapp' && whatsappMode === 'web' ? null : (
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">{field.label}</label>
                <input
                  type={field.secret ? 'password' : 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(ev) => setValues({ ...values, [field.key]: ev.target.value })}
                  placeholder={field.placeholder}
                  className={AIVA_INPUT_CLASS}
                  autoComplete="off"
                />
              </div>
            ))}
            {channelType === 'web' ? (
              <p className="text-sm text-text-secondary">
                Web chat uses the embed widget. No credentials required; connect enables the widget for this Aiva.
              </p>
            ) : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className={cn(
                'btn-primary flex min-h-12 w-full items-center justify-center rounded-xl text-sm font-medium',
                pending && 'opacity-70',
              )}
            >
              {pending ? 'Connecting...' : 'Connect channel'}
            </button>
          </form>
        )}
      </div>
    </MobileSheet>
  );
}

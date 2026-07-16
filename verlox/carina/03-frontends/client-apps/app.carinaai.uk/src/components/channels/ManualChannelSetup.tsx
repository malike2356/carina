'use client';

import { useState } from 'react';
import type { ChannelSetupProps } from '@/components/channels/channel-setup-types';
import { connectWorkerChannel } from '@/lib/channel-connect';
import { cn } from '@/lib/utils';

const MANUAL_FIELDS: Record<
  string,
  Array<{ key: string; label: string; placeholder: string; secret?: boolean }>
> = {
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
};

type ManualChannelSetupProps = ChannelSetupProps & {
  channelType: string;
};

export function ManualChannelSetup({
  workerId,
  channelType,
  channelLabel,
  onComplete,
}: ManualChannelSetupProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const fields = MANUAL_FIELDS[channelType] ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    const credentials: Record<string, string> = {};
    for (const field of fields) {
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

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <p className="text-xs text-text-muted">
        Advanced setup. Credentials are encrypted before storage.
      </p>
      {fields.map((field) => (
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

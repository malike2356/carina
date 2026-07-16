'use client';

import { useState } from 'react';
import type { ChannelSetupProps } from '@/components/channels/channel-setup-types';
import { connectWorkerChannel } from '@/lib/channel-connect';
import { cn } from '@/lib/utils';

export function TelegramSetupWithWorker({ workerId, onComplete }: ChannelSetupProps) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    const result = await connectWorkerChannel(workerId, 'telegram', { bot_token: token.trim() });
    setPending(false);
    if (!result.ok) {
      setError('Invalid token. Create a bot at @BotFather on Telegram and paste the token here.');
      return;
    }
    onComplete();
  }

  return (
    <form onSubmit={(e) => void connect(e)} className="space-y-3">
      <ol className="list-decimal space-y-1 pl-4 text-xs text-text-muted">
        <li>
          Open Telegram and message{' '}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            @BotFather
          </a>
        </li>
        <li>
          Send <code className="rounded bg-elevated px-1">/newbot</code> and follow the steps
        </li>
        <li>Paste the token below</li>
      </ol>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Paste your bot token here"
        className="form-input"
        autoComplete="off"
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={!token.trim() || pending}
        className={cn('btn-primary mobile-btn w-full', pending && 'opacity-70')}
      >
        {pending ? 'Connecting...' : 'Connect Telegram'}
      </button>
    </form>
  );
}

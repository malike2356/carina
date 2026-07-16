'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import type { ChannelSetupProps } from '@/components/channels/channel-setup-types';
import { connectWorkerChannel, webChatEmbedSnippet } from '@/lib/channel-connect';
import { cn } from '@/lib/utils';

export function WebChatSetup({ workerId, onComplete }: ChannelSetupProps) {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function enable() {
    setPending(true);
    setError('');
    const result = await connectWorkerChannel(workerId, 'web');
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEnabled(true);
    onComplete();
  }

  const snippet = webChatEmbedSnippet(workerId);

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        Add a chat widget to your website. Visitors can talk to your Aiva directly.
      </p>
      {!enabled ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void enable()}
          className={cn('btn-primary mobile-btn w-full', pending && 'opacity-70')}
        >
          {pending ? 'Enabling...' : 'Enable web chat'}
        </button>
      ) : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {enabled ? (
        <div className="space-y-2">
          <p className="text-xs text-text-muted">Copy this snippet into your website:</p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg border border-border bg-base p-3 text-[11px] text-text-secondary">
              {snippet}
            </pre>
            <CopyButton text={snippet} className="absolute top-2 right-2" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { AivaHostedEmailCard } from '@/components/aiva/AivaHostedEmailCard';

export function HostedEmailAddressPanel({
  workerId,
  workerName,
}: {
  workerId: string;
  workerName?: string;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  async function sendTest() {
    setTesting(true);
    setTestMessage(null);
    try {
      const res = await fetch(
        `/api/aiva/workers/${encodeURIComponent(workerId)}/email-address/test`,
        { method: 'POST' },
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.status === 501) {
        setTestMessage(
          json.error
            ?? 'Send a real email to this address to test delivery and replies.',
        );
        return;
      }
      if (!res.ok || !json.ok) {
        setTestMessage(json.error ?? 'Test could not be completed');
        return;
      }
      setTestMessage('Test message created. Check Email and Approvals for the reply path.');
    } catch {
      setTestMessage('Test could not be completed');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-3">
      <AivaHostedEmailCard workerId={workerId} workerName={workerName} />
      <div className="rounded-lg border border-border bg-elevated p-4">
        <button
          type="button"
          disabled={testing}
          onClick={() => void sendTest()}
          className="btn-ghost text-xs"
        >
          {testing ? 'Sending...' : 'Send test'}
        </button>
        {testMessage ? (
          <p className="mt-2 text-xs text-text-muted">{testMessage}</p>
        ) : null}
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            {advancedOpen ? 'Hide advanced' : 'Use my existing mailbox'}
          </button>
          {advancedOpen ? (
            <p className="mt-2 text-xs text-text-muted">
              Connect Gmail, Outlook, or IMAP if you want Aiva to read and reply from an
              existing business mailbox. Use the Email channel below for that setup.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

'use client';

import { Globe, Hash, Loader2, Mail, MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export interface VaReplyChannel {
  type: string;
  identifier: string | null;
  displayLabel: string;
}

function channelLabel(type: string): string {
  if (type === 'whatsapp') return 'WhatsApp';
  if (type === 'web') return 'Web chat';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function ChannelIcon({ type }: { type: string }) {
  const className = 'h-3.5 w-3.5 shrink-0 text-text-muted';
  switch (type) {
    case 'email':
      return <Mail className={className} aria-hidden />;
    case 'slack':
      return <Hash className={className} aria-hidden />;
    case 'web':
      return <Globe className={className} aria-hidden />;
    default:
      return <MessageSquare className={className} aria-hidden />;
  }
}

export function VaReplyPanel({
  escalationId,
  channel,
  onSent,
}: {
  escalationId: string;
  channel: VaReplyChannel | null;
  onSent: (result: { handedBack: boolean; channel: string }) => void;
}) {
  const [message, setMessage] = useState('');
  const [handBackToAiva, setHandBackToAiva] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [closedNotice, setClosedNotice] = useState('');

  useEffect(() => {
    setMessage('');
    setHandBackToAiva(false);
    setError('');
    setSuccess('');
    setClosedNotice('');
  }, [escalationId]);

  const sendReply = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError('');
    setSuccess('');
    setClosedNotice('');
    try {
      const res = await fetch(`/api/admin/va/queue/${escalationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, handBackToAiva }),
      });
      const body = (await res.json()) as {
        error?: string;
        channel?: string;
        handedBack?: boolean;
      };
      if (!res.ok) throw new Error(body.error ?? 'Failed to send reply');
      const sentChannel = body.channel ?? channel?.type ?? 'channel';
      setMessage('');
      setSuccess(`Reply sent via ${channelLabel(sentChannel)}.`);
      if (body.handedBack) {
        setClosedNotice('Escalation closed. Aiva will handle future messages.');
        setHandBackToAiva(false);
      }
      onSent({ handedBack: Boolean(body.handedBack), channel: sentChannel });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  }, [channel?.type, escalationId, handBackToAiva, message, onSent, sending]);

  const contactTarget =
    channel?.identifier && channel.type !== 'web'
      ? channel.identifier
      : channel?.type === 'web'
        ? 'Web chat visitor'
        : 'contact';

  return (
    <div className="border-b border-border p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        Reply as VA
      </p>

      {channel ? (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-text-secondary">
          <ChannelIcon type={channel.type} />
          <span>
            Replying via {channelLabel(channel.type)} to {contactTarget}
          </span>
        </p>
      ) : null}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            void sendReply();
          }
        }}
        rows={3}
        placeholder="Type your reply..."
        disabled={sending}
        className="admin-input mb-2 min-h-[80px] max-h-40 w-full resize-y text-xs"
      />

      <label className="mb-3 flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={handBackToAiva}
          onChange={(e) => setHandBackToAiva(e.target.checked)}
          disabled={sending}
          className="mt-0.5"
        />
        <span>
          <span className="block text-xs text-text-primary">Hand back to Aiva after sending</span>
          <span className="text-[11px] text-text-muted">
            Your Aiva will handle subsequent messages from this client.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={message.trim().length === 0 || sending}
          onClick={() => void sendReply()}
          className="btn-admin-primary inline-flex items-center gap-2 text-xs disabled:opacity-50"
        >
          {sending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Sending...
            </>
          ) : (
            'Send reply'
          )}
        </button>
        <span className="text-[10px] text-text-muted">Ctrl+Enter to send</span>
      </div>

      {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
      {success ? <p className="mt-3 text-xs text-green-400">{success}</p> : null}
      {closedNotice ? <p className="mt-1 text-xs text-green-400">{closedNotice}</p> : null}
    </div>
  );
}

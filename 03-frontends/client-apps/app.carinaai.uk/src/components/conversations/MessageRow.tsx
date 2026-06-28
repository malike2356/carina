'use client';

import { cn } from '@/lib/utils';

const CHAIN_EXPLORER_URL =
  process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL ?? 'https://etherscan.io/tx';

export type ThreadMessage = {
  id: string;
  role: 'user' | 'aiva' | 'va' | 'system';
  content: string;
  timestamp: string;
  actionType?: string;
  summary?: string;
  attestationTx?: string | null;
};

function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shouldShowTimestamp(
  msg: ThreadMessage,
  nextMsg: ThreadMessage | undefined,
): boolean {
  if (!nextMsg) return true;
  const gap = new Date(nextMsg.timestamp).getTime() - new Date(msg.timestamp).getTime();
  if (gap > 5 * 60 * 1000) return true;
  return nextMsg.role !== msg.role;
}

export function MessageRow({
  msg,
  nextMsg,
  workerName,
}: {
  msg: ThreadMessage;
  nextMsg?: ThreadMessage;
  workerName: string;
}) {
  const showTimestamp = shouldShowTimestamp(msg, nextMsg);

  if (msg.role === 'user') {
    return (
      <div className="mb-1 flex flex-col items-end">
        <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-accent-dim px-4 py-2.5">
          <p className="text-sm text-text-primary whitespace-pre-wrap">{msg.content}</p>
        </div>
        {showTimestamp ? (
          <p className="mt-0.5 pr-1 text-[10px] text-text-muted">{formatMsgTime(msg.timestamp)}</p>
        ) : null}
      </div>
    );
  }

  if (msg.role === 'aiva') {
    return (
      <div className="mb-1 flex items-start gap-2">
        <div
          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-dim text-[10px] font-semibold text-accent"
          aria-hidden
        >
          {workerName.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col">
          <div className="max-w-[70%] rounded-2xl rounded-tl-sm border border-border bg-elevated px-4 py-2.5">
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{msg.content}</p>
          </div>
          <div className="mt-0.5 flex items-center gap-2 pl-1">
            {msg.attestationTx ? (
              <a
                href={`${CHAIN_EXPLORER_URL}/${msg.attestationTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-green-400 hover:underline"
              >
                Verified on-chain
              </a>
            ) : (
              <p className="text-[10px] text-text-muted">Attestation pending</p>
            )}
            {showTimestamp ? (
              <p className="text-[10px] text-text-muted">{formatMsgTime(msg.timestamp)}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (msg.role === 'va') {
    return (
      <div className="mb-1 flex items-start gap-2">
        <div
          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-semibold text-amber-400"
          aria-hidden
        >
          VA
        </div>
        <div>
          <div className="max-w-[70%] rounded-2xl rounded-tl-sm border border-amber-500/25 bg-amber-500/10 px-4 py-2.5">
            <p className="mb-0.5 text-[10px] font-medium text-amber-400">VERLOX Team</p>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{msg.content}</p>
          </div>
          {showTimestamp ? (
            <p className="mt-0.5 pl-1 text-[10px] text-text-muted">{formatMsgTime(msg.timestamp)}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const isEscalation = msg.actionType === 'escalated';
  return (
    <div
      className={cn(
        'my-4 flex items-center gap-3',
        isEscalation ? 'text-amber-400' : 'text-text-muted',
      )}
    >
      <div
        className={cn(
          'flex-1 border-t border-dashed',
          isEscalation ? 'border-amber-500/30' : 'border-border',
        )}
      />
      <p className="shrink-0 whitespace-nowrap text-[10px]">
        {msg.summary ?? msg.content} &middot; {formatMsgTime(msg.timestamp)}
      </p>
      <div
        className={cn(
          'flex-1 border-t border-dashed',
          isEscalation ? 'border-amber-500/30' : 'border-border',
        )}
      />
    </div>
  );
}

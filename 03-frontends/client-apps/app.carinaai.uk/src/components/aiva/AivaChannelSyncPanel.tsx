'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, Loader2, RefreshCw, X } from 'lucide-react';
import { ChannelIcon } from '@/components/aiva/ChannelIcon';
import type {
  AivaChannelSyncConversation,
  AivaChannelSyncState,
} from '@/lib/aiva-types';
import { cn } from '@/lib/utils';

type Props = {
  workerId: string;
  contactId: string;
  channel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinued?: () => void;
  className?: string;
};

export function AivaChannelSyncPanel({
  workerId,
  contactId,
  channel = 'web',
  open,
  onOpenChange,
  onContinued,
  className,
}: Props) {
  const [state, setState] = useState<AivaChannelSyncState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [allThreads, setAllThreads] = useState<AivaChannelSyncConversation[]>([]);

  const load = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ channel, contactId, limit: '12' });
      const [syncRes, listRes] = await Promise.all([
        fetch(`/api/aiva/workers/${encodeURIComponent(workerId)}/channel-sync?${query}`),
        fetch(`/api/aiva/workers/${encodeURIComponent(workerId)}/conversations?limit=12`),
      ]);

      const syncText = await syncRes.text();
      let data: AivaChannelSyncState & { error?: string };
      try {
        data = JSON.parse(syncText) as AivaChannelSyncState & { error?: string };
      } catch {
        throw new Error(
          syncRes.ok
            ? 'Channel sync returned an invalid response.'
            : `Channel sync failed (${syncRes.status}). Try refresh, or redeploy core if this persists.`,
        );
      }
      if (!syncRes.ok) throw new Error(data.error ?? `Could not load channel sync (${syncRes.status})`);
      setState({
        canonicalContactId: data.canonicalContactId,
        sessionId: data.sessionId,
        linked: Boolean(data.linked),
        ownerAuto: Boolean(data.ownerAuto),
        identities: data.identities ?? [],
        conversations: data.conversations ?? [],
      });

      if (listRes.ok) {
        const listText = await listRes.text();
        try {
          const listed = JSON.parse(listText) as {
            conversations?: Array<{
              id: string;
              channel: string;
              contactId: string;
              lastMessageAt: string | null;
              messageCount: number;
            }>;
          };
          setAllThreads(
            (listed.conversations ?? [])
              .filter((row) => row.channel !== channel)
              .map((row) => ({
                id: row.id,
                channel: row.channel,
                contactId: row.contactId,
                lastMessageAt: row.lastMessageAt,
                messageCount: row.messageCount,
                sessionId: data.sessionId,
                isCanonicalSession: false,
              })),
          );
        } catch {
          setAllThreads([]);
        }
      } else {
        setAllThreads([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load channel sync');
      setState(null);
      setAllThreads([]);
    } finally {
      setLoading(false);
    }
  }, [channel, contactId, workerId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  async function generateCode() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(
        `/api/aiva/workers/${encodeURIComponent(workerId)}/channel-sync/link/code`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel, contactId }),
        },
      );
      const data = (await res.json()) as {
        code?: string;
        claimCommand?: string;
        error?: string;
      };
      if (!res.ok || !data.code) throw new Error(data.error ?? 'Could not create link code');
      setLinkCode(data.code);
      setNotice(
        data.claimCommand
          ? `On Telegram, WhatsApp, or another channel, send: ${data.claimCommand}`
          : `On your other channel, send: /link claim ${data.code}`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create link code');
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    const code = claimCode.trim();
    if (!code) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(
        `/api/aiva/workers/${encodeURIComponent(workerId)}/channel-sync/link/claim`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, channel, contactId }),
        },
      );
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(data.error ?? 'Could not claim link code');
      setClaimCode('');
      setNotice('Channels linked. This web chat now shares history and memory with the other channel.');
      await load();
      onContinued?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim link code');
    } finally {
      setBusy(false);
    }
  }

  async function continueHere(convo: AivaChannelSyncConversation) {
    const targetCanonicalContactId = convo.isCanonicalSession
      ? state?.canonicalContactId
      : convo.contactId;
    if (!targetCanonicalContactId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(
        `/api/aiva/workers/${encodeURIComponent(workerId)}/channel-sync/continue`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel,
            contactId,
            targetCanonicalContactId,
          }),
        },
      );
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(data.error ?? 'Could not continue that chat here');
      setNotice(
        `Continuing the ${convo.channel} conversation here. Shared memory and recent history will follow.`,
      );
      await load();
      onContinued?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not continue that chat here');
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!linkCode) return;
    try {
      await navigator.clipboard.writeText(linkCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy the code. Select it manually.');
    }
  }

  if (!open) return null;

  const linkedOther = (state?.conversations ?? []).filter(
    (row) => row.channel !== channel && row.channel !== 'shared',
  );
  const linkedKeys = new Set(linkedOther.map((row) => `${row.channel}:${row.contactId}`));
  const pickList = [
    ...linkedOther.map((row) => ({ ...row, isCanonicalSession: true })),
    ...allThreads.filter((row) => !linkedKeys.has(`${row.channel}:${row.contactId}`)),
  ];

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-elevated/80 px-3 py-3 text-sm text-text-primary',
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Link2 className="h-3.5 w-3.5 text-accent" aria-hidden />
            Channel sync
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {state?.ownerAuto
              ? 'Your web and messenger chats stay in sync automatically. Switch channels and keep talking.'
              : 'Your owner channels sync automatically. Use advanced linking only for extra contacts.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || busy}
            className="rounded-md p-1.5 text-text-muted hover:bg-overlay hover:text-text-primary disabled:opacity-50"
            aria-label="Refresh channel sync"
            title="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-text-muted hover:bg-overlay hover:text-text-primary"
            aria-label="Close channel sync"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading && !state ? (
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading linked channels...
        </p>
      ) : null}

      {error ? <p className="mb-2 text-xs text-danger">{error}</p> : null}
      {notice ? (
        <p className="mb-2 rounded-lg border border-accent/20 bg-accent/10 px-2.5 py-2 text-xs text-text-primary">
          {notice}
        </p>
      ) : null}

      {state ? (
        <div className="mb-3 space-y-1.5">
          <p className="text-[11px] text-text-muted">
            {state.ownerAuto
              ? `Auto sync on across ${Math.max(state.identities.length, 1)} channel${state.identities.length === 1 ? '' : 's'}.`
              : state.linked
                ? `Linked across ${state.identities.length} channel${state.identities.length === 1 ? '' : 's'}.`
                : 'This chat is not linked to another channel yet.'}
          </p>
          {state.identities.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {state.identities.map((identity) => (
                <li
                  key={`${identity.channel}:${identity.contactId}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-text-secondary"
                >
                  <ChannelIcon channel={identity.channel} className="h-3 w-3" />
                  <span className="capitalize">{identity.channel}</span>
                  {identity.isPrimary ? (
                    <span className="text-text-muted">primary</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface px-2.5 py-2.5">
          <p className="text-xs font-medium text-text-primary">
            {state?.ownerAuto ? 'Advanced: link another person' : 'Link channel'}
          </p>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {state?.ownerAuto
              ? 'Optional. Use a code only when you need to merge a specific contact that is not your owner chat.'
              : 'Create a code here, then claim it from Telegram or another channel with `/link claim`.'}
          </p>
          <button
            type="button"
            onClick={() => void generateCode()}
            disabled={busy || !contactId}
            className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-xs font-medium text-primary-foreground hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Create link code
          </button>
          {linkCode ? (
            <div className="mt-2 flex items-center gap-1.5">
              <code className="rounded-md border border-border bg-elevated px-2 py-1 font-mono text-xs tracking-wider">
                {linkCode}
              </code>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="rounded-md p-1.5 text-text-muted hover:bg-overlay hover:text-text-primary"
                aria-label="Copy link code"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ) : null}

          <div className="mt-3 border-t border-border/70 pt-2.5">
            <p className="text-[11px] text-text-muted">Already have a code from another channel?</p>
            <form
              className="mt-1.5 flex gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                void claim();
              }}
            >
              <input
                value={claimCode}
                onChange={(event) => setClaimCode(event.target.value)}
                placeholder="Paste code"
                maxLength={16}
                className="min-w-0 flex-1 rounded-md border border-border bg-elevated px-2 py-1.5 font-mono text-xs text-text-primary outline-none focus:border-accent"
                aria-label="Link claim code"
              />
              <button
                type="submit"
                disabled={busy || !claimCode.trim()}
                className="rounded-md border border-border bg-elevated px-2.5 text-xs font-medium hover:border-accent/40 hover:text-accent disabled:opacity-50"
              >
                Claim
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface px-2.5 py-2.5">
          <p className="text-xs font-medium text-text-primary">Continue this chat here</p>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Pull a conversation from another linked channel into this web thread.
          </p>
          {pickList.length === 0 ? (
            <p className="mt-3 text-[11px] text-text-muted">
              No other-channel threads yet. Chat on Telegram or another channel first, then return here to continue.
            </p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
              {pickList.map((convo) => (
                <li
                  key={`${convo.channel}:${convo.contactId}:${convo.id}`}
                  className="flex items-center gap-2 rounded-md border border-border/80 bg-elevated/60 px-2 py-1.5"
                >
                  <ChannelIcon channel={convo.channel} className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs capitalize text-text-primary">{convo.channel}</p>
                    <p className="truncate text-[10px] text-text-muted">
                      {convo.messageCount} msg
                      {convo.lastMessageAt
                        ? ` · ${new Date(convo.lastMessageAt).toLocaleString()}`
                        : ''}
                      {convo.isCanonicalSession ? ' · linked' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void continueHere(convo)}
                    disabled={busy}
                    className="shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium hover:border-accent/40 hover:text-accent disabled:opacity-50"
                  >
                    Continue
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function AivaChannelSyncToggle({
  open,
  onToggle,
  linked,
  ownerAuto,
  disabled,
}: {
  open: boolean;
  onToggle: () => void;
  linked?: boolean;
  ownerAuto?: boolean;
  disabled?: boolean;
}) {
  const active = open || linked || ownerAuto;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50',
        active
          ? 'border-accent bg-accent text-primary-foreground'
          : 'border-accent/50 bg-accent/15 text-accent hover:bg-accent hover:text-primary-foreground',
      )}
      aria-pressed={open}
      title="Channel sync status and advanced linking"
    >
      <Link2 className="h-3.5 w-3.5" />
      <span>{ownerAuto || linked ? 'Channels synced' : 'Channel sync'}</span>
    </button>
  );
}

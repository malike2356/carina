'use client';

import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

const CHANNELS = [
  'email',
  'slack',
  'teams',
  'telegram',
  'whatsapp',
  'discord',
  'sms',
  'web',
] as const;

type Protection = {
  id: string;
  channel: string;
  externalKey: string;
  mode: string;
  status: string;
  policy: {
    failClosedOnError?: boolean;
    failClosedOnMalicious?: boolean;
    autoReleaseSuspects?: boolean;
  };
};

type ShieldMessage = {
  id: string;
  channel: string;
  verdict: string | null;
  riskScore: number;
  quarantineStatus: string;
  safeSummaryText: string | null;
  envelope: { from: { id: string; display?: string }; subject?: string; text: string };
  createdAt: string;
};

export default function ChannelShieldPage() {
  const { push } = useToast();
  const search = useSearchParams();
  const focusMessage = search.get('message');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [protections, setProtections] = useState<Protection[]>([]);
  const [messages, setMessages] = useState<ShieldMessage[]>([]);
  const [selected, setSelected] = useState<ShieldMessage | null>(null);
  const [events, setEvents] = useState<Array<{ action: string; actor: string; createdAt: string }>>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newChannel, setNewChannel] = useState<(typeof CHANNELS)[number]>('email');
  const [newKey, setNewKey] = useState('');
  const [health, setHealth] = useState<Array<{ channel: string; ok: boolean; detail: string }>>([]);
  const loadedOnceRef = useRef(false);

  const load = useCallback(async () => {
    const firstLoad = !loadedOnceRef.current;
    if (firstLoad) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const q = channelFilter === 'all' ? '' : `?channel=${encodeURIComponent(channelFilter)}`;
      const [pRes, mRes, hRes] = await Promise.all([
        fetch(`/api/aiva/channel-shield/protections${q}`),
        fetch(`/api/aiva/channel-shield/messages?quarantine=1${channelFilter === 'all' ? '' : `&channel=${channelFilter}`}`),
        fetch('/api/aiva/channel-shield/health'),
      ]);
      if (pRes.ok) {
        const data = await pRes.json();
        setProtections(data.protections ?? []);
      }
      if (mRes.ok) {
        const data = await mRes.json();
        setMessages(data.messages ?? []);
      }
      if (hRes.ok) {
        const data = await hRes.json();
        setHealth(data.adapters ?? []);
      }
    } catch {
      push('Failed to load Channel Shield', 'error');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
      loadedOnceRef.current = true;
    }
  }, [channelFilter, push]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusMessage) return;
    void (async () => {
      const res = await fetch(`/api/aiva/channel-shield/messages/${focusMessage}`);
      if (!res.ok) return;
      const data = await res.json();
      setSelected(data.message);
      setEvents(data.events ?? []);
    })();
  }, [focusMessage]);

  const openMessage = async (id: string) => {
    const res = await fetch(`/api/aiva/channel-shield/messages/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSelected(data.message);
    setEvents(data.events ?? []);
  };

  const addProtection = async () => {
    if (!newKey.trim()) return;
    const res = await fetch('/api/aiva/channel-shield/protections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: newChannel, externalKey: newKey.trim() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      push(err.error ?? 'Could not create protection', 'error');
      return;
    }
    setNewKey('');
    push('Protection created', 'success');
    void load();
  };

  const release = async (id: string, malicious: boolean) => {
    const actor = 'workspace-admin';
    const body: Record<string, string> = { actor };
    if (malicious) body.approver = 'security-approver';
    const res = await fetch(`/api/aiva/channel-shield/messages/${id}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      push(err.error ?? 'Release failed', 'error');
      return;
    }
    push('Message released', 'success');
    void load();
  };

  const destroy = async (id: string) => {
    const res = await fetch(`/api/aiva/channel-shield/messages/${id}/destroy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'workspace-admin' }),
    });
    if (!res.ok) {
      push('Destroy failed', 'error');
      return;
    }
    push('Message destroyed', 'success');
    setSelected(null);
    void load();
  };

  const updatePolicy = async (protection: Protection, patch: Record<string, boolean>) => {
    const res = await fetch(`/api/aiva/channel-shield/protections/${protection.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy: { ...protection.policy, ...patch } }),
    });
    if (!res.ok) {
      push('Policy update failed', 'error');
      return;
    }
    void load();
  };

  const heldCount = useMemo(
    () => messages.filter((m) => m.quarantineStatus === 'held').length,
    [messages],
  );
  const channelLabel = channelFilter === 'all' ? 'all channels' : channelFilter;
  const visibleHealth = useMemo(
    () => (channelFilter === 'all' ? health : health.filter((h) => h.channel === channelFilter)),
    [channelFilter, health],
  );

  const selectChannel = useCallback((channel: string) => {
    setChannelFilter((current) => {
      if (current === channel) return current;
      setSelected(null);
      setEvents([]);
      return channel;
    });
  }, []);

  return (
    <div className="w-full min-w-0 max-w-none px-4 py-8 sm:px-6">
      <Link
        href="/settings?section=join"
        className="mb-4 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to settings
      </Link>

      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 h-6 w-6 text-text-secondary" />
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Channel Shield</h1>
          <p className="mt-1 text-xs text-text-muted">
            Inbound protection across email, Slack, Teams, Telegram, WhatsApp, Discord, SMS, and web.
            Live payloads are analysed before delivery; malicious content is quarantined with a safe summary.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selectChannel('all')}
          disabled={refreshing}
          className={cn(
            'rounded-md border px-2.5 py-1 text-xs',
            channelFilter === 'all' ? 'border-border bg-elevated text-text-primary' : 'border-border text-text-muted',
            refreshing ? 'cursor-wait opacity-75' : 'hover:bg-elevated/60',
          )}
        >
          All ({heldCount} held)
        </button>
        {CHANNELS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => selectChannel(c)}
            disabled={refreshing}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs capitalize',
              channelFilter === c ? 'border-border bg-elevated text-text-primary' : 'border-border text-text-muted',
              refreshing ? 'cursor-wait opacity-75' : 'hover:bg-elevated/60',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-muted">
        Showing {channelLabel}
        {refreshing ? ' - updating...' : ` - ${messages.length} held message${messages.length === 1 ? '' : 's'}`}
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-text-primary">Add protection</h2>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-text-muted">
            Channel
            <select
              className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text-primary [color-scheme:dark]"
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value as (typeof CHANNELS)[number])}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c} className="bg-surface text-text-primary">
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-text-muted">
            External key (domain / team / bot / phone / site)
            <input
              className="mt-1 block min-w-[220px] rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="example.com"
            />
          </label>
          <button
            type="button"
            onClick={() => void addProtection()}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-primary hover:bg-elevated"
          >
            Protect
          </button>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-text-primary">Protections</h2>
        {initialLoading ? (
          <p className="mt-2 text-xs text-text-muted">Loading...</p>
        ) : protections.length === 0 ? (
          <p className="mt-2 text-xs text-text-muted">
            {channelFilter === 'all'
              ? 'No protections yet.'
              : `No ${channelFilter} protections yet. Add one below or switch back to All.`}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {protections.map((p) => (
              <li key={p.id} className="border-b border-border pb-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium capitalize text-text-primary">{p.channel}</span>
                    <span className="ml-2 text-xs text-text-muted">{p.externalKey}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-text-muted">
                    {p.status} / {p.mode}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-text-muted">
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={p.policy.failClosedOnMalicious !== false}
                      onChange={(e) => void updatePolicy(p, { failClosedOnMalicious: e.target.checked })}
                    />
                    Fail closed on malicious
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={p.policy.failClosedOnError !== false}
                      onChange={(e) => void updatePolicy(p, { failClosedOnError: e.target.checked })}
                    />
                    Fail closed on error
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={Boolean(p.policy.autoReleaseSuspects)}
                      onChange={(e) => void updatePolicy(p, { autoReleaseSuspects: e.target.checked })}
                    />
                    Auto-release suspects
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-text-primary">Quarantine inbox</h2>
        {initialLoading ? (
          <p className="mt-2 text-xs text-text-muted">Loading...</p>
        ) : null}
        {!initialLoading && messages.length === 0 ? (
          <p className="mt-2 text-xs text-text-muted">
            {channelFilter === 'all'
              ? 'No held messages.'
              : `No held messages for ${channelFilter}. Try All or another channel.`}
          </p>
        ) : !initialLoading ? (
          <ul className="mt-3 space-y-2">
            {messages.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => void openMessage(m.id)}
                  className="w-full border-b border-border py-2 text-left hover:bg-elevated/40"
                >
                  <div className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className="capitalize text-text-primary">{m.channel}</span>
                    <span className="text-text-muted">{m.verdict ?? 'pending'} / score {m.riskScore}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-text-muted">
                    From {m.envelope.from.display ?? m.envelope.from.id}
                    {m.envelope.subject ? ` · ${m.envelope.subject}` : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {selected && (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="text-sm font-medium text-text-primary">Message report</h2>
          <p className="mt-1 text-xs text-text-muted">
            {selected.channel} · {selected.verdict} · quarantine {selected.quarantineStatus}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-xs text-text-secondary">
            {selected.safeSummaryText ?? selected.envelope.text.slice(0, 500)}
          </p>
          <ul className="mt-4 space-y-1 text-[11px] text-text-muted">
            {events.map((e, i) => (
              <li key={`${e.action}-${i}`}>
                {e.createdAt}: {e.actor} / {e.action}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void release(selected.id, selected.verdict === 'malicious')}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-primary hover:bg-elevated"
            >
              Release
            </button>
            <button
              type="button"
              onClick={() => void destroy(selected.id)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-elevated"
            >
              Destroy
            </button>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-medium text-text-primary">Adapter health</h2>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {visibleHealth.map((h) => (
            <li key={h.channel} className="text-[11px] text-text-muted">
              <span className="capitalize text-text-primary">{h.channel}</span>
              {': '}
              {h.ok ? 'ok' : 'degraded'} · {h.detail}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

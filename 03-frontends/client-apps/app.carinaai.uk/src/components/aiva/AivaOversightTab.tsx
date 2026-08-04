'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Mail, MessageCircle, MessagesSquare } from 'lucide-react';
import { ChannelIcon } from '@/components/aiva/ChannelIcon';
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  slicePage,
  totalPagesFor,
} from '@/components/ui/ListPager';
import type { AivaOutboundMessage, AivaWorker } from '@/lib/aiva-types';
import { timeAgo } from '@/lib/aiva-utils';

type ConversationRow = {
  id: string;
  channel: string;
  contactId: string;
  lastMessageAt: string | null;
  messageCount: number;
};

function OversightCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyBlock({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
      <div className="mb-3 text-text-muted">{icon}</div>
      <p className="max-w-sm text-sm text-text-muted">{text}</p>
    </div>
  );
}

function OutboundRow({ item }: { item: AivaOutboundMessage }) {
  const [expanded, setExpanded] = useState(false);
  const preview = item.preview.trim();
  const truncated = preview.length > 140 && !expanded;

  return (
    <article className="rounded-xl border border-border bg-background px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <ChannelIcon channel={item.channel} className="h-4 w-4 text-text-secondary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-text-primary">{item.contactId || 'Recipient'}</p>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Delivered
            </span>
            <span className="text-xs text-text-muted">{timeAgo(item.createdAt)}</span>
          </div>
          {item.channel === 'email' && item.subject ? (
            <p className="mt-1 text-xs font-medium text-text-secondary">{item.subject}</p>
          ) : null}
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {truncated ? `${preview.slice(0, 140)}...` : preview}
          </p>
          {preview.length > 140 ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function AivaOversightTab({
  worker,
  workerId,
  ownerEmail,
}: {
  worker: AivaWorker;
  workerId: string;
  ownerEmail?: string | null;
}) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [outbound, setOutbound] = useState<AivaOutboundMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<'all' | string>('all');
  const [outboundQuery, setOutboundQuery] = useState('');
  const [convPage, setConvPage] = useState(1);
  const [outPage, setOutPage] = useState(1);
  const [bodyQuery, setBodyQuery] = useState('');
  const [bodyHits, setBodyHits] = useState<Array<{
    id: string;
    content: string;
    sender: string;
    createdAt: string;
  }>>([]);
  const [bodySearching, setBodySearching] = useState(false);

  useEffect(() => {
    const q = bodyQuery.trim();
    if (q.length < 2) {
      setBodyHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setBodySearching(true);
      void fetch(`/api/aiva/conversations/search?q=${encodeURIComponent(q)}&workerId=${encodeURIComponent(workerId)}`)
        .then(async (res) => {
          const data = (await res.json()) as { hits?: Array<{ id: string; content: string; sender: string; createdAt: string }> };
          setBodyHits(data.hits ?? []);
        })
        .finally(() => setBodySearching(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [bodyQuery, workerId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [convRes, outboundRes] = await Promise.all([
          fetch(`/api/aiva/workers/${workerId}/conversations?limit=100`),
          fetch(`/api/aiva/workers/${workerId}/outbound?limit=100`),
        ]);
        if (cancelled) return;
        if (convRes.ok) {
          const data = (await convRes.json()) as { conversations?: ConversationRow[] };
          setConversations(data.conversations ?? []);
        }
        if (outboundRes.ok) {
          const data = (await outboundRes.json()) as { outbound?: AivaOutboundMessage[] };
          setOutbound(data.outbound ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  const externalConversations = useMemo(() => {
    const owner = ownerEmail?.trim().toLowerCase();
    const rows = !owner
      ? conversations
      : conversations.filter((row) => row.contactId.trim().toLowerCase() !== owner);
    if (channelFilter === 'all') return rows;
    return rows.filter((row) => row.channel === channelFilter);
  }, [conversations, ownerEmail, channelFilter]);

  const filteredOutbound = useMemo(() => {
    const q = outboundQuery.trim().toLowerCase();
    return outbound.filter((item) => {
      if (channelFilter !== 'all' && item.channel !== channelFilter) return false;
      if (!q) return true;
      return (
        item.preview.toLowerCase().includes(q)
        || item.contactId.toLowerCase().includes(q)
        || (item.subject ?? '').toLowerCase().includes(q)
      );
    });
  }, [outbound, channelFilter, outboundQuery]);

  useEffect(() => {
    setConvPage(1);
    setOutPage(1);
  }, [channelFilter, outboundQuery]);

  const convTotalPages = totalPagesFor(externalConversations.length, DEFAULT_PAGE_SIZE);
  const pageConversations = useMemo(
    () => slicePage(externalConversations, convPage, DEFAULT_PAGE_SIZE),
    [externalConversations, convPage],
  );

  const outTotalPages = totalPagesFor(filteredOutbound.length, DEFAULT_PAGE_SIZE);
  const pageOutbound = useMemo(
    () => slicePage(filteredOutbound, outPage, DEFAULT_PAGE_SIZE),
    [filteredOutbound, outPage],
  );

  const filterChannels = useMemo(() => {
    const set = new Set<string>();
    for (const row of conversations) set.add(row.channel);
    for (const row of outbound) set.add(row.channel);
    return ['all', ...Array.from(set).sort()];
  }, [conversations, outbound]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Messages today', value: worker.messagesToday ?? 0 },
          { label: 'Open threads', value: worker.openThreads ?? 0 },
          { label: 'Pending approvals', value: worker.pendingApprovals ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xl font-semibold text-text-primary">{stat.value}</p>
            <p className="text-xs text-text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filterChannels.map((channel) => (
          <button
            key={channel}
            type="button"
            onClick={() => setChannelFilter(channel)}
            className={
              channelFilter === channel
                ? 'rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary'
                : 'rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-overlay'
            }
          >
            {channel === 'all' ? 'All channels' : channel}
          </button>
        ))}
        <input
          value={outboundQuery}
          onChange={(e) => setOutboundQuery(e.target.value)}
          placeholder="Filter outbound..."
          className="min-w-[12rem] flex-1 rounded-lg border border-border bg-elevated px-3 py-1.5 text-xs text-text-primary"
        />
        <input
          value={bodyQuery}
          onChange={(e) => setBodyQuery(e.target.value)}
          placeholder="Search message bodies..."
          className="min-w-[12rem] flex-1 rounded-lg border border-border bg-elevated px-3 py-1.5 text-xs text-text-primary"
        />
      </div>

      {bodyQuery.trim().length >= 2 ? (
        <OversightCard
          title="Message body search"
          subtitle={bodySearching ? 'Searching...' : 'Matches across employee message content for this worker.'}
        >
          {bodyHits.length === 0 ? (
            <p className="text-sm text-text-muted">No matches.</p>
          ) : (
            <div className="space-y-2">
              {bodyHits.map((hit) => (
                <div key={hit.id} className="rounded-xl border border-border px-4 py-3 text-sm">
                  <p className="text-xs text-text-muted">{hit.sender} · {timeAgo(hit.createdAt)}</p>
                  <p className="mt-1 text-text-secondary">{hit.content}</p>
                </div>
              ))}
            </div>
          )}
        </OversightCard>
      ) : null}

      <OversightCard
        title="External conversations"
        subtitle={`Conversations between ${worker.name} and other people (not including you).`}
      >
        {loading ? (
          <p className="text-sm text-text-muted">Loading conversations...</p>
        ) : externalConversations.length === 0 ? (
          <EmptyBlock
            icon={<MessagesSquare className="h-8 w-8" />}
            text="No external conversations yet. When customers or teammates reach your worker, they will appear here."
          />
        ) : (
          <div className="space-y-2">
            {pageConversations.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-text-primary">{row.contactId}</p>
                  <p className="text-xs capitalize text-text-muted">{row.channel}</p>
                </div>
                <span className="text-xs text-text-muted">{timeAgo(row.lastMessageAt)}</span>
              </div>
            ))}
            <ListPager
              page={convPage}
              totalPages={convTotalPages}
              totalItems={externalConversations.length}
              onChangePage={setConvPage}
              disabled={loading}
            />
          </div>
        )}
      </OversightCard>

      <OversightCard
        title="Outbound communications"
        subtitle="Messages sent by the worker through Email, WhatsApp, and Slack."
      >
        {loading ? (
          <p className="text-sm text-text-muted">Loading outbound messages...</p>
        ) : filteredOutbound.length === 0 ? (
          <EmptyBlock
            icon={<Mail className="h-8 w-8" />}
            text="No outbound messages match this filter yet."
          />
        ) : (
          <div className="space-y-3">
            {pageOutbound.map((item) => (
              <OutboundRow key={item.id} item={item} />
            ))}
            <ListPager
              page={outPage}
              totalPages={outTotalPages}
              totalItems={filteredOutbound.length}
              onChangePage={setOutPage}
              disabled={loading}
            />
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <Link href={`/aiva/workers/${workerId}?tab=channels`} className="text-primary hover:underline">
            Connect channels
          </Link>
          <span className="text-text-muted">
            <MessageCircle className="mr-1 inline h-3.5 w-3.5" />
            Owner outreach uses your saved profile phone when WhatsApp is configured.
          </span>
        </div>
      </OversightCard>
    </div>
  );
}

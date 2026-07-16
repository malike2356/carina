'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Bot,
  CreditCard,
  Inbox,
  Menu,
  MessageSquare,
  PlugZap,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useGreeting } from '@/hooks/useRelativeTimeLabel';
import type { LauncherData } from '@/lib/launcher-data';
import type { AivaWorker } from '@/lib/aiva-types';
import { mapAivaBillingStatus, type AivaBillingViewModel } from '@/lib/aiva-billing-ui';
import { AivaAvatar } from '@/components/aiva/AivaAvatar';
import { ChannelIcons } from '@/components/aiva/ChannelIcon';
import {
  MobileEmptyState,
  MobileSheet,
  MobileSkeleton,
} from '@/components/aiva/mobile';
import { MobileBottomNav } from '@/components/shell/MobileBottomNav';
import { BrandMark } from '@/components/shell/BrandMark';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';

type LauncherIcon = typeof Bot;

type HomeBillingGlance = {
  planLabel: string;
  usageLabel: string | null;
  trialLabel: string | null;
};

const TEXT_PRIMARY = 'text-[#f4f8fb]';
const TEXT_SECONDARY = '!text-[#e8f4fa]';
const TEXT_MUTED = 'text-[#b8ced9]';

function billingGlance(view: AivaBillingViewModel | null): HomeBillingGlance | null {
  if (!view) return null;
  const planLabel =
    view.state === 'trial'
      ? 'Trial'
      : view.plan
        ? view.plan.charAt(0).toUpperCase() + view.plan.slice(1)
        : view.planTier || 'Plan';

  let usageLabel: string | null = null;
  if (view.usage.messageLimit != null && view.usage.messageLimit > 0) {
    usageLabel = `${view.usage.messageCount.toLocaleString()} / ${view.usage.messageLimit.toLocaleString()} messages`;
  } else if (view.wallet.remainingGbp > 0) {
    usageLabel = `£${view.wallet.remainingGbp.toFixed(2)} credit left`;
  }

  let trialLabel: string | null = null;
  if (view.state === 'trial' && view.trialEndsAt) {
    const ends = new Date(view.trialEndsAt).getTime();
    const days = Math.max(0, Math.ceil((ends - Date.now()) / 86_400_000));
    trialLabel = days === 1 ? '1 day left on trial' : `${days} days left on trial`;
  }

  return { planLabel, usageLabel, trialLabel };
}

function shortLabel(value: string, max = 26): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}...`;
}

function shortRoleSummary(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) return 'AI Employee ready for customer and admin work.';
  const firstSentence = trimmed.split(/[.!?\n]/)[0]?.trim() || trimmed;
  return firstSentence.length > 88 ? `${firstSentence.slice(0, 88)}...` : firstSentence;
}

function lastActiveLabel(value?: string | null): string {
  if (!value) return 'No recent activity';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Recently active';
  const diff = Date.now() - time;
  const minutes = Math.max(0, Math.round(diff / 60_000));
  if (minutes < 1) return 'Active now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function workerStatusDot(status: AivaWorker['status']): string {
  if (status === 'active') return 'bg-emerald-400';
  if (status === 'configuring') return 'bg-sky-400';
  if (status === 'error') return 'bg-red-400';
  return 'bg-slate-400';
}

function QuickLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LauncherIcon;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4',
        'text-sm font-medium text-[#edf4f8] transition hover:border-white/24 hover:bg-white/[0.09]',
      )}
    >
      <Icon className="h-4 w-4 text-[#f5a623]" aria-hidden />
      {label}
    </Link>
  );
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.06] px-3 py-1 text-xs text-[#dceaf2]">
      {children}
    </span>
  );
}

function WorkerCard({ worker }: { worker: AivaWorker }) {
  const channelCount = worker.channels?.length ?? 0;
  const channels = worker.channels ?? [];

  return (
    <Link
      href={`/aiva/workers/${worker.id}`}
      className={cn(
        'group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1a24]/80 p-4',
        'transition hover:border-[#f5a623]/30 hover:bg-[#102230]',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <AivaAvatar name={worker.name} className="h-11 w-11 text-base" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-[#f4f8fb]">{worker.name}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[#c8dae6]">
            {shortRoleSummary(worker.roleDescription)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-white/8 pt-3">
        <div className="flex min-w-0 items-center gap-2 text-[12px] text-[#94b0c0]">
          {channels.length > 0 ? (
            <span className="shrink-0 [&_svg]:text-[#7ea0b4]">
              <ChannelIcons channels={channels} />
            </span>
          ) : null}
          <span className="truncate">
            {channelCount} channel{channelCount === 1 ? '' : 's'}
            {' · '}
            {lastActiveLabel(worker.lastActiveAt)}
          </span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium capitalize text-[#d8e8f2]">
          <span className={cn('h-2 w-2 rounded-full', workerStatusDot(worker.status))} />
          {worker.status}
        </span>
      </div>
    </Link>
  );
}

export function AivaLauncherShell({ userName }: LauncherData) {
  const greeting = useGreeting();
  const firstName = userName.split(' ')[0] || 'there';
  const [workers, setWorkers] = useState<AivaWorker[]>([]);
  const [billing, setBilling] = useState<AivaBillingViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [workersRes, billingRes] = await Promise.all([
          fetch('/api/aiva/workers'),
          fetch('/api/aiva/billing/status'),
        ]);
        if (cancelled) return;
        if (workersRes.ok) {
          const data = (await workersRes.json()) as { workers?: AivaWorker[] };
          setWorkers(data.workers ?? []);
        }
        if (billingRes.ok) {
          const raw = await billingRes.json();
          setBilling(mapAivaBillingStatus(raw as Record<string, unknown>, []));
        }
      } catch {
        if (!cancelled) {
          setWorkers([]);
          setBilling(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = workers[0] ?? null;
  const needsChannel = workers.some((w) => (w.channels?.length ?? 0) === 0);
  const glance = billingGlance(billing);
  const primaryHref = latest ? `/aiva/workers/${latest.id}` : '/aiva';
  const primaryLabel = latest
    ? `Open ${shortLabel(latest.name, 22)}`
    : 'Hire your first AI Employee';
  const activeWorkers = workers.filter((worker) => worker.status === 'active').length;
  const connectedWorkers = workers.filter((worker) => (worker.channels?.length ?? 0) > 0).length;
  const scoutEnabled = workers.some((worker) => worker.scout?.enabled || worker.scout?.monitoring);
  const workerPreview = workers.slice(0, 6);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#061019] text-[#edf4f8]">
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#07141c]/95 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top,0px))] backdrop-blur lg:px-8 lg:py-3">
        <IconButton
          label="Open menu"
          className="touch-target lg:hidden"
          onClick={() => setMoreOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </IconButton>
        <Link href="/launcher" className="shrink-0 opacity-90 hover:opacity-100" aria-label="Aiva home">
          <BrandMark />
        </Link>
        <div className="min-w-0 flex-1 lg:hidden" />
        <button
          type="button"
          className="ml-auto text-sm text-[#c5d9e4] hover:text-[#f4f8fb]"
          onClick={() => authClient.signOut().then(() => { window.location.href = '/login'; })}
        >
          Sign out
        </button>
      </header>

      <main
        className={cn(
          'relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto',
          'bg-[radial-gradient(circle_at_18%_0%,rgba(245,166,35,0.12),transparent_36%),radial-gradient(circle_at_82%_6%,rgba(30,183,212,0.14),transparent_38%),linear-gradient(180deg,#061019_0%,#0a1a24_50%,#07141c_100%)]',
          'pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:pb-10',
        )}
      >
        {loading ? (
          <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
            <MobileSkeleton variant="home" />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8 sm:px-6 lg:py-12 xl:px-8">
            <section className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f5a623]">
                {greeting}
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#f4f8fb] sm:text-4xl lg:text-[2.75rem]">
                {firstName}, your AI team is ready.
              </h1>
              <p
                className={cn('mx-auto mt-4 max-w-2xl text-base leading-7 sm:text-[17px]', TEXT_SECONDARY)}
                style={{ color: '#e8f4fa' }}
              >
                {workers.length === 0
                  ? 'Hire an AI Employee, connect a channel, and hand off customer and admin work in minutes.'
                  : `${workers.length} AI Employee${workers.length === 1 ? '' : 's'} online. ${activeWorkers} active, ${connectedWorkers} connected to channels.`}
              </p>

              <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Link
                  href={primaryHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-[#f5a623] px-6 text-[15px] font-semibold text-[#08151c] shadow-[0_10px_32px_rgba(245,166,35,0.22)] transition hover:bg-[#ffbd4a] sm:min-w-[220px]"
                >
                  {latest ? <Bot className="h-5 w-5 shrink-0" aria-hidden /> : <Plus className="h-5 w-5 shrink-0" aria-hidden />}
                  <span className="truncate">{primaryLabel}</span>
                </Link>
                {latest ? (
                  <Link
                    href={`/aiva/workers/${latest.id}?tab=work`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/14 bg-white/[0.06] px-6 text-[15px] font-semibold text-[#f4f8fb] transition hover:border-white/24 hover:bg-white/[0.1] sm:min-w-[180px]"
                  >
                    <Zap className="h-5 w-5 shrink-0 text-[#7dd3fc]" aria-hidden />
                    Resume latest
                  </Link>
                ) : null}
              </div>

              <div className="mt-7 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible">
                <QuickLink href="/aiva/workers" label="Employees" icon={Users} />
                <QuickLink href="/aiva/approvals" label="Inbox" icon={Inbox} />
                <QuickLink
                  href={latest ? `/aiva/workers/${latest.id}?tab=channels` : '/aiva/workers'}
                  label="Channels"
                  icon={PlugZap}
                />
                <QuickLink href="/aiva/governance" label="Governance" icon={ShieldCheck} />
                <QuickLink href="/settings" label="Account" icon={Settings} />
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {glance ? (
                  <>
                    <MetaChip>
                      <CreditCard className="mr-1.5 inline h-3.5 w-3.5 text-[#f5a623]" aria-hidden />
                      {glance.planLabel}
                    </MetaChip>
                    {glance.usageLabel ? <MetaChip>{glance.usageLabel}</MetaChip> : null}
                    {glance.trialLabel ? <MetaChip>{glance.trialLabel}</MetaChip> : null}
                    <Link href="/billing/aiva" className="text-sm font-medium text-[#f5a623] hover:text-[#ffbd4a]">
                      Billing
                    </Link>
                  </>
                ) : null}
                <MetaChip>{activeWorkers} active</MetaChip>
                <MetaChip>{connectedWorkers} connected</MetaChip>
                <MetaChip>Scout {scoutEnabled ? 'on' : 'off'}</MetaChip>
              </div>
            </section>

            {needsChannel && latest ? (
              <section className="mt-8 rounded-2xl border border-[#f5a623]/28 bg-[#1f1608]/90 px-5 py-4">
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3 text-left sm:items-center">
                    <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-[#f5a623] sm:mt-0" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#f4f8fb]">Connect {shortLabel(latest.name, 32)}</p>
                      <p className="mt-1 text-sm leading-6 text-[#e8d4b0]">
                        Add email or chat so this employee can receive work.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/aiva/workers/${latest.id}?tab=channels`}
                    className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-[#f5a623] px-4 text-sm font-semibold text-[#08151c]"
                  >
                    Connect channel
                  </Link>
                </div>
              </section>
            ) : null}

            <section className="mt-10 min-w-0">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn('text-[11px] font-semibold uppercase tracking-[0.16em]', TEXT_MUTED)}>Your team</p>
                  <h2 className={cn('mt-1 text-xl font-semibold sm:text-2xl', TEXT_PRIMARY)}>AI Employees</h2>
                </div>
                {workers.length > 0 ? (
                  <Link href="/aiva/workers" className="shrink-0 text-sm font-medium text-[#f5a623] hover:text-[#ffbd4a]">
                    View all
                  </Link>
                ) : null}
              </div>

              {workers.length === 0 ? (
                <MobileEmptyState
                  className="border-white/12 bg-white/[0.03] [&_h2]:text-[#f4f8fb] [&_p]:text-[#c5d9e4]"
                  icon={<Bot className="h-10 w-10 text-[#9eb4c4]" />}
                  title="No AI Employees yet"
                  description="Hire your first AI Employee. Escalation to a human stays visible when review is needed."
                  action={
                    <Link
                      href="/aiva"
                      className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#f5a623] text-sm font-medium text-[#08151c]"
                    >
                      Hire AI Employee
                    </Link>
                  }
                />
              ) : (
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {workerPreview.map((worker) => (
                    <WorkerCard key={worker.id} worker={worker} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <MobileBottomNav />

      <MobileSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <nav className="space-y-1">
          {[
            { href: '/aiva/workers', label: 'Employees', icon: Bot },
            { href: '/aiva/approvals', label: 'Inbox', icon: MessageSquare },
            { href: '/aiva/escalations', label: 'Escalations', icon: MessageSquare },
            { href: '/billing/aiva', label: 'Billing', icon: CreditCard },
            { href: '/settings', label: 'Account', icon: Settings },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm text-[#edf4f8] hover:bg-white/8"
            >
              <item.icon className="h-4 w-4 text-[#9eb4c4]" aria-hidden />
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-red-300 hover:bg-white/8"
            onClick={() => authClient.signOut().then(() => { window.location.href = '/login'; })}
          >
            Sign out
          </button>
        </nav>
      </MobileSheet>
    </div>
  );
}

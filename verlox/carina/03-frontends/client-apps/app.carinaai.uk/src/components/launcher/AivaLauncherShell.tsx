'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
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
import {
  MobileEmptyState,
  MobileScreen,
  MobileSheet,
  MobileSkeleton,
  MobileStatStrip,
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

function workerStatusTone(status: AivaWorker['status']): string {
  if (status === 'active') return 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/20';
  if (status === 'configuring') return 'bg-sky-400/15 text-sky-200 ring-sky-300/20';
  if (status === 'error') return 'bg-red-400/15 text-red-200 ring-red-300/20';
  return 'bg-white/8 text-white/70 ring-white/10';
}

function LauncherAction({
  href,
  label,
  detail,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  detail: string;
  icon: LauncherIcon;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-20 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-white/58">{detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-white/70" aria-hidden />
    </Link>
  );
}

function WorkerCommandCard({ worker }: { worker: AivaWorker }) {
  const channelCount = worker.channels?.length ?? 0;
  return (
    <Link
      href={`/aiva/workers/${worker.id}`}
      className="group grid gap-3 rounded-2xl border border-white/10 bg-[#0f1b23]/80 p-4 transition hover:border-[#f5a623]/35 hover:bg-[#132430]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{worker.name}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#9bb6c7]">
            {worker.roleDescription || 'AI Employee'}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] capitalize ring-1', workerStatusTone(worker.status))}>
          {worker.status}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <span className="rounded-xl bg-white/[0.045] px-3 py-2 text-[#c9dbe5]">
          <span className="block text-[10px] uppercase text-[#7895a8]">Channels</span>
          {channelCount}
        </span>
        <span className="rounded-xl bg-white/[0.045] px-3 py-2 text-[#c9dbe5]">
          <span className="block text-[10px] uppercase text-[#7895a8]">Messages</span>
          {(worker.messagesToday ?? 0).toLocaleString()}
        </span>
        <span className="rounded-xl bg-white/[0.045] px-3 py-2 text-[#c9dbe5]">
          <span className="block text-[10px] uppercase text-[#7895a8]">Last</span>
          {lastActiveLabel(worker.lastActiveAt)}
        </span>
      </div>
      <span className="inline-flex items-center gap-2 text-xs font-medium text-[#f5a623]">
        Open employee
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
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
  const primaryLabel = latest ? `Open ${latest.name}` : 'Hire AI Employee';
  const primaryHint = latest
    ? 'Continue with your latest AI Employee'
    : 'Create your first AI Employee to get started';
  const activeWorkers = workers.filter((worker) => worker.status === 'active').length;
  const connectedWorkers = workers.filter((worker) => (worker.channels?.length ?? 0) > 0).length;
  const totalMessagesToday = workers.reduce((sum, worker) => sum + (worker.messagesToday ?? 0), 0);
  const scoutEnabled = workers.some((worker) => worker.scout?.enabled || worker.scout?.monitoring);
  const workerPreview = workers.slice(0, 3);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#07141c] text-text-primary">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top,0px))] lg:hidden">
        <IconButton
          label="Open menu"
          className="touch-target"
          onClick={() => setMoreOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </IconButton>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">Home</h1>
        <Link href="/launcher" className="shrink-0 opacity-80 hover:opacity-100" aria-label="Aiva home">
          <BrandMark />
        </Link>
      </header>

      <header className="hidden h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-6 lg:flex">
        <BrandMark />
        <button
          type="button"
          className="text-xs text-text-muted hover:text-text-primary"
          onClick={() => authClient.signOut().then(() => { window.location.href = '/login'; })}
        >
          Sign out
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_18%_12%,rgba(245,166,35,0.16),transparent_32%),radial-gradient(circle_at_82%_16%,rgba(31,148,177,0.18),transparent_34%),linear-gradient(135deg,#061019_0%,#0c1e28_54%,#07141c_100%)] pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
        <MobileScreen className="max-w-lg lg:max-w-none lg:px-8 lg:py-8 xl:px-10">
          {loading ? (
            <MobileSkeleton variant="home" />
          ) : (
            <div className="space-y-6 lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] lg:gap-6 lg:space-y-0">
              <section className="min-h-[420px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0a1821]/85 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur lg:p-7">
                <div className="flex flex-col gap-8 lg:min-h-[560px] lg:justify-between">
                  <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f5a623]">
                        {greeting}
                      </p>
                      <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-white lg:text-5xl">
                        {firstName}, launch your AI workforce.
                      </h2>
                      <p className="mt-4 max-w-xl text-sm leading-6 text-[#a8bfcd] lg:text-base">
                        {workers.length === 0
                          ? 'Hire the first AI Employee, connect channels, and hand off real work.'
                          : `${workers.length} AI Employee${workers.length === 1 ? '' : 's'} in your workspace. ${activeWorkers} active, ${connectedWorkers} channel-ready.`}
                      </p>
                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <Link
                          href={primaryHref}
                          className="inline-flex min-h-12 items-center justify-center gap-3 rounded-2xl bg-[#f5a623] px-5 text-sm font-semibold text-[#08151c] transition hover:bg-[#ffbd4a]"
                        >
                          {latest ? <Bot className="h-5 w-5" aria-hidden /> : <Plus className="h-5 w-5" aria-hidden />}
                          {primaryLabel}
                        </Link>
                        <Link
                          href="/aiva/approvals"
                          className="inline-flex min-h-12 items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/[0.045] px-5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.07]"
                        >
                          <Inbox className="h-5 w-5 text-[#7dd3fc]" aria-hidden />
                          Review inbox
                        </Link>
                      </div>
                      <p className="mt-3 text-xs text-[#7895a8]">{primaryHint}</p>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-[#07131b]/80 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7895a8]">Today</span>
                        <Activity className="h-4 w-4 text-[#1eb7d4]" aria-hidden />
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-2xl font-semibold text-white">{activeWorkers}</p>
                          <p className="mt-1 text-xs text-[#7895a8]">Active</p>
                        </div>
                        <div>
                          <p className="text-2xl font-semibold text-white">{totalMessagesToday.toLocaleString()}</p>
                          <p className="mt-1 text-xs text-[#7895a8]">Messages</p>
                        </div>
                        <div>
                          <p className="text-2xl font-semibold text-white">{connectedWorkers}</p>
                          <p className="mt-1 text-xs text-[#7895a8]">Connected</p>
                        </div>
                        <div>
                          <p className="text-2xl font-semibold text-white">{scoutEnabled ? 'On' : 'Off'}</p>
                          <p className="mt-1 text-xs text-[#7895a8]">Scout</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <LauncherAction
                      href="/aiva/workers"
                      label="Employees"
                      detail="Manage roles and status"
                      icon={Users}
                      tone="bg-[#f5a623]/15 text-[#f5a623]"
                    />
                    <LauncherAction
                      href={latest ? `/aiva/workers/${latest.id}?tab=work` : '/aiva/workers'}
                      label="Direct work"
                      detail="Chat, assign, and review"
                      icon={Zap}
                      tone="bg-emerald-400/15 text-emerald-200"
                    />
                    <LauncherAction
                      href={latest ? `/aiva/workers/${latest.id}?tab=channels` : '/aiva/workers'}
                      label="Channels"
                      detail={needsChannel ? 'Connection needed' : 'Email and chat routes'}
                      icon={PlugZap}
                      tone="bg-[#1eb7d4]/15 text-[#7dd3fc]"
                    />
                    <LauncherAction
                      href="/aiva/approvals"
                      label="Approvals"
                      detail="Drafts and completed work"
                      icon={Inbox}
                      tone="bg-[#8b5cf6]/15 text-[#c4b5fd]"
                    />
                    <LauncherAction
                      href="/aiva/governance"
                      label="Governance"
                      detail="Trust and audit state"
                      icon={ShieldCheck}
                      tone="bg-emerald-400/15 text-emerald-200"
                    />
                  </div>
                </div>
              </section>

              <aside className="space-y-4">
                {glance ? (
                  <section className="rounded-[24px] border border-white/10 bg-[#0a1821]/82 p-5 backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7895a8]">Plan</p>
                        <p className="mt-1 text-xl font-semibold text-white">{glance.planLabel}</p>
                      </div>
                      <CreditCard className="h-5 w-5 text-[#f5a623]" aria-hidden />
                    </div>
                    <MobileStatStrip
                      items={[
                        ...(glance.usageLabel
                          ? [{ id: 'usage', label: 'Usage', value: glance.usageLabel }]
                          : []),
                        ...(glance.trialLabel
                          ? [{ id: 'trial', label: 'Trial', value: glance.trialLabel }]
                          : [{ id: 'billing', label: 'Billing', value: 'Manage' }]),
                      ]}
                    />
                    <Link
                      href="/billing/aiva"
                      className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-[#f5a623] transition hover:border-[#f5a623]/35 hover:bg-[#f5a623]/10"
                    >
                      View plan and credits
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </section>
                ) : null}

                {needsChannel && latest ? (
                  <section className="rounded-[24px] border border-[#f5a623]/25 bg-[#2a1d0a]/70 p-5">
                    <div className="flex items-start gap-3">
                      <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-[#f5a623]" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold text-white">Connect {latest.name}</p>
                        <p className="mt-1 text-sm leading-6 text-[#dec9a1]">
                          Add email or chat so the employee can receive work.
                        </p>
                        <Link
                          href={`/aiva/workers/${latest.id}?tab=channels`}
                          className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#f5a623] px-4 text-sm font-semibold text-[#08151c]"
                        >
                          Connect channel
                        </Link>
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className="rounded-[24px] border border-white/10 bg-[#0a1821]/82 p-5 backdrop-blur">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7895a8]">Team</p>
                      <h3 className="mt-1 text-lg font-semibold text-white">AI Employees</h3>
                    </div>
                    <Link href="/aiva/workers" className="text-sm font-medium text-[#f5a623] hover:text-[#ffbd4a]">
                      View all
                    </Link>
                  </div>
                  {workers.length === 0 ? (
                    <MobileEmptyState
                      icon={<Bot className="h-10 w-10" />}
                      title="No AI Employees yet"
                      description="Hire your first AI Employee. Powered by Carina, with visible escalation when human review is needed."
                      action={
                        <Link
                          href="/aiva"
                          className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[#f5a623] text-sm font-medium text-[#08151c]"
                        >
                          Hire AI Employee
                        </Link>
                      }
                    />
                  ) : (
                    <div className="grid gap-3">
                      {workerPreview.map((worker) => (
                        <WorkerCommandCard key={worker.id} worker={worker} />
                      ))}
                    </div>
                  )}
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <Link href="/aiva/approvals" className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm font-medium text-white transition hover:border-white/20">
                    <Inbox className="mb-3 h-5 w-5 text-[#7dd3fc]" aria-hidden />
                    Approval inbox
                  </Link>
                  <Link href="/settings" className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm font-medium text-white transition hover:border-white/20">
                    <Settings className="mb-3 h-5 w-5 text-[#c4b5fd]" aria-hidden />
                    Account
                  </Link>
                </section>
              </aside>
            </div>
          )}
        </MobileScreen>
      </div>

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
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm text-text-primary hover:bg-overlay"
            >
              <item.icon className="h-4 w-4 text-text-muted" aria-hidden />
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-danger hover:bg-overlay"
            onClick={() => authClient.signOut().then(() => { window.location.href = '/login'; })}
          >
            Sign out
          </button>
        </nav>
      </MobileSheet>
    </div>
  );
}

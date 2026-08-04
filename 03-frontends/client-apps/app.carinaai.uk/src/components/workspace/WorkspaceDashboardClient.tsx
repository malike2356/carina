'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Database,
  LayoutDashboard,
  LayoutList,
  Loader2,
  Settings,
  Sparkles,
  MessageSquare,
  Search,
  ScrollText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';

type DashboardData = {
  sessions: number;
  skills: number;
  models: number;
  configReady: boolean;
  features: {
    chat: boolean;
    memory: boolean;
    packs: boolean;
    billing: boolean;
    scout: boolean;
  };
  surface: string;
  workspace?: {
    id?: string;
    plan?: string;
  };
};

type SummaryCard = {
  href: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  count?: string;
};

const QUICK_LINKS: SummaryCard[] = [
  {
    href: '/sessions',
    title: 'Sessions',
    description: 'Browse recent chat sessions and reopen threads.',
    icon: LayoutList,
  },
  {
    href: '/skills',
    title: 'Skills',
    description: 'Review built-in skills and add custom ones.',
    icon: Sparkles,
  },
  {
    href: '/models',
    title: 'Models',
    description: 'See which providers and models are available.',
    icon: Bot,
  },
  {
    href: '/config',
    title: 'Config',
    description: 'Inspect the current workspace config surface.',
    icon: Settings,
  },
  {
    href: '/logs',
    title: 'Logs',
    description: 'Open the workspace log stream.',
    icon: ScrollText,
  },
  {
    href: '/analytics',
    title: 'Analytics',
    description: 'Review activity and usage metrics.',
    icon: Search,
  },
];

export function WorkspaceDashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const [sessionsRes, skillsRes, modelsRes, configRes] = await Promise.all([
          fetch('/api/sessions?page=0'),
          fetch('/api/skills'),
          fetch('/api/models'),
          fetch('/api/config'),
        ]);

        const [sessionsJson, skillsJson, modelsJson, configJson] = await Promise.all([
          sessionsRes.json(),
          skillsRes.json(),
          modelsRes.json(),
          configRes.json(),
        ]);

        if (!mounted) return;

        setData({
          sessions: Array.isArray(sessionsJson.data) ? sessionsJson.data.length : 0,
          skills: Array.isArray(skillsJson.data) ? skillsJson.data.length : 0,
          models: Array.isArray(modelsJson.data) ? modelsJson.data.length : 0,
          configReady: Boolean(configJson?.features),
          features: configJson?.features ?? {
            chat: false,
            memory: false,
            packs: false,
            billing: false,
            scout: false,
          },
          surface: String(configJson?.surface ?? 'cloud'),
          workspace: configJson?.workspace,
        });
      } catch {
        if (!mounted) return;
        setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo<SummaryCard[]>(
    () => [
      {
        href: '/sessions',
        title: 'Sessions',
        description: 'Recent and pinned chat sessions.',
        icon: MessageSquare,
        count: loading ? 'Loading' : `${data?.sessions ?? 0}`,
      },
      {
        href: '/skills',
        title: 'Skills',
        description: 'Built-in and custom skills.',
        icon: Sparkles,
        count: loading ? 'Loading' : `${data?.skills ?? 0}`,
      },
      {
        href: '/models',
        title: 'Models',
        description: 'Available provider model combinations.',
        icon: Bot,
        count: loading ? 'Loading' : `${data?.models ?? 0}`,
      },
      {
        href: '/config',
        title: 'Config',
        description: 'Workspace config and feature gates.',
        icon: Settings,
        count: loading ? 'Loading' : data?.configReady ? 'Ready' : 'Missing',
      },
    ],
    [data, loading],
  );

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-text-muted">
        <Spinner />
        <span>Loading dashboard</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-muted">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Workspace overview
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            First-class web surface for the core workspace. Sessions, skills, models, config, logs,
            and analytics live here without a redirect hop.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/sessions" className="rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary hover:text-text-primary">
            Open sessions
          </Link>
          <Link href="/skills" className="rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary hover:text-text-primary">
            Manage skills
          </Link>
          <Link href="/config" className="rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary hover:text-text-primary">
            View config
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="transition-shadow hover:shadow-md">
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{card.title}</CardTitle>
                  <p className="mt-1 text-xs text-text-muted">{card.description}</p>
                </div>
                <Icon className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent className="flex items-center justify-between pt-0">
                <p className="text-2xl font-semibold text-text-primary">{card.count ?? '0'}</p>
                <Link href={card.href} className="text-xs font-medium text-accent hover:underline">
                  Open
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
            <p className="text-sm text-text-muted">The missing Hermes-style first-class workspace pages.</p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {QUICK_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border border-border bg-elevated/60 p-4 transition-colors hover:border-accent/40 hover:bg-accent/5"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 text-accent" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary">{item.title}</div>
                      <div className="mt-1 text-xs text-text-muted">{item.description}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace status</CardTitle>
            <p className="text-sm text-text-muted">Configuration and feature readiness.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow label="Surface" value={data?.surface ?? 'cloud'} />
            <StatusRow label="Chat" value={data?.features.chat ? 'enabled' : 'disabled'} />
            <StatusRow label="Memory" value={data?.features.memory ? 'enabled' : 'disabled'} />
            <StatusRow label="Packs" value={data?.features.packs ? 'enabled' : 'disabled'} />
            <StatusRow label="Billing" value={data?.features.billing ? 'enabled' : 'disabled'} />
            <StatusRow label="Scout" value={data?.features.scout ? 'enabled' : 'disabled'} />
            {data?.workspace?.plan ? (
              <StatusRow label="Plan" value={data.workspace.plan} />
            ) : null}
            {!data?.configReady ? (
              <EmptyState
                icon={<Loader2 className="h-4 w-4 animate-spin" />}
                title="Config data unavailable"
                subtitle="The config API did not return feature data."
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated/40 px-3 py-2">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <span className="text-xs text-text-primary">{value}</span>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Globe,
  Hash,
  LayoutList,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  Smartphone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  INTEGRATION_CATALOG,
  INTEGRATION_GROUPS,
  type IntegrationDef,
} from '@/lib/integration-catalog';
import type { IntegrationStatus } from '@/lib/integration-status';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, LucideIcon> = {
  Hash,
  MessageCircle,
  Send,
  Mail,
  Globe,
  MessageSquare,
  Phone,
  Users,
  LayoutList,
  CalendarDays,
  Smartphone,
};

type IntegrationCatalogProps = {
  className?: string;
  compact?: boolean;
};

export function IntegrationCatalog({ className, compact = false }: IntegrationCatalogProps) {
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStatuses() {
      setLoading(true);
      setStatusError(null);

      try {
        const res = await fetch('/api/channels/status', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) {
            setStatusError(res.status === 401 ? 'Sign in to see connection status.' : 'Status check unavailable.');
            setLoading(false);
          }
          return;
        }

        const data = (await res.json()) as { statuses?: Record<string, IntegrationStatus> };
        if (!cancelled) {
          setStatuses(data.statuses ?? {});
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setStatusError('Status check unavailable.');
          setLoading(false);
        }
      }
    }

    void loadStatuses();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={cn('space-y-8', className)}>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking connection status...
        </div>
      ) : null}
      {!loading && statusError ? (
        <p className="text-xs text-text-muted">{statusError}</p>
      ) : null}
      {INTEGRATION_GROUPS.map((group) => (
        <section key={group.id}>
          <h2 className="mb-3 text-sm font-medium text-text-secondary">{group.label}</h2>
          <div
            className={cn(
              'grid gap-3',
              compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
            )}
          >
            {INTEGRATION_CATALOG.filter((item) => item.group === group.id).map((item) => (
              <IntegrationCard
                key={item.slug}
                item={item}
                status={statuses[item.slug] ?? 'unknown'}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function statusLabel(status: IntegrationStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'partial':
      return 'Partially connected';
    case 'not_connected':
      return 'Not connected';
    default:
      return 'Unknown';
  }
}

function statusClass(status: IntegrationStatus): string {
  switch (status) {
    case 'connected':
      return 'text-emerald-400';
    case 'partial':
      return 'text-amber-400';
    default:
      return 'text-text-secondary';
  }
}

function IntegrationCard({
  item,
  status,
}: {
  item: IntegrationDef;
  status: IntegrationStatus;
}) {
  const Icon = ICON_MAP[item.iconName] ?? MessageSquare;
  const href = item.configureHref;

  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/40 hover:bg-elevated"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-border bg-base p-2">
          <Icon className="h-4 w-4 text-text-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-text-primary">{item.label}</p>
            <span className={cn('text-[10px] font-medium uppercase tracking-wide', statusClass(status))}>
              {statusLabel(status)}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">{item.description}</p>
          <p className="mt-2 text-xs text-accent">Configure</p>
        </div>
      </div>
    </Link>
  );
}

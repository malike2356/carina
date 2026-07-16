'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Globe,
  Hash,
  LayoutList,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  Smartphone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ConnectChannelInline } from '@/components/aiva/ConnectChannelInline';
import { ChannelIcon } from '@/components/aiva/ChannelIcon';
import { ErrorState } from '@/components/ui/ErrorState';
import { CardGridSkeleton } from '@/components/ui/Skeleton';
import type { AivaChannelCard, AivaWorker } from '@/lib/aiva-types';
import {
  formatSetupTime,
  quickConnectByTier,
  type QuickConnectChannel,
} from '@/lib/channel-quick-connect';
import { INTEGRATION_CATALOG } from '@/lib/integration-catalog';
import type { IntegrationStatus } from '@/lib/integration-status';

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

type ConnectedRow = {
  workerId: string;
  workerName: string;
  channelType: string;
  channelLabel: string;
  channel: AivaChannelCard;
};

export function ChannelsPageClient() {
  const [workers, setWorkers] = useState<AivaWorker[]>([]);
  const [connectedRows, setConnectedRows] = useState<ConnectedRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [statusRes, workersRes] = await Promise.all([
        fetch('/api/channels/status', { credentials: 'include' }),
        fetch('/api/aiva/workers'),
      ]);

      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as {
          statuses?: Record<string, IntegrationStatus>;
        };
        setStatuses(statusData.statuses ?? {});
      }

      const workersData = (await workersRes.json()) as { workers?: AivaWorker[]; error?: string };
      if (!workersRes.ok) {
        setError(workersData.error ?? 'Could not load Aivas');
        setWorkers([]);
        setConnectedRows([]);
        return;
      }

      const nextWorkers = workersData.workers ?? [];
      setWorkers(nextWorkers);
      setSelectedWorkerId((current) => {
        if (current && nextWorkers.some((w) => w.id === current)) return current;
        return nextWorkers[0]?.id ?? '';
      });

      const rows: ConnectedRow[] = [];
      await Promise.all(
        nextWorkers.map(async (worker) => {
          const channelsRes = await fetch(`/api/aiva/workers/${worker.id}/channels`);
          const channelsData = (await channelsRes.json()) as { channels?: AivaChannelCard[] };
          for (const channel of channelsData.channels ?? []) {
            if (!channel.connected) continue;
            const catalog = INTEGRATION_CATALOG.find((item) => item.aivaChannelType === channel.type);
            rows.push({
              workerId: worker.id,
              workerName: worker.name,
              channelType: channel.type,
              channelLabel: catalog?.label ?? channel.label ?? channel.type,
              channel,
            });
          }
        }),
      );
      setConnectedRows(rows);
    } catch {
      setError('Could not load channels');
      setWorkers([]);
      setConnectedRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);
  const quickChannels = quickConnectByTier(false);
  const advancedChannels = quickConnectByTier(true);

  function handleSetupComplete(channelId: string) {
    if (channelId !== 'web') {
      setExpandedChannelId(null);
    }
    void load();
  }

  if (loading) {
    return (
      <div className="page-container py-4">
        <CardGridSkeleton count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container py-4">
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <div className="page-container flex min-h-0 flex-1 flex-col py-4">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-text-primary">Channels</h1>
        <p className="mt-1 text-xs text-text-muted">
          Connect messaging channels in one tap. No developer console required for quick connect.
        </p>
      </header>

      {workers.length === 0 ? (
        <div className="mobile-card mb-6">
          <p className="text-sm text-text-secondary">Hire an Aiva first, then connect channels here.</p>
          <Link href="/aiva" className="btn-primary mobile-btn mt-3 inline-flex">
            Hire an Aiva
          </Link>
        </div>
      ) : workers.length > 1 ? (
        <div className="form-group mb-4">
          <label htmlFor="channel-worker" className="text-xs font-medium text-text-primary">
            Connect for
          </label>
          <select
            id="channel-worker"
            value={selectedWorkerId}
            onChange={(e) => {
              setSelectedWorkerId(e.target.value);
              setExpandedChannelId(null);
            }}
            className="form-input"
          >
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
        </div>
      ) : selectedWorker ? (
        <p className="mb-4 text-xs text-text-muted">
          Connecting channels for <span className="text-text-secondary">{selectedWorker.name}</span>
        </p>
      ) : null}

      {connectedRows.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            Connected ({connectedRows.length})
          </h2>
          <div className="flex flex-col gap-2">
            {connectedRows.map((row) => (
              <div key={`${row.workerId}-${row.channel.id}`} className="mobile-card">
                <div className="flex items-start gap-3">
                  <ChannelIcon channel={row.channelType} className="mt-0.5 h-5 w-5 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{row.channelLabel}</p>
                    <p className="text-xs text-text-muted">{row.workerName}</p>
                    {row.channel.identifier ? (
                      <p className="mt-1 truncate text-xs text-text-secondary">{row.channel.identifier}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-text-muted">
                      Active · {(row.channel.messageCount ?? 0).toLocaleString()} messages
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}


      {workers.length > 0 && selectedWorkerId ? (
        <>
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
              Quick connect
            </h2>
            <div className="flex flex-col gap-2">
              {quickChannels.map((channel) => (
                <QuickConnectCard
                  key={channel.id}
                  channel={channel}
                  status={statuses[channel.id] ?? 'not_connected'}
                  expanded={expandedChannelId === channel.id}
                  onToggle={() =>
                    setExpandedChannelId((current) =>
                      current === channel.id ? null : channel.id,
                    )
                  }
                  workerId={selectedWorkerId}
                  onComplete={() => handleSetupComplete(channel.id)}
                />
              ))}
            </div>
          </section>

          <section>
            <button
              type="button"
              onClick={() => setShowAdvanced((open) => !open)}
              className="mb-2 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              {showAdvanced ? 'Hide advanced' : 'Advanced channels'}
            </button>
            {showAdvanced ? (
              <div className="flex flex-col gap-2">
                {advancedChannels.map((channel) => (
                  <QuickConnectCard
                    key={channel.id}
                    channel={channel}
                    status={statuses[channel.id] ?? 'not_connected'}
                    expanded={expandedChannelId === channel.id}
                    onToggle={() =>
                      setExpandedChannelId((current) =>
                        current === channel.id ? null : channel.id,
                      )
                    }
                    workerId={selectedWorkerId}
                    onComplete={() => handleSetupComplete(channel.id)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function QuickConnectCard({
  channel,
  status,
  expanded,
  onToggle,
  workerId,
  onComplete,
}: {
  channel: QuickConnectChannel;
  status: IntegrationStatus;
  expanded: boolean;
  onToggle: () => void;
  workerId: string;
  onComplete: () => void;
}) {
  const Icon = ICON_MAP[channel.iconName] ?? MessageSquare;
  const setupLabel =
    channel.setupType === 'oauth'
      ? `OAuth · ${formatSetupTime(channel.estimatedSeconds)}`
      : `${formatSetupTime(channel.estimatedSeconds)} setup`;

  return (
    <div className="mobile-card overflow-hidden p-0">
      {!expanded ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          <div className="rounded-md border border-border bg-base p-2">
            <Icon className="h-4 w-4 text-text-muted" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-text-primary">{channel.name}</p>
              {status === 'connected' ? (
                <span className="text-[10px] font-medium uppercase text-emerald-400">Connected</span>
              ) : null}
            </div>
            <p className="text-xs text-text-muted">{setupLabel}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
        </button>
      ) : (
        <div className="border-t border-border p-4">
          <ConnectChannelInline
            workerId={workerId}
            channelType={channel.aivaChannelType}
            channelLabel={channel.name}
            onComplete={onComplete}
            onCancel={onToggle}
          />
        </div>
      )}
    </div>
  );
}

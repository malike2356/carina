'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { ConnectChannelModal } from '@/components/aiva/ConnectChannelModal';
import { ChannelIcon } from '@/components/aiva/ChannelIcon';
import type { AivaChannelCard, AivaWorker } from '@/lib/aiva-types';
import { cn } from '@/lib/utils';

type WorkerChannelRow = {
  workerId: string;
  workerName: string;
  channel: AivaChannelCard | null;
};

type AivaChannelConnectionsPanelProps = {
  channelType: string;
  channelLabel: string;
  description?: string;
  className?: string;
};

export function AivaChannelConnectionsPanel({
  channelType,
  channelLabel,
  description,
  className,
}: AivaChannelConnectionsPanelProps) {
  const [rows, setRows] = useState<WorkerChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectWorkerId, setConnectWorkerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const workersRes = await fetch('/api/aiva/workers');
      const workersData = (await workersRes.json()) as { workers?: AivaWorker[]; error?: string };
      if (!workersRes.ok) {
        setError(workersData.error ?? 'Could not load Aivas');
        setRows([]);
        return;
      }
      const workers = workersData.workers ?? [];
      const nextRows = await Promise.all(
        workers.map(async (worker) => {
          const channelsRes = await fetch(`/api/aiva/workers/${worker.id}/channels`);
          const channelsData = (await channelsRes.json()) as { channels?: AivaChannelCard[] };
          const channel =
            channelsData.channels?.find((item) => item.type === channelType) ?? null;
          return { workerId: worker.id, workerName: worker.name, channel };
        }),
      );
      setRows(nextRows);
    } catch {
      setError(`Could not load ${channelLabel} connections`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [channelLabel, channelType]);

  useEffect(() => {
    void load();
  }, [load]);

  async function disconnect(workerId: string, channelId: string) {
    if (!window.confirm(`Disconnect ${channelLabel} for this Aiva?`)) return;
    const res = await fetch(`/api/aiva/workers/${workerId}/channels/${channelId}`, {
      method: 'DELETE',
    });
    if (res.ok) void load();
  }

  const connectedCount = rows.filter((row) => row.channel?.connected).length;

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-text-muted', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading {channelLabel} connections...
      </div>
    );
  }

  if (error) {
    return <p className={cn('text-xs text-danger', className)}>{error}</p>;
  }

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-lg border border-border bg-surface p-4', className)}>
        <p className="text-sm text-text-secondary">
          Hire an Aiva first, then connect {channelLabel} here or from the worker Channels tab.
        </p>
        <Link
          href="/aiva"
          className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          Hire an Aiva
        </Link>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-xs text-text-muted">
        {description ??
          (connectedCount > 0
            ? `${connectedCount} of ${rows.length} Aiva${rows.length === 1 ? '' : 's'} connected to ${channelLabel}.`
            : `${channelLabel} connects per Aiva worker. Add credentials for each Aiva below.`)}
      </p>
      <div className="space-y-3">
        {rows.map((row) => {
          const connected = row.channel?.connected ?? false;
          return (
            <div key={row.workerId} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <ChannelIcon channel={channelType} className="mt-0.5 h-4 w-4 text-text-muted" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{row.workerName}</p>
                    <p className="text-xs text-text-muted">
                      {connected
                        ? row.channel?.identifier ?? `${channelLabel} connected`
                        : `${channelLabel} not connected`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {connected ? (
                    <button
                      type="button"
                      onClick={() => void disconnect(row.workerId, row.channel!.id)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-danger hover:bg-elevated"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConnectWorkerId(row.workerId)}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs text-black"
                    >
                      Connect {channelLabel}
                    </button>
                  )}
                  <Link
                    href={`/aiva/workers/${row.workerId}?tab=channels`}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-elevated"
                  >
                    Channels tab
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {connectWorkerId ? (
        <ConnectChannelModal
          workerId={connectWorkerId}
          channelType={channelType}
          channelLabel={channelLabel}
          open
          onClose={() => setConnectWorkerId(null)}
          onConnected={() => {
            setConnectWorkerId(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

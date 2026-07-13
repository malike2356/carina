'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Clock,
  Copy,
  Check,
  ClipboardCheck,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { AivaAvatar } from '@/components/aiva/AivaAvatar';
import { ConnectChannelModal } from '@/components/aiva/ConnectChannelModal';
import { EmailSenderAllowlist } from '@/components/aiva/EmailSenderAllowlist';
import { ConnectorResourceScopePanel } from '@/components/aiva/ConnectorResourceScopePanel';
import { ActionBadge } from '@/components/aiva/ActionBadge';
import { ChannelIcon } from '@/components/aiva/ChannelIcon';
import { StatusChip } from '@/components/aiva/StatusChip';
import { UsageBadge } from '@/components/aiva/UsageBadge';
import {
  MobileSheet,
  MobileSkeleton,
  MobileStatStrip,
  MobileTabs,
} from '@/components/aiva/mobile';
import { AIVA_CORE_TABS, type AivaTab } from '@/app/(workspace)/aiva/workers/[id]/aiva-detail-tabs';
import { TrainingTab } from '@/components/aiva/TrainingTab';
import { ScoutWorkerStatus } from '@/components/aiva/ScoutWorkerStatus';
import { PlanGateSection } from '@/components/billing/PlanGateSection';
import { CarinaEditor } from '@/components/editor';
import { PropreneurBindingPanel } from '@/components/aiva/PropreneurBindingPanel';
import type {
  AivaActivityItem,
  AivaAuditRow,
  AivaAutomation,
  AivaAutomationRun,
  AivaChannelCard,
  AivaEmployeeEvent,
  AivaEmployeeMessage,
  AivaEmployeeTask,
  AivaUsageBar,
  AivaWorker,
} from '@/lib/aiva-types';
import {
  AIVA_INPUT_CLASS,
  formatDate,
  formatTimestamp,
  maskIdentifier,
  readAivaError,
  timeAgo,
} from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

const CHAIN_EXPLORER_URL =
  process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL ?? 'https://etherscan.io/tx';

function PauseResumeButton({
  workerId,
  status,
  onStatusChange,
}: {
  workerId: string;
  status: string;
  onStatusChange: (s: string) => void;
}) {
  const isPaused = status === 'paused';

  async function toggle() {
    if (!isPaused && !window.confirm('Pause this Aiva? Message processing will stop.')) {
      return;
    }
    const next = isPaused ? 'active' : 'paused';
    const res = await fetch(`/api/aiva/workers/${workerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) onStatusChange(next);
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      className="btn-ghost flex items-center gap-1.5 text-xs"
    >
      {isPaused ? (
        <>
          <Play className="h-3.5 w-3.5" /> Resume
        </>
      ) : (
        <>
          <Pause className="h-3.5 w-3.5" /> Pause
        </>
      )}
    </button>
  );
}

function OverviewTab({
  worker,
  activity,
  usageBar,
  workerId,
}: {
  worker: AivaWorker;
  activity: AivaActivityItem[];
  usageBar: AivaUsageBar | null;
  workerId: string;
}) {
  const [conversations, setConversations] = useState<
    Array<{ id: string; channel: string; contactId: string; lastMessageAt: string | null; messageCount: number }>
  >([]);

  useEffect(() => {
    void fetch(`/api/aiva/workers/${workerId}/conversations?limit=5`)
      .then((res) => res.json())
      .then((data: { conversations?: typeof conversations }) => setConversations(data.conversations ?? []))
      .catch(() => setConversations([]));
  }, [workerId]);
  const stats = [
    { label: 'Today', value: worker.messagesToday ?? 0 },
    { label: 'Total', value: worker.totalMessages ?? 0 },
    {
      label: 'Escalation',
      value: `${((worker.escalationRate ?? 0) * 100).toFixed(1)}%`,
    },
    { label: 'Automations', value: worker.automationsRan ?? 0 },
  ];

  const pct =
    usageBar && usageBar.limit > 0
      ? Math.round((usageBar.count / usageBar.limit) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="lg:hidden">
        <MobileStatStrip
          items={stats.map((s) => ({
            id: s.label,
            label: s.label,
            value: s.value,
          }))}
        />
      </div>

      <div className="hidden grid-cols-2 gap-3 sm:grid-cols-4 lg:grid">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-elevated p-4">
            <p className="text-2xl font-semibold text-text-primary">{s.value}</p>
            <p className="mt-0.5 text-xs text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {usageBar ? (
        <div className="hidden rounded-lg border border-border bg-elevated p-4 lg:block">
          <div className="mb-2 flex justify-between text-xs text-text-muted">
            <span>Messages this month</span>
            <span>
              {usageBar.count.toLocaleString()} / {usageBar.limit.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-overlay">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                pct < 60 ? 'bg-green-400' : pct < 85 ? 'bg-amber-400' : 'bg-red-400',
              )}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-text-muted">
            Resets {formatDate(usageBar.resetsAt)}
          </p>
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-text-primary">Recent conversations</h3>
          <Link href="/conversations" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        {conversations.length === 0 ? (
          <p className="text-xs text-text-muted">No conversations yet.</p>
        ) : (
          <div className="space-y-2">
            {conversations.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                <div>
                  <p className="font-medium text-text-primary">{row.contactId}</p>
                  <p className="text-text-muted capitalize">{row.channel}</p>
                </div>
                <span className="text-text-muted">{timeAgo(row.lastMessageAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-text-primary">Recent activity</h3>
        {activity.length === 0 ? (
          <p className="text-xs text-text-muted">No activity yet.</p>
        ) : (
          <div className="space-y-1">
            {activity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-1">
                <span className="w-20 shrink-0 text-[11px] text-text-muted">
                  {timeAgo(item.createdAt)}
                </span>
                <ActionBadge type={item.actionType} />
                <span className="truncate text-xs text-text-secondary">{item.summary}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DirectWorkTab({ worker }: { worker: AivaWorker }) {
  const [messages, setMessages] = useState<AivaEmployeeMessage[]>([]);
  const [tasks, setTasks] = useState<AivaEmployeeTask[]>([]);
  const [events, setEvents] = useState<AivaEmployeeEvent[]>([]);
  const [message, setMessage] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskInstructions, setTaskInstructions] = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWork = useCallback(async () => {
    try {
      const [threadRes, tasksRes, eventsRes] = await Promise.all([
        fetch(`/api/aiva/employees/${worker.id}/thread?limit=30`),
        fetch(`/api/aiva/employees/${worker.id}/tasks?limit=20`),
        fetch(`/api/aiva/employees/${worker.id}/events?limit=20`),
      ]);
      if (threadRes.ok) {
        const data = (await threadRes.json()) as { messages?: AivaEmployeeMessage[] };
        setMessages(data.messages ?? []);
      }
      if (tasksRes.ok) {
        const data = (await tasksRes.json()) as { tasks?: AivaEmployeeTask[] };
        setTasks(data.tasks ?? []);
      }
      if (eventsRes.ok) {
        const data = (await eventsRes.json()) as { events?: AivaEmployeeEvent[] };
        setEvents(data.events ?? []);
      }
    } catch {
      setError('Could not load direct employee work.');
    }
  }, [worker.id]);

  useEffect(() => {
    void loadWork();
  }, [loadWork]);

  async function sendDirectMessage() {
    const content = message.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/aiva/employees/${worker.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(await readAivaError(res));
      setMessage('');
      await loadWork();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setBusy(false);
    }
  }

  async function assignTask() {
    const title = taskTitle.trim();
    const instructions = taskInstructions.trim();
    if (!title || !instructions || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/aiva/employees/${worker.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, instructions, priority: taskPriority }),
      });
      if (!res.ok) throw new Error(await readAivaError(res));
      setTaskTitle('');
      setTaskInstructions('');
      setTaskPriority('normal');
      await loadWork();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign task.');
    } finally {
      setBusy(false);
    }
  }

  async function updateTask(task: AivaEmployeeTask, status: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/aiva/employees/${worker.id}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await readAivaError(res));
      await loadWork();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update task.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-border bg-elevated p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Direct chat</h2>
            <p className="text-xs text-text-muted">Message {worker.name} inside Carina without opening a channel app.</p>
          </div>
          <MessageSquare className="h-4 w-4 text-accent" aria-hidden />
        </div>
        <div className="min-h-64 space-y-3 rounded-lg border border-border bg-surface p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-text-muted">No direct messages yet. Send an instruction or assign work from this page.</p>
          ) : (
            messages.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'max-w-[82%] rounded-lg px-3 py-2 text-sm',
                  item.sender === 'user'
                    ? 'ml-auto bg-accent text-white'
                    : 'mr-auto border border-border bg-elevated text-text-primary',
                )}
              >
                <p className="whitespace-pre-wrap">{item.content}</p>
                <p className={cn('mt-1 text-[10px]', item.sender === 'user' ? 'text-white/70' : 'text-text-muted')}>
                  {item.sender === 'user' ? 'You' : worker.name} · {timeAgo(item.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={2}
            className={cn(AIVA_INPUT_CLASS, 'min-h-14 flex-1 resize-none')}
            placeholder={`Message ${worker.name}`}
          />
          <button
            type="button"
            onClick={() => void sendDirectMessage()}
            disabled={busy || !message.trim()}
            className="btn-primary inline-flex min-h-14 items-center gap-2 px-4 text-sm disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden />
            Send
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-border bg-elevated p-4">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-accent" aria-hidden />
            <h2 className="text-sm font-semibold text-text-primary">Assign task</h2>
          </div>
          <div className="space-y-2">
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              className={AIVA_INPUT_CLASS}
              placeholder="Task title"
            />
            <textarea
              value={taskInstructions}
              onChange={(event) => setTaskInstructions(event.target.value)}
              rows={4}
              className={cn(AIVA_INPUT_CLASS, 'resize-none')}
              placeholder="Instructions, acceptance criteria, and expected output"
            />
            <select
              value={taskPriority}
              onChange={(event) => setTaskPriority(event.target.value)}
              className={AIVA_INPUT_CLASS}
            >
              <option value="normal">Normal priority</option>
              <option value="high">High priority</option>
              <option value="urgent">Urgent priority</option>
              <option value="low">Low priority</option>
            </select>
            <button
              type="button"
              onClick={() => void assignTask()}
              disabled={busy || !taskTitle.trim() || !taskInstructions.trim()}
              className="btn-primary w-full text-sm disabled:opacity-50"
            >
              Assign task
            </button>
          </div>
          {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
        </section>

        <section className="rounded-lg border border-border bg-elevated p-4">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Work queue</h2>
          {tasks.length === 0 ? (
            <p className="text-xs text-text-muted">No assigned work yet.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{task.title}</p>
                      <p className="mt-1 text-xs text-text-muted">{task.priority} · {task.status}</p>
                    </div>
                    {task.status === 'done' ? (
                      <button
                        type="button"
                        onClick={() => void updateTask(task, 'approved')}
                        className="btn-ghost text-xs"
                      >
                        Approve
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs text-text-secondary">{task.instructions}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-elevated p-4">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Activity timeline</h2>
          {events.length === 0 ? (
            <p className="text-xs text-text-muted">No direct work events yet.</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="border-l border-border pl-3">
                  <p className="text-xs font-medium text-text-primary">{event.summary}</p>
                  <p className="text-[11px] text-text-muted">{event.eventType} · {timeAgo(event.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

function ChannelToggle({
  workerId,
  channelId,
  active,
  onToggle,
}: {
  workerId: string;
  channelId: string;
  active: boolean;
  onToggle: (id: string, active: boolean) => void;
}) {
  const [localActive, setLocalActive] = useState(active);

  async function toggle() {
    const next = !localActive;
    setLocalActive(next);
    const res = await fetch(`/api/aiva/workers/${workerId}/channels/${channelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: next }),
    });
    if (!res.ok) setLocalActive(!next);
    else onToggle(channelId, next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={localActive}
      onClick={() => void toggle()}
      className={cn(
        'relative h-5 w-9 rounded-full transition-colors',
        localActive ? 'bg-accent' : 'bg-overlay',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
          localActive ? 'left-4' : 'left-0.5',
        )}
      />
    </button>
  );
}

function EmbedSnippetCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="absolute top-2 right-2 flex items-center gap-1 rounded border border-border bg-elevated px-2 py-1 text-[11px] text-text-muted transition-colors hover:text-text-primary"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function ChannelsTab({
  workerId,
  channels,
  planTier,
  channelLimit,
  connectedCount,
  onChannelsChange,
  onReload,
}: {
  workerId: string;
  channels: AivaChannelCard[];
  planTier: string;
  channelLimit: number | null;
  connectedCount: number;
  onChannelsChange: (ch: AivaChannelCard[]) => void;
  onReload: () => void;
}) {
  const [connectTarget, setConnectTarget] = useState<AivaChannelCard | null>(null);
  const atChannelLimit =
    channelLimit !== null && connectedCount >= channelLimit;
  const embedSnippet = `<script src="https://core.carinaai.uk/widget.js" data-aiva-id="${workerId}"></script>`;
  const webChannelLive = channels.some(
    (ch) => ch.type === 'web' && ch.connected && (ch.active ?? true),
  );

  async function disconnect(channelId: string) {
    if (!window.confirm('Disconnect this channel?')) return;
    const res = await fetch(`/api/aiva/workers/${workerId}/channels/${channelId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      onChannelsChange(
        channels.map((c) =>
          c.id === channelId ? { ...c, connected: false, identifier: undefined } : c,
        ),
      );
    }
  }

  return (
    <div className="space-y-4">
    {channelLimit !== null ? (
      <p className="text-xs text-text-muted">
        Starter plan: {connectedCount}/{channelLimit} channels (web + 1 messaging channel).{' '}
        {atChannelLimit ? (
          <Link href="/billing/aiva" className="text-accent hover:underline">
            Upgrade to Team
          </Link>
        ) : null}{' '}
        for all channels.
      </p>
    ) : null}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {channels.map((ch) =>
        ch.connected ? (
          <div key={ch.id} className="rounded-lg border border-accent/30 bg-elevated p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChannelIcon channel={ch.type} className="h-5 w-5" />
                <span className="text-sm font-medium text-text-primary">{ch.label}</span>
              </div>
              <ChannelToggle
                workerId={workerId}
                channelId={ch.id}
                active={ch.active ?? true}
                onToggle={(id, active) =>
                  onChannelsChange(
                    channels.map((c) => (c.id === id ? { ...c, active } : c)),
                  )
                }
              />
            </div>
            {ch.identifier ? (
              <div className="mb-3 space-y-1">
                {ch.type === 'email' ? (
                  <>
                    <p className="text-xs text-text-muted">
                      Your Aiva replies from your business email.
                    </p>
                    <p className="text-xs text-text-secondary">
                      Clients can email your Aiva at{' '}
                      <span className="font-mono">{ch.identifier}</span>. Share this address with them.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-text-muted">{maskIdentifier(ch.identifier, ch.type)}</p>
                )}
              </div>
            ) : ch.type === 'email' ? (
              <p className="mb-3 text-xs text-text-muted">
                Your Aiva replies from your business email once you connect this channel.
              </p>
            ) : null}
            <p className="mb-3 text-xs text-text-muted">
              {(ch.messageCount ?? 0).toLocaleString()} messages
            </p>
            <button
              type="button"
              onClick={() => void disconnect(ch.id)}
              className="text-xs text-danger hover:underline"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div
            key={ch.id}
            className="rounded-lg border border-dashed border-border p-4 opacity-60 transition-opacity hover:opacity-100"
          >
            <div className="mb-3 flex items-center gap-2">
              <ChannelIcon channel={ch.type} className="h-5 w-5 text-text-muted" />
              <span className="text-sm font-medium text-text-secondary">{ch.label}</span>
            </div>
            <p className="mb-3 text-xs text-text-muted">Not connected</p>
            {ch.type === 'email' ? (
              <p className="mb-3 text-xs text-text-muted">
                Your Aiva replies from your business email. Connect to get a dedicated address at mail.carinaai.uk.
              </p>
            ) : null}
            <button
              type="button"
              disabled={atChannelLimit}
              onClick={() => setConnectTarget(ch)}
              className={cn(
                'min-h-11 w-full rounded-lg px-3 text-sm font-medium sm:w-auto',
                atChannelLimit
                  ? 'cursor-not-allowed text-text-muted'
                  : 'border border-accent/40 bg-accent-dim text-accent hover:bg-accent/20',
              )}
            >
              {atChannelLimit ? 'Upgrade for more channels' : 'Connect'}
            </button>
          </div>
        ),
      )}
      {connectTarget ? (
        <ConnectChannelModal
          workerId={workerId}
          channelType={connectTarget.type}
          channelLabel={connectTarget.label}
          open={Boolean(connectTarget)}
          onClose={() => setConnectTarget(null)}
          onConnected={() => {
            setConnectTarget(null);
            onReload();
          }}
        />
      ) : null}
      {channels.some((ch) => ch.type === 'email' && ch.connected) ? (
        <EmailSenderAllowlist workerId={workerId} />
      ) : null}
      <ConnectorResourceScopePanel workerId={workerId} />
    </div>
    {webChannelLive ? (
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-overlay p-4">
          <p className="mb-1 text-xs font-medium text-text-primary">Try web chat</p>
          <p className="mb-3 text-[11px] text-text-muted">
            Message this Aiva in the app before embedding the widget on your site.
          </p>
          <Link
            href={`/aiva/workers/${workerId}/chat-preview`}
            className="inline-flex text-sm font-medium text-accent hover:underline"
          >
            Open chat preview
          </Link>
        </div>
        <div className="rounded-lg border border-border bg-overlay p-4">
        <p className="mb-1 text-xs font-medium text-text-primary">Embed snippet</p>
        <p className="mb-3 text-[11px] text-text-muted">
          Paste this snippet before the closing{' '}
          <code className="rounded bg-elevated px-1 font-mono">&lt;/body&gt;</code>{' '}
          tag on any page where you want this Aiva to appear.
        </p>
        <div className="relative">
          <pre className="select-all overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-base px-4 py-3 font-mono text-[11px] text-text-secondary">
            {embedSnippet}
          </pre>
          <EmbedSnippetCopyButton text={embedSnippet} />
        </div>
        </div>
      </div>
    ) : null}
    </div>
  );
}

function EnabledToggle({
  workerId,
  automationId,
  enabled,
  onChange,
}: {
  workerId: string;
  automationId: string;
  enabled: boolean;
  onChange: (id: string, enabled: boolean) => void;
}) {
  const [local, setLocal] = useState(enabled);

  async function toggle() {
    const next = !local;
    setLocal(next);
    const res = await fetch(
      `/api/aiva/workers/${workerId}/automations/${automationId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      },
    );
    if (!res.ok) setLocal(!next);
    else onChange(automationId, next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={local}
      onClick={() => void toggle()}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        local ? 'bg-accent' : 'bg-overlay',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
          local ? 'left-4' : 'left-0.5',
        )}
      />
    </button>
  );
}

function AutomationsTab({
  workerId,
  planTier,
  automations,
  onAutomationsChange,
}: {
  workerId: string;
  planTier: string;
  automations: AivaAutomation[];
  onAutomationsChange: (a: AivaAutomation[]) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerKind, setTriggerKind] = useState<'schedule' | 'event'>('schedule');
  const [schedulePreset, setSchedulePreset] = useState('daily');
  const [scheduleText, setScheduleText] = useState('');
  const [eventSource, setEventSource] = useState('email_received');
  const [actionType, setActionType] = useState('aiva_prompt');
  const [approvalMode, setApprovalMode] = useState('require_write');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [runs, setRuns] = useState<AivaAutomationRun[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  function buildSchedulePayload(): Record<string, unknown> | null {
    if (schedulePreset === 'custom') return null;
    if (schedulePreset === 'interval_30') return { type: 'interval', everyMinutes: 30 };
    if (schedulePreset === 'daily') return { type: 'daily', atHour: 9, atMinute: 0 };
    if (schedulePreset === 'weekly') return { type: 'weekly', weekday: 1, atHour: 9, atMinute: 0 };
    if (schedulePreset === 'monthly') return { type: 'monthly', day: 1, atHour: 9, atMinute: 0 };
    return { type: 'daily', atHour: 9, atMinute: 0 };
  }

  async function createAutomation(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        name,
        description,
        triggerKind,
        actionType,
        approvalMode,
        action:
          actionType === 'webhook_call'
            ? { type: 'webhook_call', url: webhookUrl, method: 'POST' }
            : actionType === 'playbook'
              ? { type: 'playbook' }
              : { type: 'aiva_prompt', prompt: description },
      };
      if (triggerKind === 'event') {
        body.triggerEvent = eventSource;
      } else {
        const schedule = buildSchedulePayload();
        if (schedule) body.schedule = schedule;
        else body.scheduleText = scheduleText;
      }

      const res = await fetch(`/api/aiva/workers/${workerId}/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setFormError(await readAivaError(res));
        return;
      }
      const data = (await res.json()) as { automation?: AivaAutomation };
      if (data.automation) {
        onAutomationsChange([data.automation, ...automations]);
      }
      setModalOpen(false);
      setName('');
      setDescription('');
      setScheduleText('');
      setWebhookUrl('');
    } catch {
      setFormError('Could not create automation');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteAutomation(id: string) {
    if (!window.confirm('Delete this automation?')) return;
    const res = await fetch(`/api/aiva/workers/${workerId}/automations/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) onAutomationsChange(automations.filter((a) => a.id !== id));
  }

  async function loadRuns(automationId: string) {
    setHistoryId(automationId);
    const res = await fetch(`/api/aiva/workers/${workerId}/automations/${automationId}/runs`);
    if (!res.ok) {
      setRuns([]);
      return;
    }
    const data = (await res.json()) as { runs?: AivaAutomationRun[] };
    setRuns(data.runs ?? []);
  }

  async function testRun(automationId: string) {
    setBusyId(automationId);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/automations/${automationId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { test: true } }),
      });
      if (!res.ok) {
        window.alert(await readAivaError(res));
        return;
      }
      await loadRuns(automationId);
    } finally {
      setBusyId(null);
    }
  }

  async function approveRun(runId: string, automationId: string) {
    setBusyId(runId);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/automations/runs/${runId}/approve`, {
        method: 'POST',
      });
      if (!res.ok) {
        window.alert(await readAivaError(res));
        return;
      }
      await loadRuns(automationId);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PlanGateSection planRequired="team" currentPlan={planTier}>
      <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-text-primary">Automations</h3>
          <p className="mt-0.5 text-xs text-text-muted">When this happens, do that. Runs in the background.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-ghost flex min-h-11 items-center gap-1.5 px-3 text-sm"
        >
          <Plus className="h-4 w-4" /> New automation
        </button>
      </div>

      {automations.length === 0 ? (
        <div className="py-12 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">No automations yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-text-muted">
            Add a schedule or event trigger, pick an action, and Aiva runs it without a chat session.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {automations.map((auto) => (
            <div key={auto.id} className="rounded-lg border border-border px-4 py-3">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{auto.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="inline-flex rounded bg-accent-dim px-1.5 py-0.5 text-[11px] text-accent">
                      {auto.scheduleLabel}
                    </span>
                    {auto.actionType ? (
                      <span className="inline-flex rounded bg-elevated px-1.5 py-0.5 text-[11px] text-text-muted">
                        {auto.actionType}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="whitespace-nowrap text-xs text-text-muted">
                  {auto.lastRunAt ? `Last ran ${timeAgo(auto.lastRunAt)}` : 'Never ran'}
                </div>
                <button
                  type="button"
                  onClick={() => void testRun(auto.id)}
                  disabled={busyId === auto.id}
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                >
                  Test
                </button>
                <button
                  type="button"
                  onClick={() => void loadRuns(auto.id)}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  History
                </button>
                <EnabledToggle
                  workerId={workerId}
                  automationId={auto.id}
                  enabled={auto.enabled}
                  onChange={(id, enabled) =>
                    onAutomationsChange(
                      automations.map((a) => (a.id === id ? { ...a, enabled } : a)),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => void deleteAutomation(auto.id)}
                  className="text-text-muted transition-colors hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {historyId === auto.id ? (
                <div className="mt-3 border-t border-border pt-3">
                  {runs.length === 0 ? (
                    <p className="text-xs text-text-muted">No runs yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {runs.slice(0, 8).map((run) => (
                        <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-text-secondary">
                            <span className="capitalize">{run.status}</span>
                            {run.durationMs != null ? ` · ${run.durationMs}ms` : ''}
                            {run.error ? ` · ${run.error.slice(0, 80)}` : ''}
                          </span>
                          <span className="text-text-muted">{timeAgo(run.createdAt)}</span>
                          {run.status === 'awaiting_approval' ? (
                            <button
                              type="button"
                              disabled={busyId === run.id}
                              onClick={() => void approveRun(run.id, auto.id)}
                              className="text-accent hover:underline disabled:opacity-50"
                            >
                              Approve
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {modalOpen ? (
        <MobileSheet open={modalOpen} onClose={() => setModalOpen(false)} title="New automation">
          <form onSubmit={(e) => void createAutomation(e)} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-primary">Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning inbox briefing"
                  className={`mt-1 ${AIVA_INPUT_CLASS}`}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-primary">Trigger</label>
                <select
                  value={triggerKind}
                  onChange={(e) => setTriggerKind(e.target.value as 'schedule' | 'event')}
                  className={`mt-1 ${AIVA_INPUT_CLASS}`}
                >
                  <option value="schedule">On a schedule</option>
                  <option value="event">When an event happens</option>
                </select>
              </div>
              {triggerKind === 'schedule' ? (
                <div>
                  <label className="text-xs font-medium text-text-primary">When</label>
                  <select
                    value={schedulePreset}
                    onChange={(e) => setSchedulePreset(e.target.value)}
                    className={`mt-1 ${AIVA_INPUT_CLASS}`}
                  >
                    <option value="interval_30">Every 30 minutes</option>
                    <option value="daily">Every day at 09:00</option>
                    <option value="weekly">Mondays at 09:00</option>
                    <option value="monthly">Monthly on day 1 at 09:00</option>
                    <option value="custom">Custom (plain English)</option>
                  </select>
                  {schedulePreset === 'custom' ? (
                    <input
                      required
                      value={scheduleText}
                      onChange={(e) => setScheduleText(e.target.value)}
                      placeholder="e.g. Every Monday at 9am"
                      className={`mt-2 ${AIVA_INPUT_CLASS}`}
                    />
                  ) : null}
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-text-primary">Event</label>
                  <select
                    value={eventSource}
                    onChange={(e) => setEventSource(e.target.value)}
                    className={`mt-1 ${AIVA_INPUT_CLASS}`}
                  >
                    <option value="email_received">Email received</option>
                    <option value="message_received">Message received</option>
                    <option value="webhook">Webhook</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-text-primary">Action</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className={`mt-1 ${AIVA_INPUT_CLASS}`}
                >
                  <option value="aiva_prompt">Aiva prompt</option>
                  <option value="playbook">Internal playbook</option>
                  <option value="webhook_call">Webhook call</option>
                  <option value="connector_action">Connector action</option>
                </select>
              </div>
              {actionType === 'webhook_call' ? (
                <div>
                  <label className="text-xs font-medium text-text-primary">Webhook URL (https)</label>
                  <input
                    required
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://example.com/hooks/aiva"
                    className={`mt-1 ${AIVA_INPUT_CLASS}`}
                  />
                </div>
              ) : null}
              <div>
                <label className="text-xs font-medium text-text-primary">
                  What should it do?
                </label>
                <CarinaEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe the task in plain English..."
                  variant="compact"
                  minHeight="6rem"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-primary">Approval</label>
                <select
                  value={approvalMode}
                  onChange={(e) => setApprovalMode(e.target.value)}
                  className={`mt-1 ${AIVA_INPUT_CLASS}`}
                >
                  <option value="require_write">Approve risky writes</option>
                  <option value="always">Always require approval</option>
                  <option value="auto">Run automatically</option>
                </select>
              </div>
              {formError ? <p className="text-xs text-danger">{formError}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost min-h-11 px-3 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary min-h-11 px-4 text-sm">
                  {submitting ? 'Creating...' : 'Create automation'}
                </button>
              </div>
            </form>
        </MobileSheet>
      ) : null}
      </div>
    </PlanGateSection>
  );
}

function SettingsTab({
  worker,
  auditRows,
  planTier,
  onWorkerUpdate,
  onDismiss,
}: {
  worker: AivaWorker;
  auditRows: AivaAuditRow[];
  planTier: string;
  onWorkerUpdate: (w: AivaWorker) => void;
  onDismiss: () => void;
}) {
  const [roleDescription, setRoleDescription] = useState(worker.roleDescription);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [auditLimit, setAuditLimit] = useState(50);

  useEffect(() => {
    setRoleDescription(worker.roleDescription);
  }, [worker.roleDescription]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/aiva/workers/${worker.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roleName: form.get('roleName'),
        roleDescription,
        language: form.get('language'),
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = (await res.json()) as { worker?: AivaWorker };
      if (data.worker) onWorkerUpdate(data.worker);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  async function handleDismiss() {
    const res = await fetch(`/api/aiva/workers/${worker.id}`, { method: 'DELETE' });
    if (res.ok) onDismiss();
  }

  const visibleAudit = auditRows.slice(0, auditLimit);
  const nameMatches =
    confirmName.trim().toLowerCase() === worker.name.trim().toLowerCase();

  const showPropreneurBinding =
    worker.templateId === 'property-manager' ||
    (worker.skillPacks ?? []).includes('property-uk');

  return (
    <div className="space-y-8">
      {showPropreneurBinding ? (
        <div>
          <h3 className="mb-4 text-sm font-medium text-text-primary">Propreneur integration</h3>
          <PropreneurBindingPanel workerId={worker.id} />
        </div>
      ) : null}

      {showPropreneurBinding ? <div className="border-t border-border" /> : null}

      <div>
        <h3 className="mb-4 text-sm font-medium text-text-primary">Edit</h3>
        <form onSubmit={(e) => void handleSave(e)} className="max-w-lg space-y-4">
          <div>
            <label className="text-xs font-medium text-text-primary">Aiva name</label>
            <input
              name="roleName"
              required
              defaultValue={worker.name}
              className={`mt-1 ${AIVA_INPUT_CLASS}`}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-primary">Role description</label>
            <CarinaEditor
              value={roleDescription}
              onChange={setRoleDescription}
              variant="compact"
              minHeight="8rem"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-primary">Language</label>
            <select
              name="language"
              defaultValue={worker.language ?? 'en-GB'}
              className={`mt-1 ${AIVA_INPUT_CLASS}`}
            >
              <option value="en-GB">English (UK)</option>
              <option value="en-US">English (US)</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
              <option value="ar">Arabic</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {saved ? <p className="text-xs text-green-400">Changes saved</p> : null}
        </form>
      </div>

      <div className="border-t border-border" />

      <div>
        <h3 className="mb-1 text-sm font-medium text-text-primary">Activity audit</h3>
        <p className="mb-4 text-xs text-text-muted">
          Activity log on all plans. On-chain verification links require the Business plan. The hash
          covers action type, timestamp, and a content fingerprint; no raw message content is stored
          on-chain.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="py-2 pr-4 text-left font-medium">Time</th>
                <th className="py-2 pr-4 text-left font-medium">Action</th>
                <th className="hidden py-2 pr-4 text-left font-medium md:table-cell">Input</th>
                <th className="hidden py-2 pr-4 text-left font-medium md:table-cell">Output</th>
                <th className="py-2 text-left font-medium">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleAudit.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap py-2 pr-4 text-text-muted">
                    {formatTimestamp(row.createdAt)}
                  </td>
                  <td className="py-2 pr-4">
                    <ActionBadge type={row.actionType} />
                  </td>
                  <td className="hidden max-w-[180px] truncate py-2 pr-4 text-text-muted md:table-cell">
                    {row.inputSummary?.slice(0, 80) ?? '-'}
                  </td>
                  <td className="hidden max-w-[180px] truncate py-2 pr-4 text-text-muted md:table-cell">
                    {row.outputSummary?.slice(0, 80) ?? '-'}
                  </td>
                  <td className="py-2">
                    {row.attestationTx ? (
                      <a
                        href={`${CHAIN_EXPLORER_URL}/${row.attestationTx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:underline"
                      >
                        On-chain
                      </a>
                    ) : row.attestationGated ? (
                      <span className="text-text-muted" title="Business plan required">
                        Business plan
                      </span>
                    ) : (
                      <span className="text-text-muted">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {auditRows.length >= auditLimit && auditLimit === 50 ? (
          <button
            type="button"
            onClick={() => setAuditLimit(100)}
            className="mt-3 text-xs text-accent hover:underline"
          >
            Load more
          </button>
        ) : null}
      </div>

      <div className="border-t border-border" />

      <div>
        <h3 className="mb-3 text-sm font-medium text-danger">Danger zone</h3>
        <div className="rounded-lg border border-danger/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Dismiss this Aiva</p>
              <p className="mt-0.5 text-xs text-text-muted">
                Permanently deactivates this Aiva. Cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissOpen(true)}
              className="shrink-0 rounded-md border border-danger/40 px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger/10"
            >
              Dismiss Aiva
            </button>
          </div>
        </div>
      </div>

      {dismissOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-base p-6 shadow-lg">
            <h3 className="text-sm font-semibold text-text-primary">
              Dismiss {worker.name}?
            </h3>
            <p className="mt-2 text-xs text-text-muted">
              This permanently deactivates the Aiva and stops all message processing. Any pending
              automations will be cancelled. This cannot be undone.
            </p>
            <div className="mt-4">
              <label className="text-xs font-medium text-text-primary">
                Type the Aiva&apos;s name to confirm:
              </label>
              <input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className={`mt-1 ${AIVA_INPUT_CLASS}`}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDismissOpen(false);
                  setConfirmName('');
                }}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!nameMatches}
                onClick={() => void handleDismiss()}
                className="rounded-md border border-danger bg-danger/10 px-3 py-1.5 text-xs text-danger disabled:opacity-40"
              >
                Dismiss Aiva
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AivaDetailClient({
  workerId,
  tabs = AIVA_CORE_TABS,
  initialTab,
}: {
  workerId: string;
  tabs?: AivaTab[];
  initialTab?: AivaTab['id'];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(initialTab ?? tabs[0]?.id ?? 'overview');
  const [worker, setWorker] = useState<AivaWorker | null>(null);
  const [activity, setActivity] = useState<AivaActivityItem[]>([]);
  const [audit, setAudit] = useState<AivaAuditRow[]>([]);
  const [channels, setChannels] = useState<AivaChannelCard[]>([]);
  const [automations, setAutomations] = useState<AivaAutomation[]>([]);
  const [usageBar, setUsageBar] = useState<AivaUsageBar | null>(null);
  const [planTier, setPlanTier] = useState('trial');
  const [channelLimit, setChannelLimit] = useState<number | null>(2);
  const [connectedCount, setConnectedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workerRes, activityRes, auditRes, channelsRes, automationsRes, billingRes] =
        await Promise.all([
          fetch(`/api/aiva/workers/${workerId}`),
          fetch(`/api/aiva/workers/${workerId}/activity?limit=10`),
          fetch(`/api/aiva/workers/${workerId}/audit?limit=100`),
          fetch(`/api/aiva/workers/${workerId}/channels`),
          fetch(`/api/aiva/workers/${workerId}/automations`),
          fetch('/api/aiva/billing/status'),
        ]);

      if (!workerRes.ok) {
        setError('Worker not found');
        return;
      }

      const workerData = (await workerRes.json()) as { worker: AivaWorker };
      setWorker(workerData.worker);

      if (activityRes.ok) {
        const d = (await activityRes.json()) as { activity?: AivaActivityItem[] };
        setActivity(d.activity ?? []);
      }
      if (auditRes.ok) {
        const d = (await auditRes.json()) as { audit?: AivaAuditRow[]; planTier?: string };
        if (d.planTier) setPlanTier(d.planTier);
        setAudit(
          (d.audit ?? []).map((row) => ({
            ...row,
            inputSummary: row.inputSummary ?? undefined,
            outputSummary: row.outputSummary ?? undefined,
          })),
        );
      }
      if (channelsRes.ok) {
        const d = (await channelsRes.json()) as {
          channels?: AivaChannelCard[];
          planTier?: string;
          channelLimit?: number | null;
          connectedCount?: number;
        };
        setChannels(d.channels ?? []);
        if (d.planTier) setPlanTier(d.planTier);
        setChannelLimit(d.channelLimit ?? null);
        setConnectedCount(d.connectedCount ?? 0);
      }
      if (automationsRes.ok) {
        const d = (await automationsRes.json()) as { automations?: AivaAutomation[] };
        setAutomations(d.automations ?? []);
      }
      if (billingRes.ok) {
        const d = (await billingRes.json()) as {
          subscription?: { planTier?: string };
          planTier?: string;
          usage?: { messageCount?: number; messageLimit?: number | null; resetsAt?: string };
          messageUsage?: { count?: number; limit?: number; resetsAt?: string };
          count?: number;
          limit?: number;
          resetsAt?: string;
        };
        const tier = d.subscription?.planTier ?? d.planTier;
        if (tier) setPlanTier(tier);
        const usage = d.usage;
        const count = Number(usage?.messageCount ?? d.messageUsage?.count ?? d.count ?? 0);
        const limit = Number(usage?.messageLimit ?? d.messageUsage?.limit ?? d.limit ?? 0);
        if (limit > 0) {
          setUsageBar({
            count,
            limit,
            resetsAt:
              usage?.resetsAt ??
              d.messageUsage?.resetsAt ??
              d.resetsAt ??
              new Date().toISOString(),
          });
        }
      }
    } catch {
      setError('Could not load worker');
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 lg:py-8">
        <MobileSkeleton variant="detail" />
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4 sm:px-6 lg:py-8">
        <p className="text-sm text-danger">{error ?? 'Worker not found'}</p>
        <Link href="/aiva/workers" className="text-sm text-accent hover:underline">
          Back to roster
        </Link>
      </div>
    );
  }

  const usagePct =
    usageBar && usageBar.limit > 0
      ? Math.round((usageBar.count / usageBar.limit) * 100)
      : 0;
  const needsChannel = connectedCount === 0 || channels.every((c) => !c.connected);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 lg:py-8">
      {/* Mobile stacked header */}
      <div className="mb-5 flex flex-col items-center gap-3 text-center lg:hidden">
        <AivaAvatar name={worker.name} className="h-16 w-16 text-xl" />
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{worker.name}</h1>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <StatusChip status={worker.status} trialDaysLeft={worker.trialDaysLeft} />
            <span className="text-xs text-text-muted">
              {worker.channels.length} channel{worker.channels.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Link
            href={`/aiva/workers/${worker.id}/chat-preview`}
            className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium"
          >
            <MessageSquare className="h-4 w-4" aria-hidden />
            Chat preview
          </Link>
          <button
            type="button"
            onClick={() => setActiveTab('channels')}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-elevated px-4 text-sm font-medium text-text-primary hover:bg-overlay"
          >
            {needsChannel ? 'Connect channel' : 'Manage channels'}
          </button>
        </div>
        {usageBar ? (
          <div className="w-full">
            <MobileStatStrip
              meter={{
                label: 'Messages this month',
                valueLabel: `${usageBar.count.toLocaleString()} / ${usageBar.limit.toLocaleString()}`,
                percent: usagePct,
                footer:
                  usageBar.walletRemainingGbp != null
                    ? `Wallet £${usageBar.walletRemainingGbp.toFixed(2)} · Resets ${formatDate(usageBar.resetsAt)}`
                    : `Resets ${formatDate(usageBar.resetsAt)}`,
              }}
              items={[]}
            />
          </div>
        ) : null}
        <div className="flex w-full items-center justify-center gap-2">
          <PauseResumeButton
            workerId={worker.id}
            status={worker.status}
            onStatusChange={(s) => setWorker({ ...worker, status: s as AivaWorker['status'] })}
          />
          <ScoutWorkerStatus workerId={worker.id} scout={worker.scout} />
        </div>
      </div>

      {/* Desktop header */}
      <div className="mb-6 hidden items-start justify-between gap-4 lg:flex">
        <div className="flex items-center gap-3">
          <AivaAvatar name={worker.name} />
          <div>
            <h1 className="text-2xl font-semibold">{worker.name}</h1>
            <div className="mt-0.5 flex items-center gap-3">
              <StatusChip status={worker.status} trialDaysLeft={worker.trialDaysLeft} />
              {usageBar ? (
                <UsageBadge
                  count={usageBar.count}
                  limit={usageBar.limit}
                  walletRemainingGbp={usageBar.walletRemainingGbp}
                  walletLowCredit={usageBar.walletLowCredit}
                  byokActive={usageBar.byokActive}
                />
              ) : null}
              <span className="text-xs text-text-muted">
                {worker.channels.length} channel{worker.channels.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/aiva/workers/${worker.id}/chat-preview`}
            className="btn-ghost flex items-center gap-1.5 text-xs"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Chat preview
          </Link>
          <PauseResumeButton
            workerId={worker.id}
            status={worker.status}
            onStatusChange={(s) => setWorker({ ...worker, status: s as AivaWorker['status'] })}
          />
          <ScoutWorkerStatus workerId={worker.id} scout={worker.scout} />
        </div>
      </div>

      <div className="mb-6">
        <MobileTabs
          tabs={tabs}
          activeId={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'overview' ? (
        <OverviewTab worker={worker} activity={activity} usageBar={usageBar} workerId={workerId} />
      ) : null}
      {activeTab === 'work' ? <DirectWorkTab worker={worker} /> : null}
      {activeTab === 'channels' ? (
        <ChannelsTab
          workerId={worker.id}
          channels={channels}
          planTier={planTier}
          channelLimit={channelLimit}
          connectedCount={connectedCount}
          onChannelsChange={setChannels}
          onReload={() => void loadData()}
        />
      ) : null}
      {activeTab === 'automations' ? (
        <AutomationsTab
          workerId={worker.id}
          planTier={planTier}
          automations={automations}
          onAutomationsChange={setAutomations}
        />
      ) : null}
      {activeTab === 'training' ? <TrainingTab workerId={workerId} /> : null}
      {activeTab === 'settings' ? (
        <SettingsTab
          worker={worker}
          auditRows={audit}
          planTier={planTier}
          onWorkerUpdate={setWorker}
          onDismiss={() => router.push('/aiva/workers')}
        />
      ) : null}
    </div>
  );
}

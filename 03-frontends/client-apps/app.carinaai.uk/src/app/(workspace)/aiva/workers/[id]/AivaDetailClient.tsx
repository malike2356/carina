'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Clock,
  Copy,
  Check,
  Pause,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { AivaAvatar } from '@/components/aiva/AivaAvatar';
import { ConnectChannelModal } from '@/components/aiva/ConnectChannelModal';
import { ActionBadge } from '@/components/aiva/ActionBadge';
import { ChannelIcon } from '@/components/aiva/ChannelIcon';
import { StatusChip } from '@/components/aiva/StatusChip';
import { UsageBadge } from '@/components/aiva/UsageBadge';
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
  AivaChannelCard,
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-elevated p-4">
            <p className="text-2xl font-semibold text-text-primary">{s.value}</p>
            <p className="mt-0.5 text-xs text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {usageBar ? (
        <div className="rounded-lg border border-border bg-elevated p-4">
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
                'text-xs',
                atChannelLimit
                  ? 'cursor-not-allowed text-text-muted'
                  : 'text-accent hover:underline',
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
    </div>
    {webChannelLive ? (
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
  const [scheduleText, setScheduleText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function createAutomation(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, scheduleText }),
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

  return (
    <PlanGateSection planRequired="team" currentPlan={planTier}>
      <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">Automations</h3>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-ghost flex items-center gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> New automation
        </button>
      </div>

      {automations.length === 0 ? (
        <div className="py-12 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">No automations yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-text-muted">
            Add one to have your Aiva run recurring tasks on a schedule, without you lifting a
            finger.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {automations.map((auto) => (
            <div
              key={auto.id}
              className="flex items-center gap-4 rounded-lg border border-border px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">{auto.name}</p>
                <span className="mt-1 inline-flex rounded bg-accent-dim px-1.5 py-0.5 text-[11px] text-accent">
                  {auto.scheduleLabel}
                </span>
              </div>
              <div className="whitespace-nowrap text-xs text-text-muted">
                {auto.lastRunAt ? `Last ran ${timeAgo(auto.lastRunAt)}` : 'Never ran'}
              </div>
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
          ))}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-base p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">New automation</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-text-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(e) => void createAutomation(e)} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-primary">Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning inbox briefing, Weekly invoice sweep"
                  className={`mt-1 ${AIVA_INPUT_CLASS}`}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-primary">
                  What should it do?
                </label>
                <CarinaEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe the recurring process in plain English..."
                  variant="compact"
                  minHeight="6rem"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-primary">
                  When should it run?
                </label>
                <input
                  required
                  value={scheduleText}
                  onChange={(e) => setScheduleText(e.target.value)}
                  placeholder="e.g. Every Monday at 9am, Daily at 8am"
                  className={`mt-1 ${AIVA_INPUT_CLASS}`}
                />
                <p className="mt-1 text-[11px] text-text-muted">
                  Your Aiva converts this into a schedule automatically.
                </p>
              </div>
              {formError ? <p className="text-xs text-danger">{formError}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary text-xs">
                  {submitting ? 'Creating...' : 'Create automation'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
    return <p className="text-sm text-text-muted">Loading...</p>;
  }

  if (error || !worker) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-danger">{error ?? 'Worker not found'}</p>
        <Link href="/aiva/workers" className="text-sm text-accent hover:underline">
          Back to roster
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <AivaAvatar name={worker.name} />
          <div>
            <h1 className="text-2xl font-semibold">{worker.name}</h1>
            <div className="mt-0.5 flex items-center gap-3">
              <StatusChip status={worker.status} trialDaysLeft={worker.trialDaysLeft} />
              {usageBar ? (
                <UsageBadge count={usageBar.count} limit={usageBar.limit} />
              ) : null}
              <span className="text-xs text-text-muted">
                {worker.channels.length} channel{worker.channels.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PauseResumeButton
            workerId={worker.id}
            status={worker.status}
            onStatusChange={(s) => setWorker({ ...worker, status: s as AivaWorker['status'] })}
          />
          <ScoutWorkerStatus workerId={worker.id} scout={worker.scout} />
        </div>
      </div>

      <div className="mb-6 border-b border-border">
        <nav className="-mb-px flex gap-1" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-3 py-2 text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-accent font-medium text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' ? (
        <OverviewTab worker={worker} activity={activity} usageBar={usageBar} workerId={workerId} />
      ) : null}
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

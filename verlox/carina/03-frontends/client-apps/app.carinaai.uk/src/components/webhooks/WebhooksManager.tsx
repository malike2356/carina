'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ExternalLink, RefreshCw, Save, TestTube2, Trash2, Webhook } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { CarinaEditor } from '@/components/editor';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';

const EVENT_OPTIONS = [
  'process.complete',
  'process.failure',
  'process.watch',
  'cron.complete',
  'kanban.move',
  'agent.turn.complete',
  'delegation.complete',
] as const;

type WebhookEvent = (typeof EVENT_OPTIONS)[number];

type WebhookSubscription = {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  name: string | null;
  description: string | null;
  max_attempts: number;
  secret?: string | null;
  created_at: string;
  updated_at: string;
  disabled_at: string | null;
};

type WebhookDelivery = {
  id: string;
  event: WebhookEvent;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  httpStatus: number | null;
  attemptCount: number;
  maxAttempts: number;
  errorMessage: string | null;
  nextRetryAt: string | null;
  createdAt: string;
  deliveredAt: string | null;
  payload: Record<string, unknown>;
};

const DEFAULT_FORM = {
  id: '',
  name: '',
  url: '',
  description: '',
  maxAttempts: 5,
  events: ['process.complete'] as WebhookEvent[],
};

function formatTime(value: string | null): string {
  if (!value) return 'never';
  return new Date(value).toLocaleString();
}

function statusLabel(active: boolean): string {
  return active ? 'Active' : 'Disabled';
}

function statusClass(active: boolean): string {
  return active ? 'text-accent' : 'text-text-muted';
}

export function WebhooksManager() {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [testEvent, setTestEvent] = useState<WebhookEvent>('agent.turn.complete');

  const selected = useMemo(
    () => subscriptions.find((item) => item.id === selectedId) ?? null,
    [selectedId, subscriptions],
  );

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/webhooks?include_inactive=${showInactive ? 'true' : 'false'}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to load webhooks');
      const next = (data.subscriptions ?? []) as WebhookSubscription[];
      setSubscriptions(next);
      if (!selectedId && next[0]) setSelectedId(next[0].id);
      if (selectedId && !next.some((item) => item.id === selectedId) && next[0]) {
        setSelectedId(next[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDeliveries(id: string) {
    if (!id) {
      setDeliveries([]);
      return;
    }
    const res = await fetch(`/api/webhooks/${encodeURIComponent(id)}/deliveries?limit=30`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Unable to load deliveries');
    setDeliveries((data.deliveries ?? []) as WebhookDelivery[]);
  }

  useEffect(() => {
    void load();
  }, [showInactive]);

  useEffect(() => {
    if (!selected) {
      setDeliveries([]);
      setForm(DEFAULT_FORM);
      return;
    }
    setForm({
      id: selected.id,
      name: selected.name ?? '',
      url: selected.url,
      description: selected.description ?? '',
      maxAttempts: selected.max_attempts ?? 5,
      events: selected.events.length > 0 ? selected.events : ['process.complete'],
    });
    void loadDeliveries(selected.id).catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [selected?.id]);

  const activeCount = subscriptions.filter((item) => item.active).length;

  async function save() {
    setSaving(true);
    setError('');
    try {
      const method = form.id ? 'PATCH' : 'POST';
      const endpoint = form.id ? `/api/webhooks/${encodeURIComponent(form.id)}` : '/api/webhooks';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: form.url.trim(),
          name: form.name.trim() || undefined,
          description: form.description.trim() || undefined,
          max_attempts: Number(form.maxAttempts) || 5,
          events: form.events,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to save webhook');
      await load();
      if (data.subscription?.id) {
        setSelectedId(data.subscription.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: WebhookSubscription) {
    setError('');
    const endpoint = item.active ? `/api/webhooks/${encodeURIComponent(item.id)}/disable` : `/api/webhooks/${encodeURIComponent(item.id)}/enable`;
    const res = await fetch(endpoint, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Unable to update webhook');
      return;
    }
    await load();
    if (item.id === selectedId) {
      await loadDeliveries(item.id).catch((err) => setError(err instanceof Error ? err.message : String(err)));
    }
  }

  async function remove(item: WebhookSubscription) {
    setError('');
    const res = await fetch(`/api/webhooks/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Unable to delete webhook');
      return;
    }
    setSelectedId('');
    setForm(DEFAULT_FORM);
    await load();
  }

  async function testSelected() {
    if (!selected) return;
    setTesting(true);
    setError('');
    try {
      const res = await fetch(`/api/webhooks/${encodeURIComponent(selected.id)}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: testEvent,
          data: {
            source: 'carina-webhooks-page',
            name: selected.name ?? selected.url,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Test failed');
      await loadDeliveries(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-text-primary">Webhooks</h1>
            <p className="text-xs text-text-muted">
              Route agent, cron, and workflow events to your systems.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setForm(DEFAULT_FORM)}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white"
            >
              <Webhook className="h-3.5 w-3.5" />
              New webhook
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[1.2fr_0.9fr]">
        <section className="min-h-0 border-r border-border">
          <div className="flex items-center gap-3 border-b border-border px-6 py-3 text-xs text-text-muted">
            <span>{subscriptions.length} total</span>
            <span>{activeCount} active</span>
            <label className="ml-auto flex items-center gap-2">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
              />
              Show inactive
            </label>
          </div>

          <div className="min-h-0 overflow-y-auto p-4">
            {loading ? (
              <EmptyState title="Loading webhooks" subtitle="Fetching subscriptions and delivery history." />
            ) : subscriptions.length === 0 ? (
              <EmptyState
                title="No webhooks yet"
                subtitle="Create a subscription to start routing events."
              />
            ) : (
              <div className="space-y-3">
                {subscriptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'w-full rounded-lg border px-4 py-3 text-left transition-colors',
                      selectedId === item.id
                        ? 'border-accent/30 bg-accent-dim'
                        : 'border-border bg-surface hover:bg-elevated',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-text-primary">
                            {item.name || item.url}
                          </span>
                          <span className={cn('text-[11px] font-medium', statusClass(item.active))}>
                            {statusLabel(item.active)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-text-muted">{item.url}</p>
                        <p className="mt-2 text-[11px] text-text-muted">
                          Events: {item.events.join(', ')}
                        </p>
                        <p className="mt-1 text-[11px] text-text-muted">
                          Last updated {formatTime(item.updated_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <IconButton
                          label={item.active ? 'Disable' : 'Enable'}
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            void toggleActive(item);
                          }}
                        >
                          {item.active ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                        </IconButton>
                        <IconButton
                          label="Delete"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            void remove(item);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto">
          <div className="border-b border-border px-6 py-3">
            <h2 className="text-sm font-semibold text-text-primary">
              {form.id ? 'Edit webhook' : 'Create webhook'}
            </h2>
          </div>

          <div className="space-y-4 p-6">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Name
              </span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-md border border-border bg-base px-3 py-2 text-sm outline-none"
                placeholder="Workflow alerts"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                URL
              </span>
              <input
                value={form.url}
                onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                className="w-full rounded-md border border-border bg-base px-3 py-2 text-sm outline-none"
                placeholder="https://example.com/webhooks/carina"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Description
              </span>
              <CarinaEditor
                value={form.description}
                onChange={(description) => setForm((current) => ({ ...current, description }))}
                placeholder="Send completed cron jobs to the reporting endpoint."
                variant="compact"
                minHeight="5rem"
                showEngineSwitch={false}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Max attempts
              </span>
              <input
                type="number"
                min={1}
                max={12}
                value={form.maxAttempts}
                onChange={(event) =>
                  setForm((current) => ({ ...current, maxAttempts: Number(event.target.value) || 1 }))
                }
                className="w-full rounded-md border border-border bg-base px-3 py-2 text-sm outline-none"
              />
            </label>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Events
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {EVENT_OPTIONS.map((eventName) => {
                  const checked = form.events.includes(eventName);
                  return (
                    <label
                      key={eventName}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
                        checked ? 'border-accent/40 bg-accent-dim text-text-primary' : 'border-border bg-surface',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setForm((current) => ({
                            ...current,
                            events: event.target.checked
                              ? [...current.events, eventName]
                              : current.events.filter((item) => item !== eventName),
                          }));
                        }}
                      />
                      {eventName}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || form.events.length === 0 || !form.url.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save webhook'}
              </button>
              <button
                type="button"
                onClick={() => void testSelected()}
                disabled={!selected || testing}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                <TestTube2 className="h-3.5 w-3.5" />
                {testing ? 'Testing...' : 'Test'}
              </button>
            </div>

            {selected ? (
              <>
                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-text-primary">Selected webhook</h3>
                      <p className="mt-1 text-xs text-text-muted">
                        {selected.name || selected.url}
                      </p>
                    </div>
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent"
                    >
                      Open target <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-text-muted">Created</p>
                      <p className="mt-1 text-text-primary">{formatTime(selected.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Secret</p>
                      <p className="mt-1 truncate text-text-primary">
                        {selected.secret ? 'Stored' : 'Not available'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-text-primary">Delivery log</h3>
                    <span className="text-xs text-text-muted">{deliveries.length} rows</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {deliveries.length === 0 ? (
                      <p className="text-xs text-text-muted">No deliveries recorded yet.</p>
                    ) : (
                      deliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          className="rounded-md border border-border bg-base px-3 py-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-text-primary">{delivery.event}</span>
                            <span className={cn(
                              delivery.status === 'delivered' ? 'text-accent' : 'text-danger',
                            )}>
                              {delivery.status}
                            </span>
                          </div>
                          <p className="mt-1 text-text-muted">
                            Attempt {delivery.attemptCount}/{delivery.maxAttempts} · HTTP {delivery.httpStatus ?? 'n/a'}
                          </p>
                          {delivery.errorMessage ? (
                            <p className="mt-1 text-danger">{delivery.errorMessage}</p>
                          ) : null}
                          <p className="mt-1 text-text-muted">
                            Delivered {formatTime(delivery.deliveredAt)} · Next retry {formatTime(delivery.nextRetryAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

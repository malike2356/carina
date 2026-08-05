'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import type { DeliveryEvent, OutreachSequence } from '@/components/outreach/types';

type StepDraft = {
  id: string;
  order: string;
  label: string;
  channel: string;
  subject: string;
  body: string;
  delayHours: string;
  cta: string;
  link: string;
  attachmentNote: string;
};

type SequenceDraft = {
  name: string;
  description: string;
  channelDefault: string;
  stopOnReply: boolean;
  stopOnBooking: boolean;
  stopOnUnsubscribe: boolean;
  steps: StepDraft[];
};

function makeStepDraft(step: OutreachSequence['steps'][number]): StepDraft {
  return {
    id: step.id,
    order: String(step.order),
    label: step.label,
    channel: step.channel,
    subject: step.subject,
    body: step.body,
    delayHours: String(step.delayHours),
    cta: step.cta ?? '',
    link: step.link ?? '',
    attachmentNote: step.attachmentNote ?? '',
  };
}

function makeDraft(sequence: OutreachSequence): SequenceDraft {
  return {
    name: sequence.name,
    description: sequence.description ?? '',
    channelDefault: sequence.channelDefault ?? 'email',
    stopOnReply: sequence.stopOnReply,
    stopOnBooking: sequence.stopOnBooking,
    stopOnUnsubscribe: sequence.stopOnUnsubscribe,
    steps: sequence.steps.map(makeStepDraft),
  };
}

function makeNewSequenceDraft(): SequenceDraft {
  return {
    name: 'New sequence',
    description: '',
    channelDefault: 'email',
    stopOnReply: true,
    stopOnBooking: true,
    stopOnUnsubscribe: true,
    steps: [
      {
        id: '',
        order: '0',
        label: 'First touch',
        channel: 'email',
        subject: 'Quick idea for {{company}}',
        body: 'Hi {{name}},\n\nI noticed {{company}} and thought this might help.\n\n{{cta}}\n\nBest',
        delayHours: '0',
        cta: 'Open to a 15-minute chat?',
        link: '',
        attachmentNote: '',
      },
    ],
  };
}

function toStepPayload(step: StepDraft): Record<string, unknown> {
  return {
    id: step.id || undefined,
    order: Number(step.order) || 0,
    label: step.label,
    channel: step.channel,
    subject: step.subject,
    body: step.body,
    delayHours: Number(step.delayHours) || 0,
    cta: step.cta.trim() || undefined,
    link: step.link.trim() || undefined,
    attachmentNote: step.attachmentNote.trim() || undefined,
  };
}

export default function OutreachSequencesPage() {
  const { push } = useToast();
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryEvent[]>([]);
  const [drafts, setDrafts] = useState<Record<string, SequenceDraft>>({});
  const [newDraft, setNewDraft] = useState<SequenceDraft>(makeNewSequenceDraft());
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/aiva/outreach/sequences').then((res) => (res.ok ? res.json() : { sequences: [] })),
      fetch('/api/aiva/outreach/deliveries').then((res) => (res.ok ? res.json() : { deliveries: [] })),
    ])
      .then(([seq, del]) => {
        const nextSequences = seq.sequences ?? [];
        setSequences(nextSequences);
        setDeliveries(del.deliveries ?? []);
        setDrafts((current) => {
          const next: Record<string, SequenceDraft> = {};
          for (const sequence of nextSequences) {
            next[sequence.id] = current[sequence.id] ?? makeDraft(sequence);
          }
          return next;
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateDraft = useCallback((id: string, patch: Partial<SequenceDraft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? makeNewSequenceDraft()),
        ...patch,
      },
    }));
  }, []);

  const updateNewDraft = useCallback((patch: Partial<SequenceDraft>) => {
    setNewDraft((current) => ({ ...current, ...patch }));
  }, []);

  const addStep = useCallback((sequenceId: string) => {
    setDrafts((current) => {
      const draft = current[sequenceId];
      if (!draft) return current;
      const steps = [
        ...draft.steps,
        {
          id: '',
          order: String(draft.steps.length),
          label: `Step ${draft.steps.length + 1}`,
          channel: draft.channelDefault,
          subject: '',
          body: '',
          delayHours: '48',
          cta: '',
          link: '',
          attachmentNote: '',
        },
      ];
      return { ...current, [sequenceId]: { ...draft, steps } };
    });
  }, []);

  const removeStep = useCallback((sequenceId: string, idx: number) => {
    setDrafts((current) => {
      const draft = current[sequenceId];
      if (!draft) return current;
      const steps = draft.steps.filter((_, index) => index !== idx);
      return { ...current, [sequenceId]: { ...draft, steps } };
    });
  }, []);

  const saveSequence = useCallback(async (sequenceId: string) => {
    const draft = drafts[sequenceId];
    if (!draft) return;
    const res = await fetch(`/api/aiva/outreach/sequences/${sequenceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        description: draft.description,
        channelDefault: draft.channelDefault,
        stopOnReply: draft.stopOnReply,
        stopOnBooking: draft.stopOnBooking,
        stopOnUnsubscribe: draft.stopOnUnsubscribe,
        steps: draft.steps.map(toStepPayload),
      }),
    });
    if (!res.ok) {
      push('Could not save sequence', 'error');
      return;
    }
    push('Sequence saved', 'success');
    load();
  }, [drafts, load, push]);

  const createSequence = useCallback(async () => {
    const res = await fetch('/api/aiva/outreach/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newDraft.name,
        description: newDraft.description,
        channelDefault: newDraft.channelDefault,
        stopOnReply: newDraft.stopOnReply,
        stopOnBooking: newDraft.stopOnBooking,
        stopOnUnsubscribe: newDraft.stopOnUnsubscribe,
        steps: newDraft.steps.map(toStepPayload),
      }),
    });
    if (!res.ok) {
      push('Could not create sequence', 'error');
      return;
    }
    setNewDraft(makeNewSequenceDraft());
    push('Sequence created', 'success');
    load();
  }, [load, newDraft, push]);

  const sequenceCount = useMemo(() => sequences.length, [sequences.length]);

  if (loading) {
    return <div className="p-6 text-sm text-text-muted">Loading sequences...</div>;
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          Sequences queue Soft Wall drafts only. Approve outbound mail in Approvals before anything sends.
        </p>
        <Button size="sm" variant="outline" asChild>
          <Link href="/aiva/approvals">Approvals</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-text-primary">Create sequence</h2>
            <p className="mt-1 text-xs text-text-muted">Start with a full editable sequence.</p>
          </div>
          <Button size="sm" onClick={() => void createSequence()}>
            Create
          </Button>
        </div>
        <div className="mt-4 grid gap-3">
          <input
            className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
            value={newDraft.name}
            onChange={(e) => updateNewDraft({ name: e.target.value })}
            placeholder="Sequence name"
          />
          <input
            className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
            value={newDraft.description}
            onChange={(e) => updateNewDraft({ description: e.target.value })}
            placeholder="Description"
          />
          <input
            className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
            value={newDraft.channelDefault}
            onChange={(e) => updateNewDraft({ channelDefault: e.target.value })}
            placeholder="Default channel"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={newDraft.stopOnReply}
                onChange={(e) => updateNewDraft({ stopOnReply: e.target.checked })}
              />
              Stop on reply
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={newDraft.stopOnBooking}
                onChange={(e) => updateNewDraft({ stopOnBooking: e.target.checked })}
              />
              Stop on booking
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={newDraft.stopOnUnsubscribe}
                onChange={(e) => updateNewDraft({ stopOnUnsubscribe: e.target.checked })}
              />
              Stop on unsubscribe
            </label>
          </div>
          {newDraft.steps.map((step, idx) => (
            <div key={`${step.id || idx}-new`} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-text-secondary">Step {idx + 1}</p>
              </div>
              <div className="mt-3 grid gap-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={step.label}
                    onChange={(e) => {
                      const steps = [...newDraft.steps];
                      steps[idx] = { ...step, label: e.target.value };
                      setNewDraft((current) => ({ ...current, steps }));
                    }}
                    placeholder="Label"
                  />
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={step.channel}
                    onChange={(e) => {
                      const steps = [...newDraft.steps];
                      steps[idx] = { ...step, channel: e.target.value };
                      setNewDraft((current) => ({ ...current, steps }));
                    }}
                    placeholder="Channel"
                  />
                </div>
                <input
                  className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                  value={step.subject}
                  onChange={(e) => {
                    const steps = [...newDraft.steps];
                    steps[idx] = { ...step, subject: e.target.value };
                    setNewDraft((current) => ({ ...current, steps }));
                  }}
                  placeholder="Subject"
                />
                <textarea
                  className="min-h-28 rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                  value={step.body}
                  onChange={(e) => {
                    const steps = [...newDraft.steps];
                    steps[idx] = { ...step, body: e.target.value };
                    setNewDraft((current) => ({ ...current, steps }));
                  }}
                  placeholder="Body"
                />
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={step.delayHours}
                    onChange={(e) => {
                      const steps = [...newDraft.steps];
                      steps[idx] = { ...step, delayHours: e.target.value };
                      setNewDraft((current) => ({ ...current, steps }));
                    }}
                    placeholder="Delay hours"
                  />
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={step.cta}
                    onChange={(e) => {
                      const steps = [...newDraft.steps];
                      steps[idx] = { ...step, cta: e.target.value };
                      setNewDraft((current) => ({ ...current, steps }));
                    }}
                    placeholder="CTA"
                  />
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={step.link}
                    onChange={(e) => {
                      const steps = [...newDraft.steps];
                      steps[idx] = { ...step, link: e.target.value };
                      setNewDraft((current) => ({ ...current, steps }));
                    }}
                    placeholder="Link"
                  />
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={step.attachmentNote}
                    onChange={(e) => {
                      const steps = [...newDraft.steps];
                      steps[idx] = { ...step, attachmentNote: e.target.value };
                      setNewDraft((current) => ({ ...current, steps }));
                    }}
                    placeholder="Attachment note"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-text-primary">Sequences</h2>
        <p className="text-xs text-text-muted">{sequenceCount} total</p>
      </div>

      {sequences.map((sequence) => {
        const draft = drafts[sequence.id] ?? makeDraft(sequence);
        return (
          <div key={sequence.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">{sequence.name}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {sequence.stopOnReply ? 'Stops on reply' : 'Reply does not stop'}
                  {' · '}
                  {sequence.stopOnBooking ? 'Stops on booking' : 'Booking does not stop'}
                  {' · '}
                  {sequence.stopOnUnsubscribe ? 'Stops on unsubscribe' : 'Unsubscribe does not stop'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => addStep(sequence.id)}>
                  Add step
                </Button>
                <Button size="sm" onClick={() => void saveSequence(sequence.id)}>
                  Save
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                value={draft.name}
                onChange={(e) => updateDraft(sequence.id, { name: e.target.value })}
                placeholder="Sequence name"
              />
              <input
                className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                value={draft.description}
                onChange={(e) => updateDraft(sequence.id, { description: e.target.value })}
                placeholder="Description"
              />
              <input
                className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                value={draft.channelDefault}
                onChange={(e) => updateDraft(sequence.id, { channelDefault: e.target.value })}
                placeholder="Default channel"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={draft.stopOnReply}
                    onChange={(e) => updateDraft(sequence.id, { stopOnReply: e.target.checked })}
                  />
                  Stop on reply
                </label>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={draft.stopOnBooking}
                    onChange={(e) => updateDraft(sequence.id, { stopOnBooking: e.target.checked })}
                  />
                  Stop on booking
                </label>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={draft.stopOnUnsubscribe}
                    onChange={(e) => updateDraft(sequence.id, { stopOnUnsubscribe: e.target.checked })}
                  />
                  Stop on unsubscribe
                </label>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {draft.steps.map((step, index) => (
                <div key={`${sequence.id}-${step.id || index}`} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-text-secondary">Step {index + 1}</p>
                    <Button size="sm" variant="outline" onClick={() => removeStep(sequence.id, index)}>
                      Remove
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <input
                        className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                        value={step.label}
                        onChange={(e) => {
                          const steps = [...draft.steps];
                          steps[index] = { ...step, label: e.target.value };
                          updateDraft(sequence.id, { steps });
                        }}
                        placeholder="Label"
                      />
                      <input
                        className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                        value={step.channel}
                        onChange={(e) => {
                          const steps = [...draft.steps];
                          steps[index] = { ...step, channel: e.target.value };
                          updateDraft(sequence.id, { steps });
                        }}
                        placeholder="Channel"
                      />
                      <input
                        className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                        value={step.delayHours}
                        onChange={(e) => {
                          const steps = [...draft.steps];
                          steps[index] = { ...step, delayHours: e.target.value };
                          updateDraft(sequence.id, { steps });
                        }}
                        placeholder="Delay hours"
                      />
                    </div>
                    <input
                      className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                      value={step.subject}
                      onChange={(e) => {
                        const steps = [...draft.steps];
                        steps[index] = { ...step, subject: e.target.value };
                        updateDraft(sequence.id, { steps });
                      }}
                      placeholder="Subject"
                    />
                    <textarea
                      className="min-h-24 rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                      value={step.body}
                      onChange={(e) => {
                        const steps = [...draft.steps];
                        steps[index] = { ...step, body: e.target.value };
                        updateDraft(sequence.id, { steps });
                      }}
                      placeholder="Body"
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                        value={step.cta}
                        onChange={(e) => {
                          const steps = [...draft.steps];
                          steps[index] = { ...step, cta: e.target.value };
                          updateDraft(sequence.id, { steps });
                        }}
                        placeholder="CTA"
                      />
                      <input
                        className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                        value={step.link}
                        onChange={(e) => {
                          const steps = [...draft.steps];
                          steps[index] = { ...step, link: e.target.value };
                          updateDraft(sequence.id, { steps });
                        }}
                        placeholder="Link"
                      />
                      <input
                        className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                        value={step.attachmentNote}
                        onChange={(e) => {
                          const steps = [...draft.steps];
                          steps[index] = { ...step, attachmentNote: e.target.value };
                          updateDraft(sequence.id, { steps });
                        }}
                        placeholder="Attachment note"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div>
        <h2 className="text-sm font-medium text-text-primary">Recent deliveries</h2>
        {deliveries.length === 0 ? (
          <p className="mt-2 text-xs text-text-muted">No deliveries yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {deliveries.slice(0, 20).map((d) => (
              <li key={d.id} className="rounded-md border border-border bg-card px-3 py-2 text-xs">
                <span className="font-medium text-text-primary">{d.subject}</span>
                <span className="text-text-muted"> · {d.status} · step {d.stepOrder + 1}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

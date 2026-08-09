'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import {
  PIPELINE_LABELS,
  type DeliveryEvent,
  type OutreachLead,
  type OutreachSequence,
} from '@/components/outreach/types';

export default function OutreachLeadDetailPage() {
  const params = useParams<{ leadId: string }>();
  const leadId = params.leadId;
  const { push } = useToast();
  const [lead, setLead] = useState<OutreachLead | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryEvent[]>([]);
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!leadId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/aiva/outreach/leads/${leadId}`).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/aiva/outreach/sequences').then((res) => (res.ok ? res.json() : { sequences: [] })),
    ])
      .then(([detail, seq]) => {
        setLead(detail?.lead ?? null);
        setDeliveries(detail?.deliveries ?? []);
        setSequences(seq?.sequences ?? []);
      })
      .catch(() => {
        setLead(null);
        setDeliveries([]);
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const enroll = useCallback(async () => {
    const sequenceId = sequences[0]?.id;
    if (!sequenceId || !leadId) {
      push('No sequence available', 'error');
      return;
    }
    const res = await fetch('/api/aiva/outreach/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, sequenceId, campaignId: lead?.campaignId }),
    });
    if (!res.ok) {
      push('Could not enroll lead', 'error');
      return;
    }
    push('Lead enrolled in sequence', 'success');
    load();
  }, [sequences, leadId, lead?.campaignId, push, load]);

  const mark = useCallback(
    async (action: 'reply' | 'booked' | 'unsubscribe') => {
      const res = await fetch(`/api/aiva/outreach/leads/${leadId}/${action}`, { method: 'POST' });
      if (!res.ok) {
        push(`Could not mark ${action}`, 'error');
        return;
      }
      load();
    },
    [leadId, push, load],
  );

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading lead...</div>;
  if (!lead) {
    return (
      <div className="p-6 text-sm text-text-muted">
        Lead not found.{' '}
        <Link href="/aiva/outreach/leads" className="text-accent underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-6 p-6">
      <div>
        <Link href="/aiva/outreach/leads" className="text-xs text-accent underline">
          All leads
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-text-primary">{lead.name}</h2>
        <p className="text-sm text-text-muted">
          {PIPELINE_LABELS[lead.status] ?? lead.status}
          {lead.email ? ` · ${lead.email}` : ''}
          {lead.company ? ` · ${lead.company}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void enroll()}>
          Enroll in default sequence
        </Button>
        <Button size="sm" variant="outline" onClick={() => void mark('reply')}>
          Mark replied
        </Button>
        <Button size="sm" variant="outline" onClick={() => void mark('booked')}>
          Mark booked
        </Button>
        <Button size="sm" variant="outline" onClick={() => void mark('unsubscribe')}>
          Unsubscribe
        </Button>
      </div>

      {lead.notes ? (
        <div className="rounded-lg border border-border bg-card p-3 text-sm text-text-secondary">
          {lead.notes}
        </div>
      ) : null}

      <div>
        <h3 className="text-sm font-medium text-text-primary">Timeline</h3>
        <ul className="mt-2 space-y-2">
          {lead.timeline.length === 0 ? (
            <li className="text-xs text-text-muted">No events yet.</li>
          ) : (
            [...lead.timeline].reverse().map((event) => (
              <li key={event.id} className="rounded-md border border-border bg-card px-3 py-2 text-xs">
                <span className="text-text-muted">{new Date(event.at).toLocaleString()}</span>
                <p className="mt-0.5 text-text-secondary">{event.message}</p>
              </li>
            ))
          )}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary">Deliveries</h3>
        <ul className="mt-2 space-y-2">
          {deliveries.length === 0 ? (
            <li className="text-xs text-text-muted">No deliveries yet. Process due sends from Overview.</li>
          ) : (
            deliveries.map((d) => (
              <li key={d.id} className="rounded-md border border-border bg-card px-3 py-2 text-xs">
                <p className="font-medium text-text-primary">
                  {d.subject} · {d.status}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-text-secondary">{d.body}</p>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

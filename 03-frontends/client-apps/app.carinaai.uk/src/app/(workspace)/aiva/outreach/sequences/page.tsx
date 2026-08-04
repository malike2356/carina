'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { DeliveryEvent, OutreachSequence } from '@/components/outreach/types';

export default function OutreachSequencesPage() {
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/aiva/outreach/sequences').then((res) => (res.ok ? res.json() : { sequences: [] })),
      fetch('/api/aiva/outreach/deliveries').then((res) => (res.ok ? res.json() : { deliveries: [] })),
    ])
      .then(([seq, del]) => {
        setSequences(seq.sequences ?? []);
        setDeliveries(del.deliveries ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

      {sequences.map((seq) => (
        <div key={seq.id} className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-text-primary">{seq.name}</h2>
          {seq.description ? (
            <p className="mt-1 text-xs text-text-muted">{seq.description}</p>
          ) : null}
          <p className="mt-1 text-xs text-text-muted">
            Stops on: {[
              seq.stopOnReply ? 'reply' : null,
              seq.stopOnBooking ? 'booking' : null,
              seq.stopOnUnsubscribe ? 'unsubscribe' : null,
            ]
              .filter(Boolean)
              .join(', ')}
          </p>
          <ol className="mt-3 space-y-2">
            {seq.steps.map((step) => (
              <li key={step.id} className="rounded-md border border-border bg-elevated px-3 py-2 text-xs">
                <p className="font-medium text-text-primary">
                  {step.order + 1}. {step.label} · {step.channel} · +{step.delayHours}h
                </p>
                <p className="mt-0.5 text-text-secondary">{step.subject}</p>
              </li>
            ))}
          </ol>
        </div>
      ))}

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

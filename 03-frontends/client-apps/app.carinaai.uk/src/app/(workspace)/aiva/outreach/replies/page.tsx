'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';

type ReplyReview = {
  id: string;
  leadId: string | null;
  fromEmail: string;
  subject: string;
  bodyPreview: string;
  classification: string;
  confidence: number;
  status: 'open' | 'resolved';
  actionTaken?: string;
  suggestedReply?: string;
  note?: string;
  updatedAt: string;
};

const CLASSIFICATIONS = [
  'interested',
  'booking_intent',
  'question',
  'objection',
  'not_interested',
  'not_now',
  'unsubscribe',
  'ooo',
  'unknown',
] as const;

export default function OutreachRepliesPage() {
  const { push } = useToast();
  const [reviews, setReviews] = useState<ReplyReview[]>([]);
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [demoFrom, setDemoFrom] = useState('lead@example.com');
  const [demoSubject, setDemoSubject] = useState('Re: discovery');
  const [demoBody, setDemoBody] = useState('Sounds good, can we book a call?');

  const load = useCallback(() => {
    setLoading(true);
    const q = status === 'all' ? '' : `?status=${status}`;
    fetch(`/api/aiva/outreach/replies/review${q}`)
      .then((res) => (res.ok ? res.json() : { reviews: [] }))
      .then((data: { reviews?: ReplyReview[] }) => setReviews(data.reviews ?? []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = useCallback(
    async (reviewId: string, classification: string) => {
      const res = await fetch(`/api/aiva/outreach/replies/${reviewId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classification }),
      });
      if (!res.ok) {
        push('Could not resolve reply', 'error');
        return;
      }
      push('Reply reviewed', 'success');
      load();
    },
    [push, load],
  );

  const recordInboundReply = useCallback(async () => {
    const res = await fetch('/api/aiva/outreach/replies/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromEmail: demoFrom,
        subject: demoSubject,
        body: demoBody,
      }),
    });
    if (!res.ok) {
      push('Could not ingest reply', 'error');
      return;
    }
    push('Inbound reply processed', 'success');
    load();
  }, [demoFrom, demoSubject, demoBody, push, load]);

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          Unknown replies stay open for manual review. Interest and booking intent promote leads automatically.
        </p>
        <div className="flex gap-1">
          {(['open', 'resolved', 'all'] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={status === value ? 'default' : 'outline'}
              onClick={() => setStatus(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-text-primary">Record inbound reply</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input className="rounded-md border border-border bg-elevated px-3 py-2 text-sm" value={demoFrom} onChange={(e) => setDemoFrom(e.target.value)} placeholder="from@" />
          <input className="rounded-md border border-border bg-elevated px-3 py-2 text-sm md:col-span-2" value={demoSubject} onChange={(e) => setDemoSubject(e.target.value)} placeholder="Subject" />
          <textarea className="rounded-md border border-border bg-elevated px-3 py-2 text-sm md:col-span-3" rows={3} value={demoBody} onChange={(e) => setDemoBody(e.target.value)} />
        </div>
        <Button size="sm" className="mt-2" onClick={() => void recordInboundReply()}>
          Process reply
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading replies...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-text-muted">No replies in this view.</p>
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-text-primary">
                  {review.fromEmail} · {review.classification} ({Math.round(review.confidence * 100)}%)
                </p>
                <span className="text-xs text-text-muted">{review.status}</span>
              </div>
              <p className="mt-1 text-xs text-text-secondary">{review.subject}</p>
              <p className="mt-1 text-sm text-text-secondary">{review.bodyPreview}</p>
              {review.suggestedReply ? (
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-elevated p-2 text-xs text-text-muted">{review.suggestedReply}</pre>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {review.leadId ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/aiva/outreach/leads/${review.leadId}`}>Open lead</Link>
                  </Button>
                ) : null}
                {review.status === 'open'
                  ? CLASSIFICATIONS.map((c) => (
                      <Button key={c} size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => void resolve(review.id, c)}>
                        {c}
                      </Button>
                    ))
                  : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

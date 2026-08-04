'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import type { OutreachCampaign } from '@/components/outreach/types';

export default function OutreachCampaignsPage() {
  const { push } = useToast();
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/aiva/outreach/campaigns')
      .then((res) => (res.ok ? res.json() : { campaigns: [] }))
      .then((data: { campaigns?: OutreachCampaign[] }) => setCampaigns(data.campaigns ?? []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async () => {
    if (!name.trim()) {
      push('Campaign name is required', 'error');
      return;
    }
    const res = await fetch('/api/aiva/outreach/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, objective }),
    });
    if (!res.ok) {
      push('Could not create campaign', 'error');
      return;
    }
    setName('');
    setObjective('');
    load();
  }, [name, objective, push, load]);

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-text-primary">New campaign</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-md border border-border bg-elevated px-3 py-2 text-sm"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="flex-[2] rounded-md border border-border bg-elevated px-3 py-2 text-sm"
            placeholder="Objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
          <Button size="sm" onClick={() => void create()}>
            Create
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading campaigns...</p>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-text-primary">{c.name}</p>
                <span className="text-xs text-text-muted">{c.active ? 'Active' : 'Paused'}</span>
              </div>
              <p className="mt-1 text-xs text-text-secondary">{c.objective || 'No objective set'}</p>
              <p className="mt-1 text-xs text-text-muted">
                Cap {c.cadence.dailyCap}/day · {c.cadence.businessHoursStart}-{c.cadence.businessHoursEnd}{' '}
                {c.cadence.timezone}
                {c.targetAudience ? ` · ${c.targetAudience}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

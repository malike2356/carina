'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import type { OutreachCampaign } from '@/components/outreach/types';

type CampaignDraft = {
  name: string;
  objective: string;
  targetAudience: string;
  active: boolean;
  dailyCap: string;
  timezone: string;
  businessHoursStart: string;
  businessHoursEnd: string;
  businessDays: string;
  fromEmail: string;
  defaultBookingLink: string;
  defaultSequenceId: string;
};

function makeDraft(campaign: OutreachCampaign): CampaignDraft {
  return {
    name: campaign.name,
    objective: campaign.objective,
    targetAudience: campaign.targetAudience,
    active: campaign.active,
    dailyCap: String(campaign.cadence.dailyCap),
    timezone: campaign.cadence.timezone,
    businessHoursStart: campaign.cadence.businessHoursStart,
    businessHoursEnd: campaign.cadence.businessHoursEnd,
    businessDays: (campaign.cadence.businessDays ?? []).join(', '),
    fromEmail: campaign.cadence.fromEmail ?? '',
    defaultBookingLink: campaign.defaultBookingLink ?? '',
    defaultSequenceId: campaign.defaultSequenceId ?? '',
  };
}

function parseBusinessDays(value: string): number[] | undefined {
  const days = value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
  return days.length ? days : undefined;
}

export default function OutreachCampaignsPage() {
  const { push } = useToast();
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CampaignDraft>>({});
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/aiva/outreach/campaigns')
      .then((res) => (res.ok ? res.json() : { campaigns: [] }))
      .then((data: { campaigns?: OutreachCampaign[] }) => {
        const items = data.campaigns ?? [];
        setCampaigns(items);
        setDrafts((current) => {
          const next: Record<string, CampaignDraft> = {};
          for (const campaign of items) {
            next[campaign.id] = current[campaign.id] ?? makeDraft(campaign);
          }
          return next;
        });
      })
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
    push('Campaign created', 'success');
    load();
  }, [name, objective, push, load]);

  const updateDraft = useCallback((id: string, patch: Partial<CampaignDraft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? {
          name: '',
          objective: '',
          targetAudience: '',
          active: true,
          dailyCap: '10',
          timezone: 'Europe/London',
          businessHoursStart: '09:00',
          businessHoursEnd: '17:00',
          businessDays: '1, 2, 3, 4, 5',
          fromEmail: '',
          defaultBookingLink: '',
          defaultSequenceId: '',
        }),
        ...patch,
      },
    }));
  }, []);

  const saveCampaign = useCallback(async (campaignId: string) => {
    const draft = drafts[campaignId];
    if (!draft) return;
    const res = await fetch(`/api/aiva/outreach/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        objective: draft.objective,
        targetAudience: draft.targetAudience,
        active: draft.active,
        dailyCap: Number(draft.dailyCap) || 1,
        timezone: draft.timezone,
        businessHoursStart: draft.businessHoursStart,
        businessHoursEnd: draft.businessHoursEnd,
        businessDays: parseBusinessDays(draft.businessDays),
        fromEmail: draft.fromEmail.trim() || null,
        defaultBookingLink: draft.defaultBookingLink.trim() || '',
        defaultSequenceId: draft.defaultSequenceId.trim() || '',
      }),
    });
    if (!res.ok) {
      push('Could not save campaign', 'error');
      return;
    }
    push('Campaign saved', 'success');
    load();
  }, [drafts, load, push]);

  const toggleCampaign = useCallback(async (campaign: OutreachCampaign) => {
    const res = await fetch(`/api/aiva/outreach/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !campaign.active }),
    });
    if (!res.ok) {
      push('Could not update campaign status', 'error');
      return;
    }
    push(campaign.active ? 'Campaign paused' : 'Campaign resumed', 'success');
    load();
  }, [load, push]);

  const deleteCampaign = useCallback(async (campaign: OutreachCampaign) => {
    if (!window.confirm(`Delete campaign "${campaign.name}"? Leads remain in CRM and will be unlinked.`)) return;
    const res = await fetch(`/api/aiva/outreach/campaigns/${campaign.id}`, { method: 'DELETE' });
    if (!res.ok) {
      push('Could not delete campaign', 'error');
      return;
    }
    push('Campaign deleted', 'success');
    load();
  }, [load, push]);

  const campaignCount = useMemo(() => campaigns.length, [campaigns.length]);

  return (
    <div className="w-full max-w-none space-y-6 p-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-text-primary">New campaign</h2>
        <div className="mt-3 flex flex-col gap-2 lg:flex-row">
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

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-text-primary">Campaigns</h2>
        <p className="text-xs text-text-muted">{campaignCount} total</p>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading campaigns...</p>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const draft = drafts[campaign.id] ?? makeDraft(campaign);
            return (
              <div key={campaign.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{campaign.name}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {campaign.active ? 'Active' : 'Paused'}
                      {campaign.targetAudience ? ` · ${campaign.targetAudience}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => void toggleCampaign(campaign)}>
                      {campaign.active ? 'Pause' : 'Resume'}
                    </Button>
                    <Button size="sm" onClick={() => void saveCampaign(campaign.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void deleteCampaign(campaign)}>
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={draft.name}
                    onChange={(e) => updateDraft(campaign.id, { name: e.target.value })}
                    placeholder="Campaign name"
                  />
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={draft.targetAudience}
                    onChange={(e) => updateDraft(campaign.id, { targetAudience: e.target.value })}
                    placeholder="Target audience"
                  />
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm lg:col-span-2"
                    value={draft.objective}
                    onChange={(e) => updateDraft(campaign.id, { objective: e.target.value })}
                    placeholder="Objective"
                  />
                  <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
                    <input
                      className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                      value={draft.dailyCap}
                      onChange={(e) => updateDraft(campaign.id, { dailyCap: e.target.value })}
                      placeholder="Daily cap"
                      inputMode="numeric"
                    />
                    <input
                      className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                      value={draft.timezone}
                      onChange={(e) => updateDraft(campaign.id, { timezone: e.target.value })}
                      placeholder="Timezone"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
                    <input
                      className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                      value={draft.businessHoursStart}
                      onChange={(e) => updateDraft(campaign.id, { businessHoursStart: e.target.value })}
                      placeholder="Business hours start"
                    />
                    <input
                      className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                      value={draft.businessHoursEnd}
                      onChange={(e) => updateDraft(campaign.id, { businessHoursEnd: e.target.value })}
                      placeholder="Business hours end"
                    />
                  </div>
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm lg:col-span-2"
                    value={draft.businessDays}
                    onChange={(e) => updateDraft(campaign.id, { businessDays: e.target.value })}
                    placeholder="Business days, comma separated"
                  />
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={draft.fromEmail}
                    onChange={(e) => updateDraft(campaign.id, { fromEmail: e.target.value })}
                    placeholder="From email"
                  />
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={draft.defaultSequenceId}
                    onChange={(e) => updateDraft(campaign.id, { defaultSequenceId: e.target.value })}
                    placeholder="Default sequence id"
                  />
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm lg:col-span-2"
                    value={draft.defaultBookingLink}
                    onChange={(e) => updateDraft(campaign.id, { defaultBookingLink: e.target.value })}
                    placeholder="Default booking link"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

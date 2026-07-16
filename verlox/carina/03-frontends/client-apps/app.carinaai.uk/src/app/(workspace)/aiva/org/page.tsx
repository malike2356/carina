'use client';

import { useEffect, useState } from 'react';
import { AivaOrgSettingsCard } from '@/components/aiva/AivaOrgSettingsCard';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
};

export default function AivaOrgShellPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/aiva/orgs');
      const data = (await res.json()) as {
        enabled?: boolean;
        orgs?: OrgRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'Could not load orgs');
        return;
      }
      setEnabled(Boolean(data.enabled));
      setOrgs(data.orgs ?? []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orgs');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setActive(orgId: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/aiva/orgs/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      const data = (await res.json()) as { orgs?: OrgRow[]; enabled?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Switch failed');
        return;
      }
      setEnabled(Boolean(data.enabled ?? true));
      setOrgs(data.orgs ?? []);
      window.dispatchEvent(new CustomEvent('aiva-org-changed', { detail: { orgId } }));
    } finally {
      setBusy(false);
    }
  }

  const active = orgs.find((org) => org.active);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Organization</h1>
        <p className="mt-1 text-sm text-text-muted">
          Active org scopes workers, tool accounts, projects, and canvas when strict scoping is on.
          Billing stays on the workspace owner.
        </p>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!enabled ? (
        <p className="text-sm text-text-muted">Org switcher disabled in depth-features.</p>
      ) : (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <label className="block text-sm">
            <span className="mb-1 block text-text-muted">Active organization</span>
            <select
              className={AIVA_INPUT_CLASS}
              disabled={busy || orgs.length === 0}
              value={active?.id ?? ''}
              onChange={(e) => void setActive(e.target.value)}
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          {orgs.length === 0 ? (
            <p className="text-sm text-text-muted">
              Link a hosted org below, then switch between membership-adjacent orgs.
            </p>
          ) : null}
        </section>
      )}
      <AivaOrgSettingsCard />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  active: boolean;
};

export function AivaOrgSwitcher({ className }: { className?: string }) {
  const [enabled, setEnabled] = useState(false);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    setError('');
    try {
      const res = await fetch('/api/aiva/orgs/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      const data = (await res.json()) as { orgs?: OrgRow[]; error?: string; enabled?: boolean };
      if (!res.ok) {
        setError(data.error ?? 'Could not switch org');
        return;
      }
      setEnabled(Boolean(data.enabled ?? true));
      setOrgs(data.orgs ?? []);
      window.dispatchEvent(new CustomEvent('aiva-org-changed', { detail: { orgId } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch org');
    } finally {
      setBusy(false);
    }
  }

  if (!enabled || orgs.length === 0) return null;

  const active = orgs.find((org) => org.active) ?? orgs[0];

  return (
    <div className={cn('px-3 pb-2', className)}>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        Organization
      </label>
      <select
        className="w-full rounded-lg border border-border bg-elevated px-2 py-1.5 text-sm text-text-primary"
        disabled={busy}
        value={active?.id ?? ''}
        onChange={(e) => void setActive(e.target.value)}
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PlanGateSection } from '@/components/billing/PlanGateSection';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

interface GovernanceRules {
  volumeSpikeThreshold: number;
  escalationRateThreshold: number;
  escalationBurstWindow: number;
  escalationBurstCount: number;
  ignoreSignalTypes: string[];
}

const DEFAULT_GOVERNANCE: GovernanceRules = {
  volumeSpikeThreshold: 50,
  escalationRateThreshold: 0.3,
  escalationBurstWindow: 5,
  escalationBurstCount: 3,
  ignoreSignalTypes: [],
};

const SIGNAL_TYPES = [
  { id: 'volume_spike', label: 'Volume spike', description: 'Too many messages per hour' },
  { id: 'high_escalation_rate', label: 'High escalation rate', description: 'Escalation rate exceeds threshold' },
  { id: 'escalation_burst', label: 'Escalation burst', description: 'Many escalations in a short window' },
  { id: 'unauthorized_tool_attempt', label: 'Unauthorized tool attempt', description: 'Aiva tried a disallowed tool' },
  { id: 'tool_failure_loop', label: 'Tool failure loop', description: 'A tool failed multiple times in succession' },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function GovernanceSettingsPage() {
  const { push } = useToast();
  const [rules, setRules] = useState<GovernanceRules>({
    volumeSpikeThreshold: 50,
    escalationRateThreshold: 0.3,
    escalationBurstWindow: 5,
    escalationBurstCount: 3,
    ignoreSignalTypes: [],
  });
  const [planTier, setPlanTier] = useState('trial');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workspace/scout-governance');
      if (!res.ok) throw new Error('Failed to load');
      const body = (await res.json()) as { rules: GovernanceRules; planTier?: string };
      setRules(body.rules);
      setPlanTier(body.planTier ?? 'trial');
    } catch {
      push('Could not load governance rules.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof GovernanceRules>(key: K, value: GovernanceRules[K]) {
    setRules((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSignal(id: string) {
    setRules((prev) => {
      const set = new Set(prev.ignoreSignalTypes);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, ignoreSignalTypes: [...set] };
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/workspace/scout-governance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules),
      });
      const body = (await res.json()) as { rules?: GovernanceRules; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Save failed');
      if (body.rules) setRules(body.rules);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
      push('Rules saved', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full min-w-0 max-w-none space-y-4 p-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-none space-y-6 p-6">
      <div>
        <Link href="/settings" className="text-xs text-accent hover:underline">
          Back to settings
        </Link>
      </div>

      <PlanGateSection planRequired="business" currentPlan={planTier}>
        <div className="mb-2">
          <h1 className="text-lg font-semibold text-text-primary">Scout governance rules</h1>
          <p className="mt-1 text-sm text-text-muted">
            Customize how Scout monitors your Aiva. These settings override VERLOX defaults.
          </p>
        </div>

        <div className="divide-y divide-border rounded-lg border border-border bg-elevated p-4">
          <h2 className="pb-3 text-sm font-semibold text-text-primary">Signal thresholds</h2>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-text-secondary">Volume spike</p>
              <p className="text-[11px] text-text-muted">Alert when messages per hour exceeds this</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                aria-label="Volume spike threshold messages per hour"
                value={rules.volumeSpikeThreshold}
                min={10}
                max={1000}
                onChange={(e) =>
                  update('volumeSpikeThreshold', clamp(Number(e.target.value), 10, 1000))
                }
                className="w-20 rounded-lg border border-border bg-base px-3 py-2 text-center text-sm text-text-primary outline-none focus:border-accent"
              />
              <span className="w-16 text-xs text-text-muted">msgs / hr</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-text-secondary">Escalation rate</p>
              <p className="text-[11px] text-text-muted">Alert when this % of conversations escalate</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                aria-label="Escalation rate threshold percent"
                value={Math.round(rules.escalationRateThreshold * 100)}
                min={5}
                max={100}
                onChange={(e) =>
                  update('escalationRateThreshold', clamp(Number(e.target.value), 5, 100) / 100)
                }
                className="w-20 rounded-lg border border-border bg-base px-3 py-2 text-center text-sm text-text-primary outline-none focus:border-accent"
              />
              <span className="w-16 text-xs text-text-muted">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-text-secondary">Escalation burst</p>
              <p className="text-[11px] text-text-muted">Alert when N escalations happen within M minutes</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <input
                type="number"
                aria-label="Escalation burst count"
                value={rules.escalationBurstCount}
                min={1}
                max={50}
                onChange={(e) =>
                  update('escalationBurstCount', clamp(Number(e.target.value), 1, 50))
                }
                className="w-16 rounded-lg border border-border bg-base px-2 py-2 text-center text-sm text-text-primary outline-none focus:border-accent"
              />
              <span className="text-xs text-text-muted">in</span>
              <input
                type="number"
                aria-label="Escalation burst window minutes"
                value={rules.escalationBurstWindow}
                min={1}
                max={60}
                onChange={(e) =>
                  update('escalationBurstWindow', clamp(Number(e.target.value), 1, 60))
                }
                className="w-16 rounded-lg border border-border bg-base px-2 py-2 text-center text-sm text-text-primary outline-none focus:border-accent"
              />
              <span className="w-10 text-xs text-text-muted">mins</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-elevated p-4">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Suppress signal types</h2>
          <div className="space-y-0">
            {SIGNAL_TYPES.map((signal) => {
              const suppressed = rules.ignoreSignalTypes.includes(signal.id);
              return (
                <button
                  key={signal.id}
                  type="button"
                  onClick={() => toggleSignal(signal.id)}
                  className="flex w-full items-start gap-3 border-b border-border py-2.5 text-left last:border-0"
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      suppressed ? 'border-accent bg-accent' : 'border-border',
                    )}
                  >
                    {suppressed ? <Check className="h-2.5 w-2.5 text-white" /> : null}
                  </div>
                  <span>
                    <span className="block text-sm text-text-primary">{signal.label}</span>
                    <span className="text-[11px] text-text-muted">{signal.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {rules.ignoreSignalTypes.length > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-[11px] text-amber-400">
                WARNING: Suppressed signals are not visible in the Scout fleet view or the admin
                dashboard, and are not cached locally. Only suppress signals that do not apply to
                your operations.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-md bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save rules'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setRules(DEFAULT_GOVERNANCE);
              void fetch('/api/workspace/scout-governance', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(DEFAULT_GOVERNANCE),
              }).then(() => {
                setSaved(true);
                setTimeout(() => setSaved(false), 4000);
                push('Reset to VERLOX defaults.', 'success');
              });
            }}
            className="rounded-md border border-border px-4 py-2 text-sm text-text-muted hover:bg-overlay"
          >
            Reset to defaults
          </button>
          {saved ? <p className="text-xs text-green-400">Saved.</p> : null}
        </div>
      </PlanGateSection>
    </div>
  );
}

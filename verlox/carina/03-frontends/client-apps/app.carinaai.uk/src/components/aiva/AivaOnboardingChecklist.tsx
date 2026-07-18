'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

type Plan = {
  id: string;
  title: string;
  steps: Array<{ id: string; label: string }>;
};

type Progress = {
  planId: string;
  steps: Array<{ id?: string; label?: string; done?: boolean }>;
  completedAt: string | null;
} | null;

export function AivaOnboardingChecklist({ workerId }: { workerId: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [progress, setProgress] = useState<Progress>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/aiva/workers/${workerId}/onboarding`);
    const data = (await res.json()) as {
      plans?: Plan[];
      progress?: Progress;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error ?? 'Could not load onboarding');
      return;
    }
    setPlans(data.plans ?? []);
    setProgress(data.progress ?? null);
  }

  useEffect(() => {
    void load();
  }, [workerId]);

  async function startPlan(planId: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = (await res.json()) as { progress?: Progress; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not start plan');
        return;
      }
      setProgress(data.progress ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function completeStep(stepId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/aiva/workers/${workerId}/onboarding/steps/${encodeURIComponent(stepId)}/complete`,
        { method: 'POST' },
      );
      const data = (await res.json()) as { progress?: Progress; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not update step');
        return;
      }
      setProgress(data.progress ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start gap-3">
        <ListChecks className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h3 className="text-base font-semibold text-text-primary">Onboarding plan</h3>
          <p className="mt-1 text-sm text-text-muted">
            Guided setup after hire. Mark each step when done.
          </p>
        </div>
      </div>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {!progress ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              disabled={busy}
              onClick={() => void startPlan(plan.id)}
              className="rounded-xl border border-border bg-elevated p-4 text-left hover:border-primary/30"
            >
              <p className="text-sm font-medium text-text-primary">{plan.title}</p>
              <p className="mt-1 text-xs text-text-muted">{plan.steps.length} steps</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Plan: {plans.find((plan) => plan.id === progress.planId)?.title ?? progress.planId}
            {progress.completedAt ? ' (complete)' : ''}
          </p>
          <ul className="space-y-2">
            {progress.steps.map((step) => {
              const done = Boolean(step.done);
              return (
                <li key={String(step.id)}>
                  <button
                    type="button"
                    disabled={busy || done || !step.id}
                    onClick={() => step.id && void completeStep(step.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left',
                      done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border hover:bg-overlay',
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 text-text-muted" />
                    )}
                    <span className="text-sm text-text-primary">{step.label ?? step.id}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

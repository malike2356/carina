'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';

type Criterion = {
  id: string;
  label: string;
  description: string;
  defaultWeight: number;
};

type ScoreResult = {
  score: number;
  recommendation: 'GREEN' | 'YELLOW' | 'RED';
  automaticFail: boolean;
  automaticFailReason?: string;
  flags: Array<{ criterionId: string; label: string; severity: string; detail: string; pointsDeducted: number }>;
};

type ProfileForm = {
  name: string;
  company: string;
  email: string;
  industry: string;
  dealSizeGbp: string;
  scopeChangeCount: string;
  complimentCount: string;
  substantiveQuestionCount: string;
  budgetMatchesScope: boolean;
  decisionMakerPresent: boolean;
  timelineRealistic: boolean;
  asksAboutProcess: boolean;
  badVendorHistory: boolean;
  paymentIssues: boolean;
};

const emptyForm = (): ProfileForm => ({
  name: '',
  company: '',
  email: '',
  industry: '',
  dealSizeGbp: '',
  scopeChangeCount: '0',
  complimentCount: '0',
  substantiveQuestionCount: '0',
  budgetMatchesScope: true,
  decisionMakerPresent: true,
  timelineRealistic: true,
  asksAboutProcess: true,
  badVendorHistory: false,
  paymentIssues: false,
});

function recClass(rec: string): string {
  if (rec === 'GREEN') return 'text-emerald-700 dark:text-emerald-300';
  if (rec === 'YELLOW') return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

export default function QualificationScorecardPage() {
  const { push } = useToast();
  const searchParams = useSearchParams();
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [guidance, setGuidance] = useState('');
  const [declinePreview, setDeclinePreview] = useState<{ subject: string; body: string; reason: string } | null>(
    null,
  );
  const [patterns, setPatterns] = useState<{
    declinedCount: number;
    topRecurringFlags: string[];
    flagsByCriterion: Array<{ criterionId: string; count: number }>;
  } | null>(null);
  const [screenEarlier, setScreenEarlier] = useState('');
  const [overrideBy, setOverrideBy] = useState('');
  const [overrideWhy, setOverrideWhy] = useState('');
  const [busy, setBusy] = useState(false);

  const loadMeta = useCallback(() => {
    fetch('/api/aiva/outreach/qualification/template')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.template) return;
        setCriteria(data.template.criteria ?? []);
        setWeights(data.template.weights ?? {});
      })
      .catch(() => undefined);
    fetch('/api/aiva/outreach/qualification/patterns')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.patterns) setPatterns(data.patterns);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    const name = searchParams.get('name');
    if (!name) return;
    setForm((f) => ({
      ...f,
      name,
      company: searchParams.get('company') || f.company,
      email: searchParams.get('email') || f.email,
    }));
  }, [searchParams]);

  const score = async () => {
    if (!form.name.trim()) {
      push('Client name is required', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/aiva/outreach/qualification/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientProfile: {
            name: form.name.trim(),
            company: form.company.trim() || undefined,
            email: form.email.trim() || undefined,
            industry: form.industry.trim() || undefined,
            dealSizeGbp: form.dealSizeGbp ? Number(form.dealSizeGbp) : undefined,
            scopeChangeCount: Number(form.scopeChangeCount) || 0,
            complimentCount: Number(form.complimentCount) || 0,
            substantiveQuestionCount: Number(form.substantiveQuestionCount) || 0,
            budgetMatchesScope: form.budgetMatchesScope,
            decisionMakerPresent: form.decisionMakerPresent,
            timelineRealistic: form.timelineRealistic,
            asksAboutProcess: form.asksAboutProcess,
            badVendorHistory: form.badVendorHistory,
            paymentIssues: form.paymentIssues,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        push(data.error || 'Could not score client', 'error');
        return;
      }
      setResult(data.result);
      setGuidance(data.guidance || '');
      setDeclinePreview(data.declinePreview);
    } finally {
      setBusy(false);
    }
  };

  const saveWeights = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/aiva/outreach/qualification/weights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights }),
      });
      if (!res.ok) {
        push('Could not save weights', 'error');
        return;
      }
      push('Scorecard weights saved', 'success');
      loadMeta();
    } finally {
      setBusy(false);
    }
  };

  const logDecline = async () => {
    if (!result || result.recommendation !== 'RED') {
      push('Log decline only after a RED score', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/aiva/outreach/qualification/declines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientProfile: {
            name: form.name.trim(),
            company: form.company.trim() || undefined,
            industry: form.industry.trim() || undefined,
            dealSizeGbp: form.dealSizeGbp ? Number(form.dealSizeGbp) : undefined,
            scopeChangeCount: Number(form.scopeChangeCount) || 0,
            budgetMatchesScope: form.budgetMatchesScope,
            decisionMakerPresent: form.decisionMakerPresent,
            timelineRealistic: form.timelineRealistic,
            asksAboutProcess: form.asksAboutProcess,
            badVendorHistory: form.badVendorHistory,
            paymentIssues: form.paymentIssues,
            complimentCount: Number(form.complimentCount) || 0,
            substantiveQuestionCount: Number(form.substantiveQuestionCount) || 0,
          },
          scorecard: result,
          screenEarlier: screenEarlier.trim() || undefined,
        }),
      });
      if (!res.ok) {
        push('Could not log decline', 'error');
        return;
      }
      push('Post-decline review saved', 'success');
      setScreenEarlier('');
      loadMeta();
    } finally {
      setBusy(false);
    }
  };

  const logOverride = async () => {
    if (!result || result.recommendation !== 'RED') {
      push('Override only applies to RED recommendations', 'error');
      return;
    }
    if (!overrideBy.trim() || !overrideWhy.trim()) {
      push('Founder email and justification required', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/aiva/outreach/qualification/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: form.name.trim(),
          approvedBy: overrideBy.trim(),
          justification: overrideWhy.trim(),
          scorecardScore: result.score,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        push(data.error || 'Could not log override', 'error');
        return;
      }
      push('Founder override logged in audit trail', 'success');
      setOverrideWhy('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-none space-y-8 p-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Client qualification scorecard</h2>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          Score every deal before a proposal. GREEN proceed, YELLOW require retainer or milestones, RED walk away
          (founder override must be logged). Scoring is advisory; humans own commercial commitments.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-text-primary">Prospect profile</h3>
          <label className="block text-xs text-text-muted">
            Name
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-text-muted">
              Company
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-text-muted">
              Industry
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.industry}
                onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-xs text-text-muted">
              Scope changes
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.scopeChangeCount}
                onChange={(e) => setForm((f) => ({ ...f, scopeChangeCount: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-text-muted">
              Compliments
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.complimentCount}
                onChange={(e) => setForm((f) => ({ ...f, complimentCount: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-text-muted">
              Process questions
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.substantiveQuestionCount}
                onChange={(e) => setForm((f) => ({ ...f, substantiveQuestionCount: e.target.value }))}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
            {(
              [
                ['budgetMatchesScope', 'Budget matches scope'],
                ['decisionMakerPresent', 'Decision-maker present'],
                ['timelineRealistic', 'Timeline realistic'],
                ['asksAboutProcess', 'Asks about process'],
                ['badVendorHistory', 'Bad vendor history'],
                ['paymentIssues', 'Payment issues (auto FAIL)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <Button size="sm" disabled={busy} onClick={() => void score()}>
            Run scorecard
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-text-primary">Result</h3>
          {!result ? (
            <p className="text-xs text-text-muted">Run the scorecard to see GREEN / YELLOW / RED.</p>
          ) : (
            <>
              <p className={`text-2xl font-semibold ${recClass(result.recommendation)}`}>
                {result.score} · {result.recommendation}
              </p>
              <p className="text-sm text-text-secondary">{guidance}</p>
              {result.automaticFail ? (
                <p className="text-xs text-red-600">Automatic fail: {result.automaticFailReason}</p>
              ) : null}
              <ul className="space-y-2">
                {result.flags.map((f) => (
                  <li key={`${f.criterionId}-${f.detail}`} className="rounded-md border border-border px-3 py-2 text-xs">
                    <span className="font-medium text-text-primary">
                      {f.label} (−{f.pointsDeducted})
                    </span>
                    <p className="mt-0.5 text-text-muted">{f.detail}</p>
                  </li>
                ))}
                {result.flags.length === 0 ? (
                  <li className="text-xs text-text-muted">No red flags.</li>
                ) : null}
              </ul>
              {declinePreview ? (
                <div className="rounded-md border border-border bg-background p-3 text-xs">
                  <p className="font-medium text-text-primary">Walk-away draft ({declinePreview.reason})</p>
                  <p className="mt-1 text-text-muted">{declinePreview.subject}</p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-text-secondary">{declinePreview.body}</pre>
                </div>
              ) : null}
              {result.recommendation === 'RED' ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <label className="block text-xs text-text-muted">
                    Screen earlier next time
                    <input
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={screenEarlier}
                      onChange={(e) => setScreenEarlier(e.target.value)}
                    />
                  </label>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void logDecline()}>
                    Log post-decline review
                  </Button>
                  <div className="grid gap-2 pt-2">
                    <p className="text-xs font-medium text-text-primary">Founder RED override (audit)</p>
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      placeholder="approvedBy email"
                      value={overrideBy}
                      onChange={(e) => setOverrideBy(e.target.value)}
                    />
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      placeholder="Justification"
                      value={overrideWhy}
                      onChange={(e) => setOverrideWhy(e.target.value)}
                    />
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void logOverride()}>
                      Log founder override
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-text-primary">Adjustable weights</h3>
          <p className="text-xs text-text-muted">Review quarterly against declines and accepted-then-bad outcomes.</p>
          <ul className="space-y-2">
            {criteria.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-medium text-text-primary">{c.label}</p>
                  <p className="text-text-muted">{c.description}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm"
                  value={weights[c.id] ?? c.defaultWeight}
                  onChange={(e) =>
                    setWeights((w) => ({ ...w, [c.id]: Number(e.target.value) }))
                  }
                />
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void saveWeights()}>
            Save weights
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-text-primary">Decline patterns</h3>
          {!patterns ? (
            <p className="text-xs text-text-muted">No pattern data yet.</p>
          ) : (
            <>
              <p className="text-sm text-text-secondary">{patterns.declinedCount} declines logged</p>
              <ul className="space-y-1 text-xs text-text-muted">
                {patterns.flagsByCriterion
                  .filter((f) => f.count > 0)
                  .map((f) => (
                    <li key={f.criterionId}>
                      {f.criterionId}: {f.count}
                    </li>
                  ))}
                {patterns.flagsByCriterion.every((f) => f.count === 0) ? (
                  <li>No recurring flags yet.</li>
                ) : null}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { CarinaEditor } from '@/components/editor';
import { UpgradeModal } from '@/components/aiva/UpgradeModal';
import { AIVA_INPUT_CLASS, readAivaError } from '@/lib/aiva-utils';
import {
  clearClientProvisionIntentCookies,
  readClientProvisionDescription,
} from '@/lib/aiva-role-provision-links';
import { cn } from '@/lib/utils';

type WizardStep = 1 | 2 | 3;

type ProvisionProposal = {
  analysis: {
    suggestedName: string;
    domain: string;
    responsibilities: string[];
    requiredTools: string[];
    requiredSkills: string[];
    communicationChannels: string[];
    complexity: string;
    recommendedTier: string;
    confidenceScore: number;
    roleTemplateId: string | null;
    roleDescription: string;
  };
  proposal: {
    roleName: string;
    domainLabel: string;
    tools: string[];
    skills: string[];
    channels: string[];
    tier: string;
    tierLabel: string;
    slotLimit: number | null;
    slotRequirement: number;
    confidenceScore: number;
    complexity: string;
    roleTemplateId: string | null;
  };
};

type BuildResult = {
  status?: string;
  workerId?: string;
  tierLabel?: string;
  checkoutUrl?: string;
  error?: string;
  currentTier?: string;
  slotLimit?: number;
};

function StepCounter({ step }: { step: WizardStep }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-text-muted" aria-live="polite">
      Step {step} of 3
    </p>
  );
}

function formatToolLabel(tool: string): string {
  return tool.replace(/-/g, ' ');
}

function formatSkillLabel(skill: string): string {
  return skill.replace(/-/g, ' ');
}

function formatChannelLabel(channel: string): string {
  if (channel === 'web_chat') return 'Web chat';
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

export function AivaProvisionWizardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<WizardStep>(1);
  const [description, setDescription] = useState('');
  const [proposal, setProposal] = useState<ProvisionProposal | null>(null);
  const [roleName, setRoleName] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [builtWorkerId, setBuiltWorkerId] = useState<string | null>(null);
  const [builtTierLabel, setBuiltTierLabel] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMeta, setUpgradeMeta] = useState({ currentTier: 'trial', slotLimit: 1 });

  useEffect(() => {
    const prefill =
      searchParams.get('description')?.trim()
      ?? readClientProvisionDescription();
    if (prefill) setDescription(prefill);
    const requestedStep = Number(searchParams.get('step'));
    if (requestedStep === 2 || requestedStep === 3) {
      setStep(requestedStep as WizardStep);
    }
    const workerId = searchParams.get('workerId')?.trim();
    if (workerId) {
      setBuiltWorkerId(workerId);
      setStep(3);
    }
  }, [searchParams]);

  async function analyseNeeds() {
    const trimmed = description.trim();
    if (trimmed.length < 12) {
      setError('Describe what you need in a bit more detail (at least 12 characters).');
      return;
    }
    setAnalysing(true);
    setError(null);
    try {
      const res = await fetch('/api/aiva/provision/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: trimmed }),
      });
      if (!res.ok) {
        setError(await readAivaError(res));
        return;
      }
      const data = (await res.json()) as ProvisionProposal;
      setProposal(data);
      setRoleName(data.proposal.roleName);
      setStep(2);
    } catch {
      setError('Could not analyse your needs. Try again.');
    } finally {
      setAnalysing(false);
    }
  }

  async function provisionWorker() {
    if (!proposal) return;
    setProvisioning(true);
    setError(null);
    try {
      const res = await fetch('/api/aiva/provision/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: proposal.analysis.roleDescription,
          roleName: roleName.trim() || proposal.proposal.roleName,
          roleDescription: proposal.analysis.roleDescription,
          analysis: {
            ...proposal.analysis,
            suggestedName: roleName.trim() || proposal.proposal.roleName,
          },
        }),
      });
      const data = (await res.json()) as BuildResult;
      if (res.status === 402) {
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
        if (data.error === 'aiva_slot_limit_reached') {
          setUpgradeMeta({
            currentTier: String(data.currentTier ?? 'trial'),
            slotLimit: Number(data.slotLimit ?? 1),
          });
          setUpgradeOpen(true);
          return;
        }
      }
      if (!res.ok) {
        setError(data.error ?? 'Provisioning failed');
        return;
      }
      setBuiltWorkerId(data.workerId ?? null);
      setBuiltTierLabel(data.tierLabel ?? proposal.proposal.tierLabel);
      clearClientProvisionIntentCookies();
      setStep(3);
    } catch {
      setError('Provisioning failed. Try again.');
    } finally {
      setProvisioning(false);
    }
  }

  return (
    <>
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="slot_limit"
        currentTier={upgradeMeta.currentTier}
        slotLimit={upgradeMeta.slotLimit}
      />

      <div className="mx-auto max-w-[90rem]">
        <div className="mb-8">
          <StepCounter step={step} />
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Create your AI worker</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Describe the role in plain English. Carina proposes tools, skills, and the right plan.
          </p>
        </div>

        {step === 1 ? (
          <div className="space-y-5 rounded-2xl border border-border bg-elevated p-6 shadow-sm">
            <div>
              <label className="text-sm font-medium text-text-primary">Describe what you need</label>
              <CarinaEditor
                value={description}
                onChange={setDescription}
                placeholder={'Example: I need someone to handle customer support emails. They should reply to common questions, escalate complex issues, and track everything in a spreadsheet.'}
                variant="compact"
                minHeight="10rem"
              />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button
              type="button"
              className="btn-primary w-full px-6 py-3 text-sm disabled:opacity-70 sm:w-auto"
              disabled={analysing}
              onClick={() => void analyseNeeds()}
            >
              {analysing ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Analysing...
                </span>
              ) : (
                'Analyse my needs'
              )}
            </button>
          </div>
        ) : null}

        {step === 2 && proposal ? (
          <div className="space-y-5 rounded-2xl border border-border bg-elevated p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">We analysed your needs</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Review the proposal, then provision your worker.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Role</p>
                <input
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className={`mt-1.5 ${AIVA_INPUT_CLASS}`}
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Domain</p>
                <p className="mt-1.5 text-sm text-text-primary">{proposal.proposal.domainLabel}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Responsibilities</p>
              <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                {proposal.analysis.responsibilities.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-accent">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Tools</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {proposal.proposal.tools.map((tool) => (
                    <span
                      key={tool}
                      className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text-secondary"
                    >
                      {formatToolLabel(tool)}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Skills</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {proposal.proposal.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text-secondary"
                    >
                      {formatSkillLabel(skill)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Channels</p>
              <p className="mt-1.5 text-sm text-text-secondary">
                {proposal.proposal.channels.map(formatChannelLabel).join(', ')}
              </p>
            </div>

            <div className="rounded-lg border border-accent/30 bg-accent-dim/40 p-4">
              <p className="text-sm font-medium text-text-primary">
                Recommended plan: {proposal.proposal.tierLabel}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-text-secondary">
                <li>
                  {proposal.proposal.slotLimit == null
                    ? 'Unlimited AI workers on this plan'
                    : `Up to ${proposal.proposal.slotLimit} AI workers`}
                </li>
                <li>Billed monthly via Stripe</li>
                <li>Scout protection included</li>
              </ul>
              <p className="mt-3 text-xs text-text-muted">
                Confidence: {Math.round(proposal.proposal.confidenceScore * 100)}%
              </p>
            </div>

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-ghost text-sm" onClick={() => setStep(1)}>
                Edit description
              </button>
              <button
                type="button"
                className={cn('btn-primary text-sm disabled:opacity-70')}
                disabled={provisioning}
                onClick={() => void provisionWorker()}
              >
                {provisioning ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Provisioning...
                  </span>
                ) : (
                  'Provision worker'
                )}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5 rounded-2xl border border-border bg-elevated p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Your AI worker is live</h2>
              <p className="mt-1 text-sm text-text-secondary">
                {roleName || proposal?.proposal.roleName || 'Your worker'} is active
                {builtTierLabel ? ` on the ${builtTierLabel} plan` : ''}.
              </p>
            </div>

            <ul className="space-y-2 text-sm text-text-secondary">
              {[
                'Workspace ready',
                'Persona configured',
                'Tools assigned (governed by Scout)',
                'Skills installed',
                'Scout protection enabled',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {builtWorkerId ? (
              <p className="text-xs text-text-muted">
                Worker ID: <span className="font-mono text-text-secondary">{builtWorkerId}</span>
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {builtWorkerId ? (
                <Link href={`/aiva/workers/${builtWorkerId}`} className="btn-primary text-sm">
                  Go to workspace
                </Link>
              ) : (
                <Link href="/aiva/workers" className="btn-primary text-sm">
                  View your Aivas
                </Link>
              )}
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => {
                  setStep(1);
                  setProposal(null);
                  setBuiltWorkerId(null);
                  setBuiltTierLabel(null);
                  setDescription('');
                  setError(null);
                }}
              >
                Create another
              </button>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => router.push('/channels')}
              >
                Invite team / connect channels
              </button>
            </div>
          </div>
        ) : null}

        <p className="mt-6 text-center text-[11px] text-text-muted">
          Prefer a template?{' '}
          <Link href="/aiva/marketplace" className="text-accent hover:underline">
            Browse the marketplace
          </Link>
          {' '}or{' '}
          <Link href="/aiva" className="text-accent hover:underline">
            return to Aiva home
          </Link>
          {' '}or{' '}
          <Link href="/aiva/hire" className="text-accent hover:underline">
            open advanced hire
          </Link>
          .
        </p>
      </div>
    </>
  );
}

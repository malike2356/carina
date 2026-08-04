'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Eye,
  RefreshCw,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AivaAvatar } from '@/components/aiva/AivaAvatar';
import { UpgradeModal } from '@/components/aiva/UpgradeModal';
import {
  listCandidateBatch,
  listRoleTemplatesForHire,
  resolveRoleTemplate,
  type AivaHireCandidate,
} from '@/lib/aiva-hire-candidates';
import { AIVA_INPUT_CLASS, readAivaError } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type HirePhase = 'role' | 'candidate' | 'confirm';

const ROLE_TEMPLATES = listRoleTemplatesForHire();

function PrimaryButton({
  children,
  disabled,
  onClick,
  className,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-default disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}

function RolePreviewModal({
  title,
  description,
  exampleQ,
  exampleA,
  onClose,
}: {
  title: string;
  description: string;
  exampleQ: string | null;
  exampleA: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-text-muted hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
        {exampleQ ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/50 p-4 text-sm">
            <p className="mb-2 text-text-muted">{exampleQ}</p>
            <p className="text-text-primary">{exampleA}</p>
          </div>
        ) : null}
        <PrimaryButton onClick={onClose} className="mt-6 w-full">
          Close
        </PrimaryButton>
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: AivaHireCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'overflow-hidden rounded-2xl border bg-card text-left transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/30',
      )}
    >
      <div className="relative flex aspect-[3/4] items-center justify-center bg-muted/60">
        <AivaAvatar name={candidate.name} square className="h-16 w-16 text-xl sm:h-20 sm:w-20 sm:text-2xl" />
        <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-2.5 py-0.5 text-[10px] font-medium text-white">
          {candidate.location}
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-primary">{candidate.name}</p>
        <p className="mt-2 text-xs leading-relaxed text-text-muted">{candidate.bio}</p>
      </div>
    </button>
  );
}

function RoleRow({
  label,
  description,
  icon: Icon,
  selected,
  onSelect,
  onPreview,
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-2xl border p-4 transition-all sm:p-5',
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/25',
      )}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" />
          <div>
            <p className="text-base font-semibold text-text-primary">{label}</p>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">{description}</p>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onPreview}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-primary/30"
      >
        <Eye className="h-3.5 w-3.5" />
        Preview
      </button>
    </div>
  );
}

export type AivaHireFlowProps = {
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  onSuccess: (workerId: string) => void;
  onCancel?: () => void;
  compact?: boolean;
  /** When true, list the full role catalog instead of the popular shortlist. */
  showAllRolesByDefault?: boolean;
};

export function AivaHireFlow({
  ownerEmail,
  ownerPhone,
  onSuccess,
  onCancel,
  compact = false,
  showAllRolesByDefault = true,
}: AivaHireFlowProps) {
  const [phase, setPhase] = useState<HirePhase>('role');
  const [templateId, setTemplateId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [candidateBatch, setCandidateBatch] = useState(0);
  const [showAllRoles, setShowAllRoles] = useState(showAllRolesByDefault);
  const [previewRoleId, setPreviewRoleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMeta, setUpgradeMeta] = useState({ currentTier: 'trial', slotLimit: 1 });

  const visibleRoles = showAllRoles
    ? ROLE_TEMPLATES
    : ROLE_TEMPLATES.filter((role) =>
        [
          'property-manager',
          'outreach-coordinator',
          'financial-analyst',
          'content-assistant',
          'calendar-manager',
          'customer-support',
        ].includes(role.templateId),
      ).slice(0, 6);
  const selectedRole = ROLE_TEMPLATES.find((role) => role.templateId === templateId) ?? null;
  const candidates = templateId ? listCandidateBatch(templateId, candidateBatch) : [];
  const selectedCandidate =
    candidates.find((candidate) => candidate.id === candidateId) ??
    (candidateId ? listCandidateBatch(templateId, 0).find((c) => c.id === candidateId) : null);
  const previewRole = previewRoleId
    ? ROLE_TEMPLATES.find((role) => role.templateId === previewRoleId)
    : null;

  function selectRole(id: string) {
    setTemplateId(id);
    setCandidateBatch(0);
    setCandidateId('');
    const firstBatch = listCandidateBatch(id, 0);
    if (firstBatch[0]) setWorkerName(firstBatch[0].name);
    setPhase('candidate');
    setError('');
  }

  function selectCandidate(candidate: AivaHireCandidate) {
    setCandidateId(candidate.id);
    setWorkerName(candidate.name);
  }

  function buildChannelBindings() {
    const bindings: Array<{ channel: string; identifier: string }> = [];
    const email = ownerEmail?.trim();
    if (email) bindings.push({ channel: 'email', identifier: email });
    const phone = ownerPhone?.trim() ?? sessionStorage.getItem('aiva.onboarding.phone')?.trim();
    if (phone) bindings.push({ channel: 'whatsapp', identifier: phone });
    return bindings;
  }

  async function hireWorker() {
    if (!templateId || !workerName.trim() || submitting) return;
    const template = resolveRoleTemplate(templateId);
    if (!template) return;

    setSubmitting(true);
    setError('');

    const defaultChannel = template.defaultChannels[0] ?? 'email';
    const channelBindings = buildChannelBindings();

    try {
      const res = await fetch('/api/aiva/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workerName.trim(),
          roleName: workerName.trim(),
          roleDescription: template.roleDescription,
          templateId,
          roleTemplate: templateId,
          channels: template.defaultChannels.length > 0 ? template.defaultChannels : [defaultChannel],
          channelBindings,
          language: 'en-GB',
        }),
      });

      if (!res.ok) {
        if (res.status === 402) {
          const body = (await res.json()) as {
            error?: string;
            currentTier?: string;
            slotLimit?: number;
          };
          if (body.error === 'aiva_slot_limit_reached') {
            setUpgradeMeta({
              currentTier: String(body.currentTier ?? 'trial'),
              slotLimit: Number(body.slotLimit ?? 1),
            });
            setUpgradeOpen(true);
            return;
          }
        }
        setError(await readAivaError(res));
        return;
      }

      const data = (await res.json()) as { worker?: { id: string } };
      if (!data.worker?.id) {
        setError('Worker created but no id returned');
        return;
      }

      void fetch('/api/onboarding/welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: data.worker.id,
          templateId,
          channelId: defaultChannel,
        }),
      }).catch(() => {});

      onSuccess(data.worker.id);
    } catch {
      setError('Could not hire worker. Try again.');
    } finally {
      setSubmitting(false);
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

      <div className={cn('space-y-6', compact && 'space-y-5')}>
        {phase === 'role' ? (
          <>
            <div>
              <h2 className={cn('font-semibold text-text-primary', compact ? 'text-xl' : 'text-2xl')}>
                Who do you want to hire?
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Pick a role, then choose the candidate who feels right.
              </p>
            </div>
            <div
              className={cn(
                'space-y-3 pr-1',
                // Drawer already scrolls; avoid a second clipped list that cuts cards mid-row.
                !compact
                  && 'max-h-[min(70vh,40rem)] overflow-y-auto overscroll-contain scrollbar-gutter-stable',
              )}
            >
              {visibleRoles.map((role) => (
                <RoleRow
                  key={role.templateId}
                  label={role.label}
                  description={role.description}
                  icon={role.icon}
                  selected={templateId === role.templateId}
                  onSelect={() => selectRole(role.templateId)}
                  onPreview={() => setPreviewRoleId(role.templateId)}
                />
              ))}
            </div>
            {ROLE_TEMPLATES.length > 6 ? (
              <button
                type="button"
                onClick={() => setShowAllRoles((value) => !value)}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium text-text-secondary hover:border-primary/30"
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', showAllRoles && 'rotate-180')} />
                {showAllRoles
                  ? 'Show popular roles only'
                  : `Show all ${ROLE_TEMPLATES.length} roles`}
              </button>
            ) : null}
            {onCancel ? (
              <button type="button" onClick={onCancel} className="text-sm text-text-muted hover:text-text-primary">
                Cancel
              </button>
            ) : null}
          </>
        ) : null}

        {phase === 'candidate' && selectedRole ? (
          <>
            <div>
              <h2 className={cn('font-semibold text-text-primary', compact ? 'text-xl' : 'text-2xl')}>
                Select your candidate
              </h2>
              <p className="mt-1 text-sm text-text-muted">{selectedRole.label}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  selected={candidateId === candidate.id}
                  onSelect={() => selectCandidate(candidate)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setCandidateBatch((value) => value + 1);
                setCandidateId('');
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium text-text-secondary hover:border-primary/30"
            >
              <RefreshCw className="h-4 w-4" />
              Show more candidates
            </button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setPhase('role')}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-text-secondary"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <PrimaryButton
                className="sm:max-w-xs"
                disabled={!candidateId}
                onClick={() => setPhase('confirm')}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            </div>
          </>
        ) : null}

        {phase === 'confirm' && selectedRole && selectedCandidate ? (
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <AivaAvatar name={workerName} square className="mb-5 h-24 w-24 rounded-2xl text-3xl" />
            <h2 className="text-2xl font-semibold text-text-primary">Meet {workerName.split(' ')[0]}</h2>
            <p className="mt-1 text-sm text-text-muted">{selectedRole.label}</p>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">{selectedCandidate.bio}</p>
            <label htmlFor="hire-worker-name" className="mt-5 w-full text-left text-xs font-medium text-text-primary">
              Name (optional tweak)
            </label>
            <input
              id="hire-worker-name"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              className={cn(AIVA_INPUT_CLASS, 'mt-1.5')}
            />
            <p className="mt-3 text-xs text-text-muted">
              {ownerEmail
                ? `${workerName.split(' ')[0]} can email you at ${ownerEmail} after hire.`
                : 'Connect channels from worker settings after hire.'}
            </p>
            {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
            <div className="mt-6 flex w-full flex-col gap-3">
              <PrimaryButton disabled={submitting || workerName.trim().length < 2} onClick={() => void hireWorker()}>
                {submitting ? 'Hiring...' : `Hire ${workerName.split(' ')[0]}`}
                <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
              <button
                type="button"
                onClick={() => setPhase('candidate')}
                className="text-sm text-text-muted hover:text-text-primary"
              >
                Choose a different candidate
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {previewRole ? (
        <RolePreviewModal
          title={previewRole.label}
          description={previewRole.roleDescription}
          exampleQ={previewRole.exampleQ}
          exampleA={previewRole.exampleA}
          onClose={() => setPreviewRoleId(null)}
        />
      ) : null}
    </>
  );
}

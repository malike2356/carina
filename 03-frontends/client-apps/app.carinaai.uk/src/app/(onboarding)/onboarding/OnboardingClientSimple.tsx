'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  Mail,
  Send,
  Smartphone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BrandMark } from '@/components/shell/BrandMark';
import { AivaHostedEmailCard } from '@/components/aiva/AivaHostedEmailCard';
import {
  listCandidateBatch,
  listRoleTemplatesForHire,
} from '@/lib/aiva-hire-candidates';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type WizardStep = 1 | 2 | 3 | 4;

const ROLE_TEMPLATES = listRoleTemplatesForHire();

const CHANNEL_OPTIONS: Array<{
  id: string;
  label: string;
  note: string;
  icon: LucideIcon;
  identifierField?: {
    label: string;
    placeholder: string;
    type: 'tel' | 'email' | 'text';
    optional?: boolean;
  };
}> = [
  {
    id: 'web',
    label: 'Web chat',
    note: 'Talk in your Aiva dashboard. Ready straight away; no setup needed.',
    icon: Globe,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    note: 'Easiest live channel right now. Paste a BotFather token and we connect the bot immediately.',
    icon: Send,
    identifierField: {
      label: 'BotFather token (connects Telegram now)',
      placeholder: '1234567890:AAF...',
      type: 'text',
      optional: true,
    },
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    note: 'Marks WhatsApp as your preference. Full Business setup happens after onboarding.',
    icon: Smartphone,
    identifierField: {
      label: 'Your number for a welcome message (optional)',
      placeholder: '+44 7700 900000',
      type: 'tel',
      optional: true,
    },
  },
  {
    id: 'email',
    label: 'Email',
    note: 'Your Aiva gets a hosted inbox. Connect your own mailbox after setup if you want.',
    icon: Mail,
    identifierField: {
      label: 'Your email for a welcome message (optional)',
      placeholder: 'you@yourcompany.com',
      type: 'email',
      optional: true,
    },
  },
];

function StepCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-elevated p-8 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 shrink-0">
      <h1 className="mb-1.5 text-xl font-semibold text-text-primary">{title}</h1>
      {subtitle ? <p className="text-sm text-text-muted">{subtitle}</p> : null}
    </div>
  );
}

function StepCounter({ step }: { step: WizardStep }) {
  if (step === 4) {
    return (
      <p className="mb-6 text-center text-xs text-text-muted" aria-live="polite">
        You are ready
      </p>
    );
  }
  return (
    <p className="mb-6 text-center text-xs text-text-muted" aria-live="polite">
      Step {step} of 3
    </p>
  );
}

export function OnboardingClientSimple() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [templateId, setTemplateId] = useState('');
  const [aivaName, setAivaName] = useState('');
  const [channelId, setChannelId] = useState('web');
  const [channelIdentifier, setChannelIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [hiredWorkerId, setHiredWorkerId] = useState('');
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  function selectTemplate(id: string) {
    setTemplateId(id);
    const candidate = listCandidateBatch(id, 0)[0];
    if (candidate) setAivaName(candidate.name.split(/\s+/)[0] ?? candidate.name);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => setStep(2), 250);
  }

  function continueToChannels() {
    const trimmed = aivaName.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return;
    setStep(3);
  }

  const selectedChannel = CHANNEL_OPTIONS.find((c) => c.id === channelId);
  const selectedTemplate = ROLE_TEMPLATES.find((t) => t.templateId === templateId);
  const nameValid = aivaName.trim().length >= 2 && aivaName.trim().length <= 50;
  const identifierRequired = Boolean(
    selectedChannel?.identifierField && !selectedChannel.identifierField.optional,
  );
  const identifierValid = !identifierRequired || channelIdentifier.trim().length > 0;
  const canHire = nameValid && templateId && channelId && identifierValid && !submitting;

  async function hireAiva() {
    if (!canHire) return;
    const template = selectedTemplate;
    if (!template) return;

    setSubmitting(true);
    setSubmitError('');

    const trimmedName = aivaName.trim();
    const identifier = channelIdentifier.trim();
    const channelBindings =
      channelId !== 'web' && identifier
        ? [{ channel: channelId, identifier }]
        : [];

    const body = {
      name: trimmedName,
      roleName: trimmedName,
      roleDescription: template.roleDescription,
      templateId,
      roleTemplate: templateId,
      channels: [channelId],
      channelBindings,
      language: 'en-GB',
    };

    try {
      const res = await fetch('/api/aiva/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { worker?: { id: string }; error?: string; message?: string };
      if (!res.ok || !data.worker) {
        setSubmitError(data.error ?? data.message ?? 'Could not set up your Aiva. Try again.');
        return;
      }

      await fetch('/api/workspace/onboarding-complete', { method: 'PATCH' }).catch(() => {});
      setHiredWorkerId(data.worker.id);
      setStep(4);
    } catch {
      setSubmitError('Could not set up your Aiva. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-base text-text-primary">
      <header className="flex h-14 shrink-0 items-center border-b border-border px-6">
        <BrandMark nameClassName="text-sm font-semibold text-text-primary" size={28} />
      </header>
      <main className="flex flex-1 flex-col items-center px-4 py-10">
        <div className="flex w-full max-w-2xl flex-1 flex-col">
          <StepCounter step={step} />

          {step === 1 ? (
            <StepCard className="flex max-h-[min(70vh,40rem)] flex-col overflow-hidden p-6 sm:p-8">
              <StepHeading
                title="What will your Aiva help with?"
                subtitle={`Browse all ${ROLE_TEMPLATES.length} roles. Pick the one that fits best. You can adjust this later.`}
              />
              <div
                className="-mx-1 flex-1 overflow-y-auto overscroll-contain px-1 pb-1 scrollbar-gutter-stable"
                role="listbox"
                aria-label="Aiva role templates"
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {ROLE_TEMPLATES.map((template) => {
                    const selected = templateId === template.templateId;
                    const Icon = template.icon;
                    return (
                      <button
                        key={template.templateId}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => selectTemplate(template.templateId)}
                        className={cn(
                          'min-h-[88px] rounded-xl border p-4 text-left transition-all',
                          selected
                            ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]'
                            : 'border-border bg-base hover:border-accent/40 hover:bg-elevated',
                        )}
                      >
                        <Icon
                          className={cn(
                            'mb-2.5 h-5 w-5',
                            selected ? 'text-amber-400' : 'text-text-muted',
                          )}
                        />
                        <p
                          className={cn(
                            'text-sm font-medium',
                            selected ? 'text-text-primary' : 'text-text-secondary',
                          )}
                        >
                          {template.label}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-muted">
                          {template.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </StepCard>
          ) : null}

          {step === 2 ? (
            <StepCard>
              <StepHeading title="What should we call them?" />
              {selectedTemplate ? (
                <p className="mb-4 text-xs text-text-muted">
                  Role:{' '}
                  <span className="font-medium text-text-secondary">
                    {selectedTemplate.label}
                  </span>
                  . Give your Aiva a personal name; the role stays as their job title.
                </p>
              ) : null}
              <label htmlFor="aiva-name" className="mb-1.5 block text-xs font-medium text-text-primary">
                Name
              </label>
              <input
                id="aiva-name"
                type="text"
                value={aivaName}
                onChange={(e) => setAivaName(e.target.value)}
                minLength={2}
                maxLength={50}
                placeholder="Aria"
                className={cn(AIVA_INPUT_CLASS, 'mb-2')}
                autoFocus
              />
              {aivaName.trim().length > 0 && !nameValid ? (
                <p className="mb-4 text-xs text-danger">Use 2 to 50 characters.</p>
              ) : (
                <p className="mb-4 text-xs text-text-muted">You can change this later.</p>
              )}
              <button
                type="button"
                onClick={continueToChannels}
                disabled={!nameValid}
                className="btn-primary min-h-12 w-full rounded-xl py-3 text-base font-semibold disabled:cursor-default disabled:opacity-45"
              >
                Continue
              </button>
            </StepCard>
          ) : null}

          {step === 3 ? (
            <StepCard>
              <StepHeading
                title="How would you like to talk to your Aiva?"
                subtitle="Pick one to start. Slack, Discord, and more channels are waiting after you finish setup."
              />
              <div className="space-y-2">
                {CHANNEL_OPTIONS.map((channel) => {
                  const selected = channelId === channel.id;
                  const Icon = channel.icon;
                  return (
                    <div
                      key={channel.id}
                      className={cn(
                        'overflow-hidden rounded-xl border transition-all',
                        selected
                          ? 'border-amber-400 bg-amber-500/5'
                          : 'border-border bg-base hover:border-accent/30',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setChannelId(channel.id);
                          setChannelIdentifier('');
                          setSubmitError('');
                        }}
                        className="flex min-h-20 w-full cursor-pointer items-start gap-3 p-4 text-left"
                      >
                        <Icon
                          className={cn(
                            'mt-0.5 h-5 w-5 shrink-0',
                            selected ? 'text-amber-400' : 'text-text-muted',
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'text-sm font-medium',
                              selected ? 'text-text-primary' : 'text-text-secondary',
                            )}
                          >
                            {channel.label}
                          </p>
                          <p className="text-[11px] text-text-muted">{channel.note}</p>
                        </div>
                      </button>
                      {selected && channel.identifierField ? (
                        <div className="border-t border-border/50 px-4 pb-4 pt-3">
                          <label className="mb-1.5 block text-xs font-medium text-text-primary">
                            {channel.identifierField.label}
                          </label>
                          <input
                            type={channel.identifierField.type}
                            value={channelIdentifier}
                            onChange={(e) => setChannelIdentifier(e.target.value)}
                            placeholder={channel.identifierField.placeholder}
                            className={AIVA_INPUT_CLASS}
                          />
                          {channel.identifierField.optional ? (
                            <p className="mt-1.5 text-[11px] text-text-muted">
                              {channel.id === 'telegram'
                                ? 'Leave blank to connect Telegram after you finish setup.'
                                : 'Optional. You can skip this and finish channel setup after hire.'}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {submitError ? <p className="mt-4 text-sm text-danger">{submitError}</p> : null}
              <button
                type="button"
                onClick={() => void hireAiva()}
                disabled={!canHire}
                className="btn-primary mt-6 min-h-12 w-full rounded-xl px-4 py-3 text-base font-semibold disabled:cursor-default disabled:opacity-45"
              >
                {submitting ? 'Setting up...' : 'Hire your Aiva'}
              </button>
            </StepCard>
          ) : null}

          {step === 4 && hiredWorkerId ? (
            <StepCard>
              <StepHeading
                title={`${aivaName.trim() || 'Your Aiva'} is ready`}
                subtitle="Email is already live. Send a message to this address and your Aiva can reply."
              />
              <AivaHostedEmailCard
                workerId={hiredWorkerId}
                workerName={aivaName.trim() || undefined}
                emphasize
                className="mb-6"
              />
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/aiva/workers/${hiredWorkerId}`)}
                  className="btn-primary min-h-12 w-full rounded-xl py-3 text-base font-semibold"
                >
                  Open {aivaName.trim() || 'your Aiva'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="w-full py-2 text-center text-sm text-text-muted transition-colors hover:text-text-primary"
                >
                  Go to dashboard
                </button>
              </div>
            </StepCard>
          ) : null}
        </div>
      </main>
    </div>
  );
}

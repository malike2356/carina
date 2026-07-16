'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Globe,
  Hash,
  Headphones,
  Mail,
  PenLine,
  Send,
  Settings2,
  Smartphone,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BrandMark } from '@/components/shell/BrandMark';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type WizardStep = 1 | 2 | 3;

const ROLE_TEMPLATES: Array<{
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultName: string;
}> = [
  {
    id: 'customer-support',
    label: 'Customer Support',
    description: 'Answers enquiries around the clock',
    icon: Headphones,
    defaultName: 'Aria',
  },
  {
    id: 'outreach-coordinator',
    label: 'Outreach',
    description: 'Qualifies leads and books calls',
    icon: Send,
    defaultName: 'Alex',
  },
  {
    id: 'property-manager',
    label: 'Property',
    description: 'Handles tenant and landlord queries',
    icon: Building2,
    defaultName: 'Mia',
  },
  {
    id: 'financial-analyst',
    label: 'Finance',
    description: 'Answers accounts and finance queries',
    icon: TrendingUp,
    defaultName: 'Sam',
  },
  {
    id: 'content-assistant',
    label: 'Content',
    description: 'Drafts copy and handles requests',
    icon: PenLine,
    defaultName: 'Leo',
  },
  {
    id: 'calendar-manager',
    label: 'Operations',
    description: 'Tracks tasks and coordinates teams',
    icon: Settings2,
    defaultName: 'Dana',
  },
];

const CHANNEL_OPTIONS: Array<{
  id: string;
  label: string;
  note: string;
  icon: LucideIcon;
  identifierField?: {
    label: string;
    placeholder: string;
    type: 'tel' | 'email' | 'text';
  };
}> = [
  {
    id: 'web',
    label: 'Web chat',
    note: 'We add a chat widget to your website',
    icon: Globe,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    note: 'Connect your WhatsApp Business number',
    icon: Smartphone,
    identifierField: {
      label: 'Your WhatsApp Business number',
      placeholder: '+44 7700 900000',
      type: 'tel',
    },
  },
  {
    id: 'email',
    label: 'Email',
    note: 'Use your existing business inbox',
    icon: Mail,
    identifierField: {
      label: 'Your business email address',
      placeholder: 'support@yourcompany.com',
      type: 'email',
    },
  },
  {
    id: 'slack',
    label: 'Slack',
    note: 'Deploy inside your Slack workspace',
    icon: Hash,
    identifierField: {
      label: 'Your Slack workspace URL',
      placeholder: 'yourcompany.slack.com',
      type: 'text',
    },
  },
];

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-elevated p-8 shadow-sm">{children}</div>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="mb-1.5 text-xl font-semibold text-text-primary">{title}</h1>
      {subtitle ? <p className="text-sm text-text-muted">{subtitle}</p> : null}
    </div>
  );
}

function StepCounter({ step }: { step: WizardStep }) {
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
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  function selectTemplate(id: string) {
    setTemplateId(id);
    const template = ROLE_TEMPLATES.find((t) => t.id === id);
    if (template) setAivaName(template.defaultName);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => setStep(2), 250);
  }

  function continueToChannels() {
    const trimmed = aivaName.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return;
    setStep(3);
  }

  const selectedChannel = CHANNEL_OPTIONS.find((c) => c.id === channelId);
  const nameValid = aivaName.trim().length >= 2 && aivaName.trim().length <= 50;
  const identifierRequired = Boolean(selectedChannel?.identifierField);
  const identifierValid = !identifierRequired || channelIdentifier.trim().length > 0;
  const canHire = nameValid && templateId && channelId && identifierValid && !submitting;

  async function hireAiva() {
    if (!canHire) return;
    const template = ROLE_TEMPLATES.find((t) => t.id === templateId);
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
      roleDescription: template.description,
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
      router.push('/dashboard');
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
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <StepCounter step={step} />

          {step === 1 ? (
            <StepCard>
              <StepHeading
                title="What will your Aiva help with?"
                subtitle="Pick the one that fits best. You can adjust this later."
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ROLE_TEMPLATES.map((template) => {
                  const selected = templateId === template.id;
                  const Icon = template.icon;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => selectTemplate(template.id)}
                      className={cn(
                        'min-h-[80px] rounded-xl border p-4 text-left transition-all',
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
                      <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
                        {template.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </StepCard>
          ) : null}

          {step === 2 ? (
            <StepCard>
              <StepHeading title="What should we call them?" />
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
                className="btn-primary w-full py-3 text-sm font-medium disabled:cursor-default disabled:opacity-40"
              >
                Continue
              </button>
            </StepCard>
          ) : null}

          {step === 3 ? (
            <StepCard>
              <StepHeading
                title="How will customers contact them?"
                subtitle="Pick one to start. You can connect more channels after setup."
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
                        className="flex min-h-[80px] w-full cursor-pointer items-start gap-3 p-4 text-left"
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
                className="btn-primary mt-6 w-full py-3 text-sm font-medium disabled:cursor-default disabled:opacity-40"
              >
                {submitting ? 'Setting up...' : 'Hire your Aiva'}
              </button>
            </StepCard>
          ) : null}
        </div>
      </main>
    </div>
  );
}

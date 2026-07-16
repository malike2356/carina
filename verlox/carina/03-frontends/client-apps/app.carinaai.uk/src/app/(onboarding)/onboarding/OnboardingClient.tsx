'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  Globe,
  Hash,
  Headphones,
  Mail,
  PenLine,
  RefreshCw,
  Send,
  Settings2,
  Smartphone,
  TrendingUp,
} from 'lucide-react';
import { ChannelIcon } from '@/components/aiva/ChannelIcon';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { CarinaEditor } from '@/components/editor';
import { useOnboardingStep } from '@/lib/onboarding-context';
import { cn } from '@/lib/utils';

const SECTORS = [
  { value: 'property', label: 'Property management' },
  { value: 'finance', label: 'Finance and accounting' },
  { value: 'legal', label: 'Legal and compliance' },
  { value: 'sales', label: 'Sales and outreach' },
  { value: 'content', label: 'Content and marketing' },
  { value: 'operations', label: 'Operations' },
  { value: 'customer-support', label: 'Customer support' },
  { value: 'other', label: 'Other' },
];

const SECTOR_TO_TEMPLATE: Record<string, string> = {
  property: 'property-manager',
  finance: 'financial-analyst',
  sales: 'outreach-coordinator',
  content: 'content-assistant',
  operations: 'calendar-manager',
  'customer-support': 'customer-support',
};

const ROLE_TEMPLATES = [
  {
    id: 'customer-support',
    label: 'Customer Support',
    icon: Headphones,
    description: 'Answers enquiries around the clock',
  },
  {
    id: 'outreach-coordinator',
    label: 'Outreach Coordinator',
    icon: Send,
    description: 'Qualifies leads and books calls',
  },
  {
    id: 'property-manager',
    label: 'Property Manager',
    icon: Building2,
    description: 'Handles tenant and landlord queries',
  },
  {
    id: 'financial-analyst',
    label: 'Financial Analyst',
    icon: TrendingUp,
    description: 'Answers finance and accounts queries',
  },
  {
    id: 'content-assistant',
    label: 'Content Assistant',
    icon: PenLine,
    description: 'Drafts copy and manages requests',
  },
  {
    id: 'calendar-manager',
    label: 'Operations',
    icon: Settings2,
    description: 'Tracks tasks and coordinates teams',
  },
];

const CHANNEL_OPTIONS = [
  {
    id: 'web',
    label: 'Web chat',
    icon: Globe,
    description: 'Add a chat widget to your website. No identifier needed.',
    identifierField: null as null,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: Smartphone,
    description: 'Connect your WhatsApp Business account.',
    identifierField: {
      label: 'WhatsApp business number',
      placeholder: '+44 7700 900000',
      type: 'tel' as const,
    },
  },
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    description: 'Handle emails from your business inbox.',
    identifierField: {
      label: 'Business email address',
      placeholder: 'support@yourcompany.com',
      type: 'email' as const,
    },
  },
  {
    id: 'slack',
    label: 'Slack',
    icon: Hash,
    description: 'Deploy your Aiva to a Slack workspace.',
    identifierField: {
      label: 'Slack workspace URL',
      placeholder: 'yourcompany.slack.com',
      type: 'text' as const,
    },
  },
  {
    id: 'telegram',
    label: 'Telegram',
    icon: Send,
    description: 'Connect a Telegram bot.',
    identifierField: {
      label: 'Telegram bot token',
      placeholder: '1234567890:AAF...',
      type: 'text' as const,
    },
  },
];

const ROLE_SUGGESTIONS: Record<string, string[]> = {
  'customer-support': ['Aria', 'Nova', 'Maya', 'Lena', 'Kai', 'Sam', 'Finn', 'Jules', 'Blair', 'Sage', 'Alex', 'River'],
  'outreach-coordinator': ['Quinn', 'Blake', 'Harley', 'Logan', 'Scout', 'Ellis', 'Wren', 'Parker', 'Reese', 'Tyler', 'Skye', 'Cruz'],
  'property-manager': ['Alex', 'Jordan', 'Sam', 'Morgan', 'Riley', 'Taylor', 'Casey', 'Drew', 'Avery', 'Jamie', 'Blair', 'Robin'],
  'financial-analyst': ['Morgan', 'Blake', 'Cameron', 'Finley', 'Kendall', 'Reese', 'Sydney', 'Tatum', 'Harley', 'Wren', 'Lane', 'Vale'],
  'content-assistant': ['Sage', 'Ren', 'Sol', 'Lyric', 'Story', 'Wren', 'Nova', 'Cleo', 'Rue', 'Bay', 'Fern', 'Pax'],
  'calendar-manager': ['Ridge', 'Crew', 'Scout', 'Ace', 'Arrow', 'Blaze', 'Chase', 'Dash', 'Fox', 'Rook', 'Colt', 'Flint'],
  default: ['Aria', 'Nova', 'Sage', 'Quinn', 'Blake', 'River', 'Ellis', 'Finn', 'Logan', 'Wren', 'Scout', 'Sol'],
};

const SETUP_LABELS = [
  { text: 'Building persona...', delay: 500 },
  { text: 'Loading skills...', delay: 1050 },
  { text: 'Setting up channels...', delay: 1600 },
  { text: 'Almost ready...', delay: 2100 },
];

type ChannelSelection = { id: string; identifier: string };

interface WizardState {
  businessName: string;
  sector: string;
  templateId: string;
  customMode: boolean;
  customDescription: string;
  aivaName: string;
  channels: ChannelSelection[];
}

interface CreatedWorker {
  id: string;
  name: string;
  roleDescription: string;
  channels: string[];
}

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

function ContinueButton({
  onClick,
  disabled,
  label = 'Continue',
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-primary mt-8 w-full py-3 text-sm font-medium disabled:cursor-default disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function SetupSpinner() {
  return (
    <div className="relative mb-6 h-16 w-16">
      <div className="absolute inset-0 rounded-full border-2 border-border" />
      <div className="absolute inset-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

export function OnboardingClient() {
  const { step, setStep } = useOnboardingStep();
  const [wizard, setWizard] = useState<WizardState>({
    businessName: '',
    sector: '',
    templateId: '',
    customMode: false,
    customDescription: '',
    aivaName: '',
    channels: [],
  });
  const [channelError, setChannelError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [createdWorker, setCreatedWorker] = useState<CreatedWorker | null>(null);
  const [namePage, setNamePage] = useState(0);
  const [visibleSetupLabels, setVisibleSetupLabels] = useState<Set<number>>(new Set());
  const [retrying, setRetrying] = useState(false);
  const hireStarted = useRef(false);

  useEffect(() => {
    if (wizard.sector && !wizard.templateId && !wizard.customMode) {
      const match = SECTOR_TO_TEMPLATE[wizard.sector];
      if (match) setWizard((w) => ({ ...w, templateId: match }));
    }
  }, [wizard.sector, wizard.templateId, wizard.customMode]);

  const roleDescription = useMemo(() => {
    if (wizard.customMode) return wizard.customDescription.trim();
    const template = ROLE_TEMPLATES.find((t) => t.id === wizard.templateId);
    return template?.description ?? '';
  }, [wizard.customMode, wizard.customDescription, wizard.templateId]);

  const roleLabel = useMemo(() => {
    if (wizard.customMode) return wizard.customDescription.trim();
    const template = ROLE_TEMPLATES.find((t) => t.id === wizard.templateId);
    return template?.label ?? 'your Aiva role';
  }, [wizard.customMode, wizard.customDescription, wizard.templateId]);

  async function hireWorker() {
    setSetupError('');
    setRetrying(false);
    const started = Date.now();

    const channelIds = wizard.channels.map((c) => c.id);
    const channelBindings = wizard.channels
      .filter((c) => c.id !== 'web' && c.identifier.trim())
      .map((c) => ({ channel: c.id, identifier: c.identifier.trim() }));

    const body = {
      roleName: wizard.aivaName.trim(),
      roleDescription,
      templateId: wizard.customMode ? null : wizard.templateId || null,
      channels: channelIds.length > 0 ? channelIds : ['web'],
      channelBindings,
      language: 'en-GB',
    };

    try {
      const res = await fetch('/api/aiva/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { worker?: CreatedWorker; error?: string };
      if (!res.ok || !data.worker) {
        setSetupError(data.error ?? 'Something went wrong setting up your Aiva.');
        return;
      }

      const elapsed = Date.now() - started;
      await new Promise((r) => setTimeout(r, Math.max(0, 2500 - elapsed)));

      setCreatedWorker({
        id: data.worker.id,
        name: data.worker.name,
        roleDescription: data.worker.roleDescription ?? roleDescription,
        channels: data.worker.channels ?? channelIds,
      });
      setStep(6);
    } catch {
      setSetupError('Something went wrong setting up your Aiva.');
    }
  }

  useEffect(() => {
    if (step === 5 && !hireStarted.current) {
      hireStarted.current = true;
      void hireWorker();
    }
  }, [step]);

  useEffect(() => {
    if (step === 6) {
      void fetch('/api/workspace/onboarding-complete', { method: 'PATCH' }).catch(() => {});
    }
  }, [step]);

  useEffect(() => {
    if (step !== 5 || setupError) return;
    setVisibleSetupLabels(new Set());
    const timers = SETUP_LABELS.map((label, index) =>
      window.setTimeout(() => {
        setVisibleSetupLabels((prev) => new Set([...prev, index]));
      }, label.delay),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [step, setupError]);

  const suggestionList =
    ROLE_SUGGESTIONS[wizard.templateId] ?? ROLE_SUGGESTIONS.default;
  const visibleNames = suggestionList.slice(namePage * 4, namePage * 4 + 4);

  function rotateNames() {
    const nextPage = namePage * 4 + 4 >= suggestionList.length ? 0 : namePage + 1;
    setNamePage(nextPage);
  }

  function retryHire() {
    setRetrying(true);
    void hireWorker().finally(() => setRetrying(false));
  }

  return (
    <>
      {step === 1 ? (
        <StepCard>
          <StepHeading
            title="Tell us about your business"
            subtitle="We use this to suggest the right Aiva for you."
          />
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-primary">Business name</label>
              <input
                type="text"
                value={wizard.businessName}
                onChange={(e) => setWizard({ ...wizard, businessName: e.target.value })}
                placeholder="e.g. Greenfield Properties"
                className={AIVA_INPUT_CLASS}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-primary">Your sector</label>
              <div className="relative">
                <select
                  value={wizard.sector}
                  aria-label="Your sector"
                  onChange={(e) => setWizard({ ...wizard, sector: e.target.value })}
                  className={cn(AIVA_INPUT_CLASS, 'appearance-none pr-10')}
                >
                  <option value="">Select your sector</option>
                  {SECTORS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              </div>
            </div>
          </div>
          <ContinueButton
            onClick={() => setStep(2)}
            disabled={!wizard.businessName.trim() || !wizard.sector}
          />
        </StepCard>
      ) : null}

      {step === 2 ? (
        <StepCard>
          <StepHeading
            title="What do you need your Aiva to handle?"
            subtitle="Pick a starting point. You can change this at any time."
          />
          {!wizard.customMode ? (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ROLE_TEMPLATES.map((template) => {
                const selected = wizard.templateId === template.id;
                const Icon = template.icon;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() =>
                      setWizard({ ...wizard, templateId: template.id, customDescription: '' })
                    }
                    className={cn(
                      'rounded-xl border p-4 text-left transition-all',
                      selected
                        ? 'border-accent bg-accent-dim shadow-[0_0_0_1px_rgba(26,95,122,0.15)]'
                        : 'border-border bg-base hover:border-accent/40 hover:bg-elevated',
                    )}
                  >
                    <Icon
                      className={cn('mb-2.5 h-5 w-5', selected ? 'text-accent' : 'text-text-muted')}
                    />
                    <p
                      className={cn(
                        'mb-0.5 text-sm font-medium',
                        selected ? 'text-accent' : 'text-text-primary',
                      )}
                    >
                      {template.label}
                    </p>
                    <p className="text-[11px] leading-tight text-text-muted">{template.description}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <CarinaEditor
              value={wizard.customDescription}
              onChange={(customDescription) =>
                setWizard({ ...wizard, customDescription, templateId: '' })
              }
              placeholder="Describe what you need your Aiva to handle..."
              variant="compact"
              minHeight="6rem"
              className="mb-2"
            />
          )}
          <button
            type="button"
            onClick={() =>
              setWizard({
                ...wizard,
                customMode: !wizard.customMode,
                templateId: wizard.customMode ? wizard.templateId : '',
              })
            }
            className="mb-3 flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary"
          >
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', wizard.customMode && 'rotate-180')}
            />
            {wizard.customMode
              ? 'Choose from templates instead'
              : 'I need something different - describe it myself'}
          </button>
          <ContinueButton
            onClick={() => setStep(3)}
            disabled={wizard.customMode ? !wizard.customDescription.trim() : !wizard.templateId}
          />
        </StepCard>
      ) : null}

      {step === 3 ? (
        <StepCard>
          <StepHeading
            title="What should we call your Aiva?"
            subtitle="This is the name your clients will see. Use a first name that fits your brand."
          />
          <input
            type="text"
            value={wizard.aivaName}
            onChange={(e) => setWizard({ ...wizard, aivaName: e.target.value })}
            placeholder="e.g. Aria"
            maxLength={30}
            autoFocus
            className={cn(
              AIVA_INPUT_CLASS,
              'mb-4 rounded-xl py-4 text-center text-2xl font-medium',
            )}
          />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] text-text-muted">Suggested:</p>
              <button
                type="button"
                onClick={rotateNames}
                className="flex items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-text-primary"
              >
                <RefreshCw className="h-3 w-3" />
                More
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setWizard({ ...wizard, aivaName: name })}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    wizard.aivaName === name
                      ? 'border-accent bg-accent-dim text-accent'
                      : 'border-border bg-elevated text-text-secondary hover:border-accent/40 hover:text-text-primary',
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <ContinueButton onClick={() => setStep(4)} disabled={!wizard.aivaName.trim()} />
        </StepCard>
      ) : null}

      {step === 4 ? (
        <StepCard>
          <StepHeading
            title="How do your clients reach you?"
            subtitle="Your Aiva will be available on the channels you connect. You can add more later."
          />
          <div className="space-y-2">
            {CHANNEL_OPTIONS.map((ch) => {
              const selected = wizard.channels.some((c) => c.id === ch.id);
              const Icon = ch.icon;
              return (
                <div
                  key={ch.id}
                  className={cn(
                    'overflow-hidden rounded-xl border transition-all',
                    selected ? 'border-accent bg-elevated' : 'border-border bg-base hover:border-accent/30',
                  )}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setChannelError('');
                        setWizard((w) => ({
                          ...w,
                          channels: selected
                            ? w.channels.filter((c) => c.id !== ch.id)
                            : [...w.channels, { id: ch.id, identifier: '' }],
                        }));
                      }
                    }}
                    onClick={() => {
                      setChannelError('');
                      setWizard((w) => ({
                        ...w,
                        channels: selected
                          ? w.channels.filter((c) => c.id !== ch.id)
                          : [...w.channels, { id: ch.id, identifier: '' }],
                      }));
                    }}
                    className="flex cursor-pointer items-start gap-3 p-4"
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        selected ? 'border-accent bg-accent' : 'border-border',
                      )}
                    >
                      {selected ? <Check className="h-2.5 w-2.5 text-white" /> : null}
                    </div>
                    <Icon
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0 transition-colors',
                        selected ? 'text-accent' : 'text-text-muted',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          selected ? 'text-text-primary' : 'text-text-secondary',
                        )}
                      >
                        {ch.label}
                      </p>
                      <p className="text-[11px] text-text-muted">{ch.description}</p>
                    </div>
                  </div>
                  {selected && ch.identifierField ? (
                    <div className="border-t border-border/50 px-4 pb-4 pt-3">
                      <label className="mb-1 block text-[11px] font-medium text-text-muted">
                        {ch.identifierField.label}
                      </label>
                      <input
                        type={ch.identifierField.type}
                        placeholder={ch.identifierField.placeholder}
                        value={wizard.channels.find((c) => c.id === ch.id)?.identifier ?? ''}
                        onChange={(e) =>
                          setWizard((w) => ({
                            ...w,
                            channels: w.channels.map((c) =>
                              c.id === ch.id ? { ...c, identifier: e.target.value } : c,
                            ),
                          }))
                        }
                        className={AIVA_INPUT_CLASS}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {channelError ? <p className="mt-2 text-xs text-red-400">{channelError}</p> : null}
          <p className="mt-3 text-[11px] text-text-muted">
            You can leave identifiers blank and connect the channel from the Channels tab after setup.
          </p>
          <ContinueButton
            onClick={() => {
              if (wizard.channels.length === 0) {
                setChannelError('Select at least one channel to continue.');
                return;
              }
              hireStarted.current = false;
              setStep(5);
            }}
          />
          <button
            type="button"
            onClick={() => {
              setWizard((w) => ({ ...w, channels: [{ id: 'web', identifier: '' }] }));
              hireStarted.current = false;
              setStep(5);
            }}
            className="mt-3 w-full text-center text-xs text-text-muted transition-colors hover:text-text-primary"
          >
            Skip for now - start with web chat only
          </button>
        </StepCard>
      ) : null}

      {step === 5 ? (
        <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
          {setupError ? (
            <>
              <p className="mb-2 text-sm text-text-secondary">Something went wrong setting up your Aiva.</p>
              <p className="mb-5 text-xs text-text-muted">No data was lost. Try again to continue.</p>
              <button
                type="button"
                onClick={retryHire}
                disabled={retrying}
                className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
              >
                {retrying ? 'Retrying...' : 'Try again'}
              </button>
            </>
          ) : (
            <>
              <SetupSpinner />
              <p className="mb-6 text-base font-medium text-text-primary">
                Configuring {wizard.aivaName || 'your Aiva'}...
              </p>
              <div className="space-y-1.5">
                {SETUP_LABELS.map((label, index) => (
                  <p
                    key={label.text}
                    className={cn(
                      'text-sm transition-all duration-500',
                      visibleSetupLabels.has(index)
                        ? 'translate-y-0 text-text-muted opacity-100'
                        : 'pointer-events-none translate-y-2 opacity-0',
                    )}
                  >
                    {label.text}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {step === 6 && createdWorker ? (
        <StepCard>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-dim text-2xl font-semibold text-accent">
              {createdWorker.name.charAt(0)}
            </div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Meet your Aiva
            </p>
            <h1 className="mb-0.5 text-2xl font-semibold text-text-primary">
              Meet {createdWorker.name}
            </h1>
            <p className="text-sm text-text-muted">{roleLabel}</p>
          </div>
          <div className="mb-6 flex flex-wrap justify-center gap-2">
            {createdWorker.channels.map((ch) => (
              <div
                key={ch}
                className="flex items-center gap-1.5 rounded-full border border-border bg-elevated px-3 py-1.5 text-xs text-text-secondary"
              >
                <ChannelIcon channel={ch} className="h-3.5 w-3.5 text-text-muted" />
                {ch.charAt(0).toUpperCase() + ch.slice(1)}
              </div>
            ))}
          </div>
          <div className="mb-8 rounded-xl border border-border bg-base p-4">
            <p className="mb-3 text-[11px] text-text-muted">How your Aiva introduces itself:</p>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-dim text-xs font-semibold text-accent">
                {createdWorker.name.charAt(0)}
              </div>
              <div className="flex-1 rounded-2xl rounded-tl-sm border border-border bg-elevated px-4 py-2.5">
                <p className="text-sm text-text-secondary">
                  Hi! I am {createdWorker.name}. I handle {roleLabel.toLowerCase()} for{' '}
                  {wizard.businessName}. How can I help?
                </p>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-text-muted">
              If I am unsure, a real human from our team steps in. You will not need to switch tools.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <a
              href={`/aiva/workers/${createdWorker.id}`}
              className="btn-primary w-full rounded-lg py-3 text-center text-sm font-medium"
            >
              Go to your Aiva
            </a>
            <a
              href="/aiva"
              className="w-full py-2 text-center text-sm text-text-muted transition-colors hover:text-text-primary"
            >
              Go to your workspace
            </a>
          </div>
        </StepCard>
      ) : null}
    </>
  );
}

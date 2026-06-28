# Sprint 4 - Prompt 09: Onboarding Wizard and First Launch

**Status: COMPLETED 2026-06-23**

**What was built:** 6-step onboarding wizard with header step indicator, trial provisioning on Aiva register, POST workers hire flow with 2.5s setup animation, Meet your Aiva celebration, onboarding-complete cookie/middleware guard, trial countdown banner, channel bindings, welcome email via trial POST with owner email.

**Sprint:** 4
**Prompt number:** 09
**Primary agent:** Cursor
**Estimated hours:** 8-10 h
**Depends on:** 08-worker-brain.md (POST /api/aiva/workers must exist); 10-worker-portal-ui.md (workspace layout pattern to match)

**GTM alignment:** Read `sprint-4-CARINA_AI_EMPLOYEE_PLAN.md`. Onboarding proves "ready in minutes." Step 6 alone uses **Meet your Aiva**; all earlier steps and emails use **Hire an Aiva** framing. Welcome/first-message copy should imply human backup exists (no need to explain VA queue).

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `01-devends/prompts/02-archived_prompts/pending_prompts/sprint-4/action/`.

---

## Read First

1. `03-frontends/client-apps/app.carinaai.uk/src/app/(auth)/register/` - existing register page; understand its form and post-registration redirect
2. `03-frontends/client-apps/app.carinaai.uk/src/middleware.ts` - where to add onboarding redirect and trial expiry guard
3. `03-frontends/client-apps/app.carinaai.uk/src/lib/session.ts` - session helpers; you need `requireWorkspace` or equivalent
4. `03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/layout.tsx` - where to mount the trial banner
5. `03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/aiva/page.tsx` - the Aiva hire form (prompt 10); read it to match layout conventions

---

## Context

A new user arriving from `carinaai.uk/aiva/` follows this path:
1. Register (or log in)
2. Onboarding wizard at `/onboarding` - 6 steps, no sidebar, no workspace nav
3. Step 5 fires POST `/api/aiva/workers` and animates while it completes
4. Step 6 lands on the "Meet your Aiva" celebration; CTA goes to `/aiva/workers/[id]`
5. From then on, authenticated users hit the workspace normally

The trial gives every new account 15 days free, 1 Aiva slot, all features except white-labelling.
No payment is required during the trial. A countdown banner appears in the workspace at 3 days remaining.

---

## Step 1: Trial provisioning on registration

After account creation (existing register flow), fire:

```typescript
// Fire and forget - do not block registration if this fails
await fetch('/api/aiva/subscription/trial', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...authHeaders },
}).catch(() => {});
```

The Aiva registration funnel lives at `https://aiva.carinaai.uk/register`. Legacy
`app.carinaai.uk/register?from=aiva` redirects there via middleware. After successful
account creation redirect to `/onboarding` if the param is present, else to the existing
workspace landing (no regression for non-Aiva signups).

```typescript
// In post-registration handler:
const from = searchParams.get('from');
router.push(from === 'aiva' ? '/onboarding' : '/workspace');
```

---

## Step 2: Trial API routes

Create `src/app/api/aiva/subscription/trial/route.ts`:
```typescript
// POST - provision 15-day trial
// Requires authenticated session
// Proxies to CORE_API_URL/api/aiva/subscription/trial
// If subscription row already exists: 200 without duplicate
// Returns: { trialEndsAt: string; slotLimit: number }
```

Create `src/app/api/aiva/subscription/status/route.ts`:
```typescript
// GET - workspace subscription status
// Returns: {
//   planTier: 'trial' | 'starter' | 'team' | 'business' | 'suspended',
//   status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled',
//   trialEndsAt: string | null,
//   trialDaysRemaining: number | null,
//   slotLimit: number,
//   aivasUsed: number,
//   canHireMore: boolean,
// }
```

In the core backend (`aiva-api.ts`), add if not present:
```
POST /api/aiva/subscription/trial
  Upserts aiva_subscriptions: plan_tier='trial', status='trialing',
  trial_ends_at = NOW() + INTERVAL '15 days', aiva_slot_limit = 1

GET /api/aiva/subscription/status?workspaceId=
  Returns full status object; trialDaysRemaining computed server-side
```

Schema addition:
```sql
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
```

---

## Step 3: Onboarding layout

Create `src/app/(onboarding)/layout.tsx`.

No sidebar, no workspace nav. Full-screen dark-base background. A minimal fixed header at the top,
then the wizard card centered below it.

```tsx
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-base flex flex-col">
      {/* Header: wordmark left, step indicator center, balance spacer right */}
      <header className="h-14 flex items-center border-b border-border px-6 shrink-0">
        <span className="text-sm font-semibold text-text-primary w-[72px]">VERLOX</span>
        <div className="flex-1 flex justify-center">
          {/* StepIndicator rendered by OnboardingClient via context */}
          <OnboardingStepIndicatorSlot />
        </div>
        <div className="w-[72px]" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </main>
    </div>
  );
}
```

Because the step indicator needs the current step number and the wizard page owns that state,
pass it via a React context:
```typescript
// src/lib/onboarding-context.tsx
export const OnboardingContext = createContext<{ step: number } | null>(null);
```

---

## Step 4: Step indicator component

6 numbered circles connected by thin horizontal lines. Labels visible at sm breakpoint and above;
circles only on narrow viewports.

```tsx
const STEP_LABELS = ['Business', 'Role', 'Name', 'Channels', 'Setting up', 'Done'];

function StepIndicator({
  currentStep,
  onNavigate,
}: {
  currentStep: number;
  onNavigate: (step: number) => void;
}) {
  return (
    <nav aria-label="Onboarding progress" className="flex items-center">
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const state =
          stepNum < currentStep ? 'completed' :
          stepNum === currentStep ? 'current' : 'future';

        return (
          <div key={i} className="flex items-center">
            {/* Connector line (not before step 1) */}
            {i > 0 && (
              <div className={cn(
                'h-px w-6 sm:w-8 transition-colors duration-300',
                stepNum <= currentStep ? 'bg-accent' : 'bg-border',
              )} />
            )}

            <button
              onClick={() => state === 'completed' && onNavigate(stepNum)}
              disabled={state !== 'completed'}
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex flex-col items-center gap-1 focus:outline-none"
            >
              {/* Circle */}
              <div className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200',
                state === 'completed' && 'bg-accent text-white cursor-pointer hover:brightness-110',
                state === 'current'   && 'bg-accent text-white ring-2 ring-accent/30 ring-offset-2 ring-offset-base',
                state === 'future'    && 'bg-overlay border border-border text-text-muted',
              )}>
                {state === 'completed'
                  ? <Check className="h-3.5 w-3.5" />
                  : stepNum
                }
              </div>

              {/* Label - hidden below sm */}
              <span className={cn(
                'text-[9px] font-medium hidden sm:block transition-colors',
                state === 'current'   && 'text-accent',
                state === 'completed' && 'text-text-muted',
                state === 'future'    && 'text-text-muted opacity-50',
              )}>
                {label}
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
```

Connector lines color: accent when `stepNum <= currentStep`, border-border otherwise.

---

## Step 5: Wizard shell and shared components

Create `src/app/(onboarding)/onboarding/OnboardingClient.tsx`.
This client component owns all wizard state in a single `useState<WizardState>`.

**Step card wrapper:**
```tsx
function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-elevated p-8 shadow-sm">
      {children}
    </div>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold text-text-primary mb-1.5">{title}</h1>
      {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
    </div>
  );
}
```

**Continue button:**
```tsx
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
      onClick={onClick}
      disabled={disabled}
      className="btn-primary w-full py-3 text-sm font-medium mt-8
                 disabled:opacity-40 disabled:cursor-default"
    >
      {label}
    </button>
  );
}
```

---

## Step 6: Step 1 - Your business

```tsx
function Step1Business({ value, onChange, onContinue }) {
  const SECTORS = [
    { value: 'property',         label: 'Property management' },
    { value: 'finance',          label: 'Finance and accounting' },
    { value: 'legal',            label: 'Legal and compliance' },
    { value: 'sales',            label: 'Sales and outreach' },
    { value: 'content',          label: 'Content and marketing' },
    { value: 'operations',       label: 'Operations' },
    { value: 'customer-support', label: 'Customer support' },
    { value: 'other',            label: 'Other' },
  ];

  return (
    <StepCard>
      <StepHeading
        title="Tell us about your business"
        subtitle="We use this to suggest the right Aiva for you."
      />

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-primary mb-1.5">Business name</label>
          <input
            type="text"
            value={value.businessName}
            onChange={e => onChange({ ...value, businessName: e.target.value })}
            placeholder="e.g. Greenfield Properties"
            autoFocus
            className="w-full bg-base rounded-lg border border-border px-4 py-3 text-sm
                       text-text-primary placeholder:text-text-muted outline-none
                       focus:border-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-primary mb-1.5">Your sector</label>
          <div className="relative">
            <select
              value={value.sector}
              onChange={e => onChange({ ...value, sector: e.target.value })}
              className="w-full appearance-none bg-base rounded-lg border border-border px-4 py-3
                         text-sm text-text-primary outline-none focus:border-accent
                         transition-colors pr-10"
            >
              <option value="">Select your sector</option>
              {SECTORS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4
                                    text-text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      <ContinueButton
        onClick={onContinue}
        disabled={!value.businessName.trim() || !value.sector}
      />
    </StepCard>
  );
}
```

---

## Step 7: Step 2 - Role cards

Six cards in a 2-column grid (sm: 3 columns). The card matching the sector from Step 1 is
pre-selected on mount.

```typescript
const SECTOR_TO_TEMPLATE: Record<string, string> = {
  'property':         'property-manager',
  'finance':          'financial-analyst',
  'sales':            'outreach-coordinator',
  'content':          'content-assistant',
  'customer-support': 'customer-support',
};

const ROLE_TEMPLATES = [
  { id: 'customer-support',     label: 'Customer Support',    icon: Headphones, description: 'Answers enquiries around the clock' },
  { id: 'outreach-coordinator', label: 'Outreach Coordinator',icon: Send,       description: 'Qualifies leads and books calls' },
  { id: 'property-manager',     label: 'Property Manager',    icon: Building2,  description: 'Handles tenant and landlord queries' },
  { id: 'financial-analyst',    label: 'Financial Analyst',   icon: TrendingUp, description: 'Answers finance and accounts queries' },
  { id: 'content-assistant',    label: 'Content Assistant',   icon: PenLine,    description: 'Drafts copy and manages requests' },
  { id: 'operations',           label: 'Operations',          icon: Settings2,  description: 'Tracks tasks and co-ordinates teams' },
];
```

```tsx
function Step2Role({ sector, value, onChange, onContinue }) {
  const [customMode, setCustomMode] = useState(value.customMode);

  useEffect(() => {
    const match = SECTOR_TO_TEMPLATE[sector];
    if (match && !value.templateId) onChange({ ...value, templateId: match });
  }, []);

  return (
    <StepCard>
      <StepHeading
        title="What do you need your Aiva to handle?"
        subtitle="Pick a starting point. You can change this at any time."
      />

      {!customMode && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {ROLE_TEMPLATES.map(template => {
            const selected = value.templateId === template.id;
            return (
              <button
                key={template.id}
                onClick={() => onChange({ ...value, templateId: template.id, customDescription: '' })}
                className={cn(
                  'rounded-xl border p-4 text-left transition-all',
                  selected
                    ? 'border-accent bg-accent-dim shadow-[0_0_0_1px_rgba(26,95,122,0.15)]'
                    : 'border-border bg-base hover:border-accent/40 hover:bg-elevated',
                )}
              >
                <template.icon className={cn(
                  'h-5 w-5 mb-2.5',
                  selected ? 'text-accent' : 'text-text-muted',
                )} />
                <p className={cn(
                  'text-sm font-medium mb-0.5',
                  selected ? 'text-accent' : 'text-text-primary',
                )}>
                  {template.label}
                </p>
                <p className="text-[11px] text-text-muted leading-tight">{template.description}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Custom description toggle */}
      <button
        onClick={() => {
          setCustomMode(!customMode);
          if (!customMode) onChange({ ...value, templateId: null });
        }}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary mb-3"
      >
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', customMode && 'rotate-180')} />
        {customMode ? 'Choose from templates instead' : 'I need something different - describe it myself'}
      </button>

      {customMode && (
        <textarea
          value={value.customDescription}
          onChange={e => onChange({ ...value, customDescription: e.target.value, templateId: null })}
          rows={4}
          placeholder="Describe what you need your Aiva to handle..."
          autoFocus
          className="w-full bg-base rounded-lg border border-border px-4 py-3 text-sm
                     text-text-primary placeholder:text-text-muted outline-none
                     focus:border-accent transition-colors resize-none mb-2"
        />
      )}

      <ContinueButton
        onClick={onContinue}
        disabled={!value.templateId && !value.customDescription.trim()}
      />
    </StepCard>
  );
}
```

---

## Step 8: Step 3 - Name

The name input is oversized (text-2xl, centered) to signal a meaningful naming moment. 4 role-
appropriate suggestion chips are shown; a rotate button cycles through a pre-loaded list of 12.

```typescript
const ROLE_SUGGESTIONS: Record<string, string[]> = {
  'customer-support':     ['Aria', 'Nova', 'Maya', 'Lena', 'Kai', 'Sam', 'Finn', 'Jules', 'Blair', 'Sage', 'Alex', 'River'],
  'outreach-coordinator': ['Quinn', 'Blake', 'Harley', 'Logan', 'Scout', 'Ellis', 'Wren', 'Parker', 'Reese', 'Tyler', 'Skye', 'Cruz'],
  'property-manager':     ['Alex', 'Jordan', 'Sam', 'Morgan', 'Riley', 'Taylor', 'Casey', 'Drew', 'Avery', 'Jamie', 'Blair', 'Robin'],
  'financial-analyst':    ['Morgan', 'Blake', 'Cameron', 'Finley', 'Kendall', 'Reese', 'Sydney', 'Tatum', 'Harley', 'Wren', 'Lane', 'Vale'],
  'content-assistant':    ['Sage', 'Ren', 'Sol', 'Lyric', 'Story', 'Wren', 'Nova', 'Cleo', 'Rue', 'Bay', 'Fern', 'Pax'],
  'operations':           ['Ridge', 'Crew', 'Scout', 'Ace', 'Arrow', 'Blaze', 'Chase', 'Dash', 'Fox', 'Rook', 'Colt', 'Flint'],
  default:                ['Aria', 'Nova', 'Sage', 'Quinn', 'Blake', 'River', 'Ellis', 'Finn', 'Logan', 'Wren', 'Scout', 'Sol'],
};
```

```tsx
function Step3Name({ templateId, value, onChange, onContinue }) {
  const list = ROLE_SUGGESTIONS[templateId ?? 'default'] ?? ROLE_SUGGESTIONS.default;
  const [page, setPage] = useState(0);
  const visible = list.slice(page * 4, page * 4 + 4);

  function rotate() {
    setPage(p => (p * 4 + 4 >= list.length ? 0 : p + 1));
  }

  return (
    <StepCard>
      <StepHeading
        title="What should we call your Aiva?"
        subtitle="This is the name your clients will see. Use a first name that fits your brand."
      />

      {/* Large centered name input */}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="e.g. Aria"
        maxLength={30}
        autoFocus
        className="w-full bg-base rounded-xl border border-border px-5 py-4 text-2xl font-medium
                   text-text-primary placeholder:text-text-muted outline-none
                   focus:border-accent transition-colors text-center mb-4"
      />

      {/* Suggestion chips */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] text-text-muted">Suggested:</p>
          <button
            onClick={rotate}
            className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            More
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {visible.map(name => (
            <button
              key={name}
              onClick={() => onChange(name)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                value === name
                  ? 'border-accent bg-accent-dim text-accent'
                  : 'border-border bg-elevated text-text-secondary hover:border-accent/40 hover:text-text-primary',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <ContinueButton onClick={onContinue} disabled={!value.trim()} />
    </StepCard>
  );
}
```

---

## Step 9: Step 4 - Channels

5 channel cards in a vertical list. Selecting a card reveals an identifier input beneath the card
header row, inset and separated by a faint border-t.

```typescript
const CHANNELS = [
  { id: 'web',      label: 'Web chat',  icon: Globe,       description: 'Add a chat widget to your website - no identifier needed.', identifierField: null },
  { id: 'whatsapp', label: 'WhatsApp',  icon: Smartphone,  description: 'Connect your WhatsApp Business account.',                   identifierField: { label: 'WhatsApp business number',  placeholder: '+44 7700 900000',              type: 'tel'   as const } },
  { id: 'email',    label: 'Email',     icon: Mail,        description: 'Handle emails from your business inbox.',                   identifierField: { label: 'Business email address',     placeholder: 'support@yourcompany.com',      type: 'email' as const } },
  { id: 'slack',    label: 'Slack',     icon: Hash,        description: 'Deploy your Aiva to a Slack workspace.',                   identifierField: { label: 'Slack workspace URL',        placeholder: 'yourcompany.slack.com',        type: 'text'  as const } },
  { id: 'telegram', label: 'Telegram',  icon: Send,        description: 'Connect a Telegram bot.',                                  identifierField: { label: 'Telegram bot token',         placeholder: '1234567890:AAF...',            type: 'text'  as const } },
];
```

```tsx
function Step4Channels({ value, onChange, onContinue, onSkip }) {
  const [error, setError] = useState(false);

  function toggle(id: string) {
    const next = value.selected.includes(id)
      ? value.selected.filter(c => c !== id)
      : [...value.selected, id];
    onChange({ ...value, selected: next });
    setError(false);
  }

  function handleContinue() {
    if (value.selected.length === 0) { setError(true); return; }
    onContinue();
  }

  return (
    <StepCard>
      <StepHeading
        title="How do your clients reach you?"
        subtitle="Your Aiva will be available on the channels you connect. You can add more later."
      />

      <div className="space-y-2">
        {CHANNELS.map(ch => {
          const sel = value.selected.includes(ch.id);
          return (
            <div
              key={ch.id}
              className={cn(
                'rounded-xl border overflow-hidden transition-all',
                sel ? 'border-accent bg-elevated' : 'border-border bg-base hover:border-accent/30',
              )}
            >
              {/* Header row - clickable */}
              <div
                className="flex items-start gap-3 p-4 cursor-pointer"
                onClick={() => toggle(ch.id)}
              >
                {/* Checkbox */}
                <div className={cn(
                  'mt-0.5 h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                  sel ? 'bg-accent border-accent' : 'border-border',
                )}>
                  {sel && <Check className="h-2.5 w-2.5 text-white" />}
                </div>

                {/* Channel icon */}
                <ch.icon className={cn(
                  'h-4 w-4 mt-0.5 flex-shrink-0 transition-colors',
                  sel ? 'text-accent' : 'text-text-muted',
                )} />

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', sel ? 'text-text-primary' : 'text-text-secondary')}>
                    {ch.label}
                  </p>
                  <p className="text-[11px] text-text-muted">{ch.description}</p>
                </div>
              </div>

              {/* Identifier input - revealed when selected */}
              {sel && ch.identifierField && (
                <div className="px-4 pb-4 border-t border-border/50 pt-3">
                  <label className="block text-[11px] font-medium text-text-muted mb-1">
                    {ch.identifierField.label}
                  </label>
                  <input
                    type={ch.identifierField.type}
                    placeholder={ch.identifierField.placeholder}
                    value={value.identifiers[ch.id] ?? ''}
                    onChange={e => onChange({
                      ...value,
                      identifiers: { ...value.identifiers, [ch.id]: e.target.value },
                    })}
                    className="w-full bg-base rounded-lg border border-border px-3 py-2 text-sm
                               text-text-primary placeholder:text-text-muted outline-none
                               focus:border-accent transition-colors"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-400 mt-2">Select at least one channel to continue.</p>}

      <p className="text-[11px] text-text-muted mt-3">
        You can leave identifiers blank and connect the channel from the Channels tab after setup.
      </p>

      <ContinueButton onClick={handleContinue} />

      <button
        onClick={onSkip}
        className="w-full text-center text-xs text-text-muted hover:text-text-primary transition-colors mt-3"
      >
        Skip for now - start with web chat only
      </button>
    </StepCard>
  );
}
```

---

## Step 10: Step 5 - Configuring (auto-advance)

No card, no user input. Fires POST `/api/aiva/workers` automatically on mount. Enforces a minimum
2500ms display time so the user sees all four labels appear regardless of API speed.

```tsx
function Step5Configuring({ payload, workerName, onSuccess, onError }) {
  const LABELS = [
    { text: 'Building persona...',    delay: 500 },
    { text: 'Loading skills...',      delay: 1050 },
    { text: 'Setting up channels...', delay: 1600 },
    { text: 'Almost ready...',        delay: 2100 },
  ];
  const [visible, setVisible] = useState<Set<number>>(new Set());
  const [failed, setFailed]   = useState(false);
  const [retrying, setRetrying] = useState(false);

  async function run() {
    setFailed(false);
    const start = Date.now();
    try {
      const res = await fetch('/api/aiva/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const elapsed = Date.now() - start;
      await new Promise(r => setTimeout(r, Math.max(0, 2500 - elapsed)));
      if (!res.ok) { setFailed(true); return; }
      const worker = await res.json();
      onSuccess(worker);
    } catch {
      await new Promise(r => setTimeout(r, Math.max(0, 2500 - (Date.now() - start))));
      setFailed(true);
    }
  }

  useEffect(() => {
    LABELS.forEach((l, i) => setTimeout(() => setVisible(prev => new Set([...prev, i])), l.delay));
    run();
  }, []);

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[340px] text-center">
        <p className="text-sm text-text-secondary mb-2">Something went wrong setting up your Aiva.</p>
        <p className="text-xs text-text-muted mb-5">No data was lost. Try again to continue.</p>
        <button
          onClick={() => { setRetrying(true); run(); }}
          disabled={retrying}
          className="btn-primary px-6 py-2.5 text-sm"
        >
          {retrying ? 'Retrying...' : 'Try again'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[340px] text-center">
      {/* Amber spinner ring */}
      <div className="relative h-16 w-16 mb-6">
        <div className="absolute inset-0 rounded-full border-2 border-border" />
        <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>

      <p className="text-base font-medium text-text-primary mb-6">
        Configuring {workerName}...
      </p>

      {/* Labels fade in sequentially */}
      <div className="space-y-1.5">
        {LABELS.map((l, i) => (
          <p
            key={i}
            className={cn(
              'text-sm transition-all duration-500',
              visible.has(i)
                ? 'opacity-100 translate-y-0 text-text-muted'
                : 'opacity-0 translate-y-2 pointer-events-none',
            )}
          >
            {l.text}
          </p>
        ))}
      </div>
    </div>
  );
}
```

---

## Step 11: Step 6 - Meet your Aiva

```tsx
function Step6Done({ worker, businessName }) {
  const { id, name, role, channels } = worker;

  // Fire onboarding-complete in background on mount
  useEffect(() => {
    fetch('/api/workspace/onboarding-complete', { method: 'PATCH' }).catch(() => {});
  }, []);

  return (
    <StepCard>
      {/* Avatar + name + role */}
      <div className="text-center mb-6">
        <div className="h-16 w-16 rounded-full bg-accent-dim text-accent text-2xl font-semibold
                        flex items-center justify-center mx-auto mb-4">
          {name.charAt(0)}
        </div>
        <h1 className="text-2xl font-semibold text-text-primary mb-0.5">Meet {name}</h1>
        <p className="text-sm text-text-muted">{role}</p>
      </div>

      {/* Channel badges */}
      <div className="flex justify-center gap-2 flex-wrap mb-6">
        {channels.map((ch: string) => (
          <div
            key={ch}
            className="flex items-center gap-1.5 text-xs text-text-secondary
                        bg-elevated border border-border rounded-full px-3 py-1.5"
          >
            <ChannelIcon channel={ch} className="h-3.5 w-3.5 text-text-muted" />
            {capitalize(ch)}
          </div>
        ))}
      </div>

      {/* First-message preview */}
      <div className="rounded-xl bg-base border border-border p-4 mb-8">
        <p className="text-[11px] text-text-muted mb-3">How your Aiva introduces itself:</p>
        <div className="flex items-start gap-3">
          <div className="h-7 w-7 rounded-full bg-accent-dim text-accent text-xs font-semibold
                          flex items-center justify-center flex-shrink-0 mt-0.5">
            {name.charAt(0)}
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-elevated border border-border px-4 py-2.5 flex-1">
            <p className="text-sm text-text-secondary">
              Hi! I am {name}. I handle {role.toLowerCase()} for {businessName}. How can I help?
            </p>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3">
        <a
          href={`/aiva/workers/${id}`}
          className="btn-primary w-full py-3 text-sm font-medium text-center rounded-lg"
        >
          Go to your Aiva
        </a>
        <a
          href="/aiva"
          className="w-full py-2 text-sm text-center text-text-muted hover:text-text-primary transition-colors"
        >
          Go to your workspace
        </a>
      </div>
    </StepCard>
  );
}
```

---

## Step 12: Middleware additions

Extend `src/middleware.ts`:

```typescript
// Onboarding redirect:
// Check cookie 'aiva_onboarding_done'. If absent AND workspace route AND not /onboarding:
if (isAuthenticated && isWorkspaceRoute && !pathname.startsWith('/onboarding')) {
  const done = request.cookies.get('aiva_onboarding_done')?.value;
  if (!done) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }
}

// Trial expiry guard (only on /aiva/* routes):
if (isAuthenticated && pathname.startsWith('/aiva')) {
  const planStatus = request.cookies.get('aiva_plan_status')?.value;
  if (planStatus === 'suspended' || planStatus === 'trial_expired') {
    return NextResponse.redirect(new URL('/billing?reason=trial_expired', request.url));
  }
}
```

The `aiva_onboarding_done` cookie (1-hour TTL, HttpOnly) is set by the
`/api/workspace/onboarding-complete` handler so the middleware avoids a DB read on every request.

The `aiva_plan_status` cookie is set in the workspace server layout component and refreshed on
each render, with a 1-hour TTL.

---

## Step 13: Trial countdown banner

Mounted in `src/app/(workspace)/layout.tsx` directly above the main content area (between the
topbar and the page content slot). h-10 strip with border-b.

```tsx
const BANNER: Record<number, { bg: string; color: string; text: string; cta: string }> = {
  3: { bg: 'bg-amber-500/10 border-b border-amber-500/25', color: 'text-amber-400',
       text: 'Your Aiva trial ends in 3 days.', cta: 'Choose a plan' },
  2: { bg: 'bg-amber-500/10 border-b border-amber-500/25', color: 'text-amber-400',
       text: '2 days left on your Aiva trial.', cta: 'Choose a plan' },
  1: { bg: 'bg-red-500/10 border-b border-red-500/25', color: 'text-red-400',
       text: 'Last day of your Aiva trial.', cta: 'Choose a plan now' },
  0: { bg: 'bg-red-500/10 border-b border-red-500/25', color: 'text-red-400',
       text: 'Your trial has ended. Your Aiva is paused.', cta: 'Reactivate' },
};

function TrialBanner() {
  const { data: status } = useSWR('/api/aiva/subscription/status', { revalidateOnFocus: false });
  const [dismissed, setDismissed] = useState(false);

  const days = status?.trialDaysRemaining ?? null;
  if (days === null || days > 3 || dismissed) return null;

  const cfg = BANNER[Math.max(0, days)];

  return (
    <div className={cn(
      'flex items-center justify-center gap-3 h-10 px-4 text-xs relative shrink-0',
      cfg.bg,
    )}>
      <span className={cfg.color}>{cfg.text}</span>
      <a href="/billing" className={cn('font-semibold underline underline-offset-2', cfg.color)}>
        {cfg.cta}
      </a>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
```

---

## Step 14: New API route

**`src/app/api/workspace/onboarding-complete/route.ts`**
```typescript
// PATCH
// Sets onboarding_completed_at = NOW() on the workspace
// Sets response cookie aiva_onboarding_done=1 (1-hour, HttpOnly)
// Proxies to CORE_API_URL/api/workspace/onboarding-complete
```

---

## Done When

**Step 6 - Meet your Aiva:**
- [x] Step 6 title is **Meet your Aiva** (celebration only; not used on marketing hero)
- [x] CTA goes to `/aiva/workers/[id]`; worker name from step 3 shown in heading

**GTM copy:**
- [x] No user-facing copy mentions subagents, orchestration, or "AI Workforce" as product name
- [x] First-launch / welcome message reads as one named employee, not a platform
- [x] Canonical tagline available for post-hire email footer (wire in prompt 11): *Hire an Aiva. Powered by Carina. Governed by Scout. Backed by real humans.*

**Flow:**
- [x] `https://aiva.carinaai.uk/register` redirects to `/onboarding` after registration
- [x] `register` without param uses the existing post-registration redirect (no regression)
- [x] Trial subscription provisioned on registration; failure does not block the flow
- [x] Unauthenticated `/onboarding` visit redirects to `/login?next=/onboarding`
- [x] Authenticated workspace users with no `aiva_onboarding_done` cookie redirect to `/onboarding`
- [x] Suspended or trial-expired accounts visiting `/aiva/*` redirect to `/billing?reason=trial_expired`

**Layout:**
- [x] Onboarding layout: no sidebar, VERLOX wordmark top-left, step indicator centered, h-14 header with border-b
- [x] Content: max-w-lg centered card area; StepCard is rounded-2xl bg-elevated p-8 shadow-sm

**Step indicator:**
- [x] 6 circles; connector lines between them; completed=accent+check, current=accent+ring, future=overlay
- [x] Labels hidden below sm breakpoint
- [x] Clicking a completed circle navigates back to that step
- [x] Connector lines are accent-colored when the step to their right is completed or current

**Step 1 - Business:**
- [x] Both fields required before Continue enables
- [x] Sector uses native select with ChevronDown overlay

**Step 2 - Role:**
- [x] 6 role cards in 2-col (sm:3-col) grid; selected state: border-accent + bg-accent-dim + shadow ring
- [x] Correct card auto-selected based on sector from Step 1
- [x] "Describe it myself" toggle hides grid and shows textarea; role card icon and text color match selection state

**Step 3 - Name:**
- [x] Name input: text-2xl, centered, rounded-xl
- [x] 4 suggestion chips shown; "More" button cycles to next group of 4 (wraps at end)
- [x] Clicking chip fills the input and highlights chip with accent border
- [x] Suggestions are role-appropriate

**Step 4 - Channels:**
- [x] 5 channel cards; selecting reveals identifier input below header row inset with border-t
- [x] Web chat has no identifier input
- [x] Error shown inline when Continue clicked with no selection
- [x] "Skip for now" sets channels to ['web'] with no identifiers

**Step 5 - Configuring:**
- [x] No card wrapper; amber spin ring + "Configuring NAME..." text centered in min-h-[340px] area
- [x] 4 labels fade in at 500ms, 1050ms, 1600ms, 2100ms
- [x] Minimum display: 2500ms regardless of API response time
- [x] Error state shown on failure with "Try again" button (no navigation back to Step 4)

**Step 6 - Done:**
- [x] 64px circular avatar with initial letter, bg-accent-dim text-accent
- [x] Channel badges: border, icon + label, rounded-full
- [x] First-message preview bubble: left-aligned Aiva bubble with avatar, bg-elevated border
- [x] "Go to your Aiva" = btn-primary; "Go to your workspace" = plain muted text link
- [x] PATCH `/api/workspace/onboarding-complete` fired on mount (background)

**Trial banner:**
- [x] h-10 strip in workspace layout, border-b
- [x] Not rendered when trialDaysRemaining > 3
- [x] Amber styling at 3 and 2 days; red at 1 and 0
- [x] Dismiss X hides for session
- [x] CTA links to /billing

**Mobile:**
- [x] Wizard usable at 375px viewport
- [x] Role cards: 2 columns always (no 3-col on mobile)
- [x] Step labels hidden below sm; circles always visible

**General:**
- [x] No em dashes in any copy, comments, or JSX strings
- [x] No emojis; lucide-react icons only
- [x] No TypeScript errors

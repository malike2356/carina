**Status: COMPLETED 2026-06-21**

**What was built:**
- First-run wizard polish: animated progress bars, branded ASCII header
- `carina setup` re-entry point for re-running onboarding
- Completion hint shown after install: `source <(carina completion bash)`

# Gap 07 - Prompt 07: CLI Onboarding Polish

**Agent:** Claude Code (fallback: Codex)
**Estimated hours:** 3-4 hrs
**Depends on:** 06 done (interactive mode working); existing first-run files

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

```
core.carinaai.uk/src/cli/first-run.ts             (EXISTS)
core.carinaai.uk/src/cli/first-run-onboarding.ts  (EXISTS)
core.carinaai.uk/src/cli/onboarding-gateway.ts    (EXISTS)
core.carinaai.uk/src/cli/provider-bootstrap.ts    (EXISTS)
core.carinaai.uk/src/tui/ink/                     (from 01 and 06)
core.carinaai.uk/src/pairing/pairing.ts            (backend for QR pairing)
```

---

## What Exists

Four onboarding-related files exist but they are disconnected:
- `first-run.ts`: detects if this is first launch
- `first-run-onboarding.ts`: shows initial prompts (likely readline-based)
- `onboarding-gateway.ts`: sets up the gateway connection during onboarding
- `provider-bootstrap.ts`: handles API key entry for the first provider

This prompt unifies them into a single polished multi-step wizard using Ink, with animated effects, a QR code for mobile pairing, and a clear flow from zero to first conversation.

---

## 1. Onboarding State Machine

The wizard has 6 steps. Each step is its own Ink component. State moves forward only; user can skip optional steps.

```typescript
// src/tui/ink/onboarding/types.ts

export type OnboardingStep =
  | 'welcome'          // animated banner + "Press Enter to start"
  | 'provider'         // choose AI provider + enter API key
  | 'model'            // choose default model
  | 'workspace'        // name their first workspace (optional)
  | 'mobile-pairing'   // QR code to pair mobile (optional, can skip)
  | 'done'; // success screen + first prompt

export interface OnboardingState {
  step: OnboardingStep;
  provider: string | null;
  apiKey: string | null;
  model: string | null;
  workspaceName: string | null;
  mobilePaired: boolean;
}
```

---

## 2. Onboarding Root (`src/tui/ink/onboarding/Onboarding.tsx`)

```tsx
import React, { useState } from 'react';
import { Box } from 'ink';
import { WelcomeStep } from './steps/WelcomeStep';
import { ProviderStep } from './steps/ProviderStep';
import { ModelStep } from './steps/ModelStep';
import { WorkspaceStep } from './steps/WorkspaceStep';
import { MobilePairingStep } from './steps/MobilePairingStep';
import { DoneStep } from './steps/DoneStep';
import { OnboardingState, OnboardingStep } from './types';

const STEP_ORDER: OnboardingStep[] = [
  'welcome', 'provider', 'model', 'workspace', 'mobile-pairing', 'done',
];

interface OnboardingProps {
  onComplete: (state: OnboardingState) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [state, setState] = useState<OnboardingState>({
    step: 'welcome',
    provider: null, apiKey: null, model: null,
    workspaceName: null, mobilePaired: false,
  });

  function advance(partial: Partial<OnboardingState>) {
    setState(prev => {
      const currentIndex = STEP_ORDER.indexOf(prev.step);
      const nextStep = STEP_ORDER[currentIndex + 1] ?? 'done';
      const updated = { ...prev, ...partial, step: nextStep };
      if (updated.step === 'done') onComplete(updated);
      return updated;
    });
  }

  switch (state.step) {
    case 'welcome':       return <WelcomeStep onNext={() => advance({})} />;
    case 'provider':      return <ProviderStep onNext={(provider, apiKey) => advance({ provider, apiKey })} />;
    case 'model':         return <ModelStep provider={state.provider!} onNext={(model) => advance({ model })} />;
    case 'workspace':     return <WorkspaceStep onNext={(name) => advance({ workspaceName: name })} onSkip={() => advance({})} />;
    case 'mobile-pairing':return <MobilePairingStep onNext={() => advance({ mobilePaired: true })} onSkip={() => advance({})} />;
    case 'done':          return <DoneStep state={state} />;
    default:              return null;
  }
}
```

---

## 3. Welcome Step (`src/tui/ink/onboarding/steps/WelcomeStep.tsx`)

Animated typing effect:

```tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Gradient from 'ink-gradient';

const LOGO = `
 ██████╗ █████╗ ██████╗ ██╗███╗   ██╗ █████╗
██╔════╝██╔══██╗██╔══██╗██║████╗  ██║██╔══██╗
██║     ███████║██████╔╝██║██╔██╗ ██║███████║
██║     ██╔══██║██╔══██╗██║██║╚██╗██║██╔══██║
╚██████╗██║  ██║██║  ██║██║██║ ╚████║██║  ██║
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
`.trim();

const TAGLINE = 'Your AI agent for property, security, and everything in between.';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  const [taglineChars, setTaglineChars] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTaglineChars(i);
      if (i >= TAGLINE.length) {
        clearInterval(interval);
        setTimeout(() => setShowPrompt(true), 500);
      }
    }, 30);
    return () => clearInterval(interval);
  }, []);

  useInput((input, key) => {
    if (key.return || input === ' ') onNext();
  });

  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Gradient name="rainbow">
        <Text>{LOGO}</Text>
      </Gradient>
      <Box marginTop={2}>
        <Text color="white">{TAGLINE.slice(0, taglineChars)}</Text>
        {taglineChars < TAGLINE.length && <Text color="cyan">|</Text>}
      </Box>
      {showPrompt && (
        <Box marginTop={2}>
          <Text dimColor>Press </Text>
          <Text color="cyan" bold>Enter</Text>
          <Text dimColor> to set up Carina</Text>
        </Box>
      )}
    </Box>
  );
}
```

---

## 4. Provider Step (`src/tui/ink/onboarding/steps/ProviderStep.tsx`)

```tsx
import React, { useState } from 'react';
import { Box, Text, TextInput, useInput } from 'ink';
import SelectInput from 'ink-select-input'; // npm: ink-select-input

const PROVIDERS = [
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'OpenAI (GPT-4)', value: 'openai' },
  { label: 'Google (Gemini)', value: 'gemini' },
  { label: 'Groq (Llama/Mixtral)', value: 'groq' },
];

export function ProviderStep({ onNext }: { onNext: (provider: string, apiKey: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  async function handleKeySubmit(key: string) {
    if (!selected) return;
    setValidating(true);
    setError(null);
    try {
      const ok = await validateApiKey(selected, key);
      if (ok) {
        onNext(selected, key);
      } else {
        setError('API key invalid. Check and try again.');
      }
    } catch {
      setError('Could not validate. Check your internet connection.');
    } finally {
      setValidating(false);
    }
  }

  if (!selected) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text bold color="cyan">Step 1/5 - Choose your AI provider</Text>
        <Box marginTop={1}>
          <SelectInput
            items={PROVIDERS}
            onSelect={(item) => setSelected(item.value)}
          />
        </Box>
      </Box>
    );
  }

  const providerName = PROVIDERS.find(p => p.value === selected)?.label ?? selected;
  const keyHelp: Record<string, string> = {
    anthropic: 'Get your key at console.anthropic.com/account/keys',
    openai:    'Get your key at platform.openai.com/api-keys',
    gemini:    'Get your key at aistudio.google.com/app/apikey',
    groq:      'Get your key at console.groq.com/keys',
  };

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text bold color="cyan">Step 1/5 - {providerName} API Key</Text>
      <Text dimColor marginTop={1}>{keyHelp[selected]}</Text>
      <Box marginTop={1}>
        <Text color="cyan"> &gt; </Text>
        <TextInput
          mask="*"
          value={apiKey}
          onChange={setApiKey}
          onSubmit={handleKeySubmit}
          placeholder="Paste your API key here..."
        />
      </Box>
      {validating && <Text color="yellow" marginTop={1}>Validating...</Text>}
      {error && <Text color="red" marginTop={1}>{error}</Text>}
    </Box>
  );
}
```

---

## 5. Mobile Pairing Step with QR (`src/tui/ink/onboarding/steps/MobilePairingStep.tsx`)

```tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import qrcode from 'qrcode-terminal'; // npm: qrcode-terminal

export function MobilePairingStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [qrLines, setQrLines] = useState<string[]>([]);
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const [polling, setPolling] = useState(true);

  useInput((input, key) => {
    if (input === 's' || input === 'S') onSkip();
    if (key.escape) onSkip();
  });

  useEffect(() => {
    let cancelled = false;

    async function generatePairingQr() {
      try {
        // Call backend to generate pairing token
        const { pairingUrl: url } = await generatePairingToken();
        if (cancelled) return;

        setPairingUrl(url);

        // Render QR to string lines
        qrcode.generate(url, { small: true }, (qr: string) => {
          setQrLines(qr.split('\n'));
        });

        // Poll for pairing completion
        const pollInterval = setInterval(async () => {
          if (cancelled) { clearInterval(pollInterval); return; }
          const status = await checkPairingStatus();
          if (status.paired) {
            clearInterval(pollInterval);
            setPaired(true);
            setTimeout(() => onNext(), 1000);
          }
        }, 2000);

        return () => clearInterval(pollInterval);
      } catch {
        // Pairing not available: skip
        onSkip();
      }
    }

    generatePairingQr();
    return () => { cancelled = true; };
  }, []);

  if (paired) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text color="green" bold>Mobile device paired!</Text>
        <Text dimColor>Continuing setup...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text bold color="cyan">Step 4/5 - Pair Mobile (optional)</Text>
      <Text dimColor marginTop={1}>
        Scan with the Carina mobile app to enable SMS relay, camera, and notifications.
      </Text>
      <Box marginTop={1} flexDirection="column">
        {qrLines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
      {pairingUrl && (
        <Text dimColor marginTop={1}>URL: {pairingUrl}</Text>
      )}
      <Box marginTop={2}>
        <Text dimColor>Waiting for scan... </Text>
        <Text color="yellow">[S]</Text>
        <Text dimColor> to skip</Text>
      </Box>
    </Box>
  );
}
```

---

## 6. Done Step (`src/tui/ink/onboarding/steps/DoneStep.tsx`)

```tsx
export function DoneStep({ state }: { state: OnboardingState }) {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="green" bold>Carina is ready.</Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Provider:   <Text color="white">{state.provider}</Text></Text>
        <Text dimColor>Model:      <Text color="white">{state.model}</Text></Text>
        {state.workspaceName && (
          <Text dimColor>Workspace:  <Text color="white">{state.workspaceName}</Text></Text>
        )}
        {state.mobilePaired && (
          <Text dimColor>Mobile:     <Text color="green">Paired</Text></Text>
        )}
      </Box>
      <Box marginTop={2}>
        <Text>Type your first message below:</Text>
      </Box>
    </Box>
  );
}
```

---

## 7. Integration with first-run.ts

Update `src/cli/first-run.ts` to:
1. Check if onboarding has been completed (check `~/.carina/config.json` for `onboardingComplete: true`)
2. If not: launch the Ink onboarding wizard
3. After wizard completes: save the config and continue to normal interactive mode

```typescript
// src/cli/first-run.ts
import { isFirstRun, markOnboardingComplete } from './first-run-state';

export async function runFirstRunCheckIfNeeded() {
  if (!isFirstRun()) return;

  const { render } = await import('ink');
  const React = await import('react');
  const { Onboarding } = await import('../tui/ink/onboarding/Onboarding');

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      React.createElement(Onboarding, {
        onComplete: async (state) => {
          unmount();
          await markOnboardingComplete(state);
          resolve();
        },
      })
    );
  });
}
```

---

## Files to Create

```
core.carinaai.uk/src/tui/ink/onboarding/
├── Onboarding.tsx
├── types.ts
└── steps/
    ├── WelcomeStep.tsx
    ├── ProviderStep.tsx
    ├── ModelStep.tsx
    ├── WorkspaceStep.tsx
    ├── MobilePairingStep.tsx
    └── DoneStep.tsx
```

## Files to Modify

```
src/cli/first-run.ts          → call Ink onboarding instead of readline prompts
src/tui/ink/start.ts          → call runFirstRunCheckIfNeeded() before launching App
```

## Packages to Add

```bash
pnpm add qrcode-terminal ink-select-input
# ink-gradient already added in 06
```

---

## Done When

- [ ] First launch (no `~/.carina/config.json`) shows the animated welcome screen
- [ ] Tagline types character-by-character with a blinking cursor
- [ ] Provider selection shows all 4 providers with arrow key navigation
- [ ] Entering an invalid API key shows an error and allows retry
- [ ] Entering a valid key advances to model selection
- [ ] Model step shows available models for the chosen provider
- [ ] Workspace step allows naming (or skip)
- [ ] Mobile pairing step shows a QR code rendered in terminal using block characters
- [ ] Scanning the QR with the Carina mobile app advances to the Done step
- [ ] Pressing S at the QR step skips pairing and goes to Done
- [ ] Done screen shows the chosen provider, model, workspace, and pairing status
- [ ] Subsequent launches skip onboarding entirely (onboardingComplete flag set)
- [ ] `carina --setup` re-runs onboarding even if already completed

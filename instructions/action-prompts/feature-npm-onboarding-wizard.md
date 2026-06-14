# npm Onboarding Wizard: GitHub Copilot Free Tier + Wizard Polish

## Goal

A user who runs `npm install -g carina-agent` for the first time should be able to get a working Carina with zero paid API keys by choosing GitHub Copilot (free with any GitHub account that has Copilot access). The setup wizard should offer this as the first option.

## Current state

- `src/cli/commands/setup.ts` (`runCliSetup`) - the primary interactive setup, called by `carina setup` and auto-triggered on first run
- `src/cli/config/defaults.ts` - `ProviderName = 'deepseek' | 'anthropic' | 'openai'` (only three)
- `src/cli/config/env.ts` - `envKeyForProvider(provider)` returns `${provider.toUpperCase()}_API_KEY`
- `src/cli/first-run.ts` - `ensureFirstRunReady()` triggers `runCliSetup()` on first `carina` run (already wired into `agent.ts` and `tui/index.ts`)
- `plugins/providers/github-copilot.ts` - Copilot provider plugin, uses `GITHUB_TOKEN` (not `GITHUB_COPILOT_API_KEY`)

## What to build

### 1. Extend `ProviderName` in `src/cli/config/defaults.ts`

```typescript
export type ProviderName = 'deepseek' | 'anthropic' | 'openai' | 'github-copilot';
```

Add a default entry for `github-copilot` in `DEFAULT_CLI_CONFIG.providers`:

```typescript
'github-copilot': {
  api_key: '',
  model: 'gpt-4o',
},
```

The `api_key` field stores the GitHub token. Empty string means "read from GITHUB_TOKEN env var at runtime".

### 2. Update `src/cli/commands/setup.ts`

#### 2a. Add Copilot to the provider list

```typescript
const provider = await select<ProviderName>({
  message: 'Default provider',
  choices: [
    { name: 'GitHub Copilot (free - requires GitHub account with Copilot access)', value: 'github-copilot' },
    { name: 'DeepSeek (cheapest paid option)', value: 'deepseek' },
    { name: 'Anthropic Claude', value: 'anthropic' },
    { name: 'OpenAI', value: 'openai' },
  ],
});
```

#### 2b. Special handling for `github-copilot`

GitHub Copilot uses `GITHUB_TOKEN` instead of a standard `_API_KEY` env var. The token is obtained from the GitHub CLI (`gh auth token`).

After provider selection, before the API key prompt, add a branch:

```typescript
let apiKey: string;
let envLine: string;

if (provider === 'github-copilot') {
  console.log(format.muted('\nGitHub Copilot uses your GitHub CLI token.'));
  console.log(format.muted('If you have `gh` installed and authenticated, press Enter to auto-fetch.\n'));

  const autoFetch = await confirm({
    message: 'Auto-fetch token from `gh auth token`?',
    default: true,
  });

  if (autoFetch) {
    try {
      const { execSync } = await import('child_process');
      apiKey = execSync('gh auth token', { encoding: 'utf-8' }).trim();
      if (!apiKey) throw new Error('empty');
      console.log(format.success('GitHub token fetched.'));
    } catch {
      console.log(format.error('Could not run `gh auth token`. Install GitHub CLI and run `gh auth login` first.'));
      apiKey = await password({ message: 'Or paste your GitHub token manually:', mask: '*' });
    }
  } else {
    apiKey = await password({ message: 'Paste your GitHub token:', mask: '*', validate: (v) => v.trim().length > 0 ? true : 'Token required' });
  }
  envLine = `GITHUB_TOKEN=${apiKey}`;
} else {
  // existing deepseek/anthropic/openai path
  const defaultModel = MODELS[provider];
  // ... (existing code)
  envLine = `${envKeyForProvider(provider)}=${apiKey}`;
}
```

#### 2c. Skip connection test for Copilot

`testProviderConnection` only handles `anthropic`, `deepseek`, `openai`. For `github-copilot`, skip the test step with a note:

```typescript
if (provider !== 'github-copilot') {
  const runTest = await confirm({ message: 'Test provider connection before saving?', default: true });
  if (runTest) { /* existing test code */ }
} else {
  console.log(format.muted('Skipping connection test for GitHub Copilot (tested on first use).'));
}
```

#### 2d. Write correct env line for Copilot

The `.env` write at the end uses `envKeyForProvider(provider)` which would produce `GITHUB-COPILOT_API_KEY`. Replace that with `envLine` computed above:

```typescript
await fs.writeFile(
  CARINA_ENV_PATH,
  [
    `DEFAULT_PROVIDER=${provider}`,
    envLine,                           // GITHUB_TOKEN=... or PROVIDER_API_KEY=...
    `DEFAULT_MODEL=${model || defaultModel}`,
    ...(activePack ? [`ACTIVE_SKILL_PACK=${activePack}`] : []),
  ].join('\n') + '\n',
  { mode: 0o600 },
);
```

Also update config.yaml: for Copilot, `api_key` in `providers['github-copilot']` should store the token value (or leave blank if Cursor prefers the env-only approach - either is fine, just be consistent).

#### 2e. Model selection for Copilot

```typescript
const MODELS: Record<ProviderName, string> = {
  deepseek: 'deepseek-chat',
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  'github-copilot': 'gpt-4o',
};
```

The model prompt should still appear for Copilot so users can switch to `claude-3.5-sonnet` or `o1-mini`.

#### 2f. End-of-setup next steps banner for Copilot

After writing config:

```typescript
if (provider === 'github-copilot') {
  console.log(format.muted('\nNext: run `carina` to start chatting.'));
  console.log(format.muted('Your GitHub token refreshes automatically via the gh CLI.'));
  console.log(format.muted('To switch provider later: carina setup'));
}
```

### 3. Update `src/setup/wizard.ts` (older wizard, also needs Copilot)

`wizard.ts` is a separate code path used outside the CLI context. Apply the same addition: add `github-copilot` to the `ProviderChoice` type and `select` choices, with the same `gh auth token` auto-fetch logic.

```typescript
type ProviderChoice = 'deepseek' | 'anthropic' | 'openai' | 'github-copilot' | 'later';
```

In the handler:

```typescript
} else if (provider === 'github-copilot') {
  try {
    const { execSync } = await import('child_process');
    const token = execSync('gh auth token', { encoding: 'utf-8' }).trim();
    if (token) lines.push('GITHUB_TOKEN=' + token);
  } catch {
    const token = await input({ message: 'Paste your GitHub token (from `gh auth token`):' });
    if (token.trim()) lines.push('GITHUB_TOKEN=' + token.trim());
  }
}
```

### 4. `src/cli/first-run.ts` - update `printFirstRunGuide`

The guide currently says "Add an LLM API key". Update to mention the free Copilot option:

```typescript
console.log(chalk.white('  Minimum to chat:'));
console.log(chalk.gray('    1. carina setup    (guided - includes free GitHub Copilot option)'));
console.log(chalk.gray('    2. Or edit ~/.carina/.env (DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, etc.)'));
```

## Constraints

- `envKeyForProvider` is only used for deepseek/anthropic/openai paths; Copilot writes `GITHUB_TOKEN` directly
- Do not add `github-copilot` to `envKeyForProvider` - the special casing in setup.ts is sufficient
- No new npm packages
- The `execSync('gh auth token')` call is wrapped in try/catch - if gh CLI is absent it falls back to manual paste
- No changes to `plugins/providers/github-copilot.ts` - the plugin already reads `GITHUB_TOKEN` / `GITHUB_TOKENS`
- No em dashes. No emojis.

## Tests

File: `src/cli/commands/setup.test.ts`

Use `vi.hoisted` for all mocks (ESM-safe pattern used across the rest of the test suite).

```typescript
const { mockSelect, mockConfirm, mockPassword, mockExecSync, mockWriteFile } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockConfirm: vi.fn(),
  mockPassword: vi.fn(),
  mockExecSync: vi.fn(),
  mockWriteFile: vi.fn(),
}));

vi.mock('@inquirer/prompts', () => ({ select: mockSelect, confirm: mockConfirm, password: mockPassword, input: vi.fn() }));
vi.mock('child_process', () => ({ execSync: mockExecSync }));
vi.mock('fs/promises', () => ({ default: { mkdir: vi.fn(), writeFile: mockWriteFile } }));
vi.mock('../../config/paths.js', () => ({ CARINA_ENV_PATH: '/tmp/test-carina/.env', CARINA_HOME: '/tmp/test-carina' }));
vi.mock('../config/loader.js', () => ({ writeConfig: vi.fn() }));
```

Write these 6 tests:

1. `copilot: auto-fetches token via gh auth token when confirm=true` - mockExecSync returns `ghu_test123`, mockConfirm returns true; assert writeFile called with `GITHUB_TOKEN=ghu_test123`
2. `copilot: falls back to manual paste when gh fails` - mockExecSync throws; assert `mockPassword` is called and its value written as `GITHUB_TOKEN=...`
3. `copilot: writes DEFAULT_PROVIDER=github-copilot and DEFAULT_MODEL=gpt-4o` - verify .env lines
4. `copilot: skips connection test` - mockConfirm is never called with "Test provider" message
5. `deepseek path unchanged: writes DEEPSEEK_API_KEY` - regression check; mockSelect returns `deepseek`, mockPassword returns a key; assert `DEEPSEEK_API_KEY=...` in writeFile args
6. `setup mode=later: calls writeMinimalBootstrap and returns early` - mockSelect returns `later`, assert writeConfig called and writeFile not called with api key lines

Run: `npx vitest run src/cli/commands/setup.test.ts` - all 6 must pass.

## Validation after implementation

```bash
cd core.carinaai.uk
npx vitest run src/cli/commands/setup.test.ts
pnpm test   # full suite still green (no regressions)
```

Do not deploy. This is a local feature that ships with the npm package on next release.

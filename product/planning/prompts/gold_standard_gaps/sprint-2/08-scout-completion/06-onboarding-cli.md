# Prompt 06: Scout Onboarding Flow and CLI Setup

## Context

New Scout users see the dashboard but have no guidance on how to connect Carina, register
assets, or configure alerting. A first-run wizard and a `carina scout setup` CLI command
reduce friction from signup to first value.

## What to Build

### 1. First-run wizard (dashboard)

When a new account has no events and no connected agents, show a wizard overlay:

```
Step 1 of 4: Connect Carina
  Your Agent API URL: [__________________]
  Agent API Key: [__________________]
  [Test Connection]

Step 2 of 4: Register Assets
  Add the systems you want to monitor:
  [+ Add Asset] (hostname/IP, type, name)

Step 3 of 4: Configure Alerts
  Email for alerts: [lordsesame@gmail.com]
  Alert on: [x] Critical  [x] High  [ ] Medium  [ ] Low

Step 4 of 4: Done
  Scout is connected to Carina.
  3 assets registered.
  Alerts configured.
  [Go to Dashboard]
```

### 2. Wizard API

```
POST /api/setup/test-agent-connection    - test Carina API connectivity
POST /api/setup/register-assets           - bulk asset registration
POST /api/setup/configure-alerts          - set up default alert rules
GET  /api/setup/status                    - is setup complete?
```

Mark setup complete by setting `org.setup_complete = true` after Step 4.

### 3. `carina scout setup` CLI command

In `src/cli/scout.ts`, add a `setup` subcommand:
```typescript
scoutCmd
  .command('setup')
  .description('Interactive Scout setup wizard')
  .action(async () => {
    console.log('Carina Scout Setup\n');

    const scoutUrl = await input({ message: 'Scout dashboard URL:' });
    const apiKey = await input({ message: 'Scout API key (from dashboard):' });

    // Test connection
    const resp = await fetch(`${scoutUrl}/v1/score`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    if (!resp.ok) {
      console.error('Connection failed. Check URL and API key.');
      return;
    }

    // Save to .env
    await updateEnvFile('SCOUT_URL', scoutUrl);
    await updateEnvFile('SCOUT_API_KEY', apiKey);
    await updateEnvFile('LABYRINTH_ENABLED', 'true');

    console.log('Scout connected. Run `carina doctor` to verify.');
  });
```

Use `@inquirer/prompts` for interactive input: `pnpm add @inquirer/prompts`

### 4. `carina doctor` Scout checks

Add Scout connectivity to `carina doctor`:
```typescript
// In src/cli/system.ts
async function checkScout(): Promise<DoctorCheck> {
  const enabled = process.env.LABYRINTH_ENABLED === 'true';
  if (!enabled) return { name: 'scout', status: 'skip', message: 'LABYRINTH_ENABLED=false (disabled)' };

  try {
    const resp = await fetch(`${process.env.SCOUT_URL}/v1/score`, {
      headers: { Authorization: `Bearer ${process.env.SCOUT_API_KEY}` },
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) return { name: 'scout', status: 'ok', message: `Scout connected, score: ${(await resp.json()).score}` };
    return { name: 'scout', status: 'fail', message: `Scout returned ${resp.status}` };
  } catch (err) {
    return { name: 'scout', status: 'fail', message: `Scout unreachable: ${err}` };
  }
}
```

### 5. Account activation email

When a new Scout account is created, send an activation email with setup instructions:
```
Subject: Welcome to Labyrinth Scout

Click here to activate your account: [link]

After activation, run:
  carina scout setup

Or visit your dashboard at:
  https://console.labyrinthscout.com/dashboard
```

## Verification Checklist

- [ ] New account sees Step 1 wizard overlay on first dashboard visit
- [ ] "Test Connection" button shows success/error message inline
- [ ] Completing Step 4 dismisses wizard and shows dashboard
- [ ] `carina scout setup` prompts for URL and key, saves to .env, confirms connection
- [ ] `carina doctor` shows Scout check with current score or error message

## Files to Create or Modify

- CREATE `console.labyrinthscout.com/src/api/setup.ts`
- CREATE `console.labyrinthscout.com/public/setup-wizard.html`
- MODIFY `console.labyrinthscout.com/public/dashboard.html` - show wizard for new accounts
- MODIFY `src/cli/scout.ts` - add setup subcommand
- MODIFY `src/cli/system.ts` - add Scout check to doctor command
- MODIFY `console.labyrinthscout.com/src/api/account.ts` - send activation email

# Gap 02 - File 4: Hub CLI Commands

Agent: Claude Code (primary), Codex (fallback)
Estimated time: 2-3 hours

---

## Context

The Carina CLI already has a `hub` command wired in
`src/cli/registry.ts` at line 430:

```typescript
cmd('hub', 'Carina Hub marketplace (catalog, install, publish)', async (args) => {
  const { runHubCommand } = await import('./commands/hub-cli.ts');
  await runHubCommand(args);
}, { usage: 'carina hub <catalog|ecosystem|author|show|install|publish|status|start> [args]' });
```

The handler is `src/cli/commands/hub-cli.ts`. It already implements
these sub-commands:
- `start` - starts the hub server locally
- `browse` / `open` - prints the hub URL
- `status` / `registry` - shows hub summary
- `catalog` / `marketplace` - lists marketplace entries
- `show <id>` - shows a single marketplace entry
- `install <id>` / `enable` / `disable` / `update` / `remove` - manage
  installed entries
- `publish` - publishes a pack archive
- `ecosystem` - ecosystem metrics
- `author` - lists author packs

The MISSING sub-commands that need to be added:
- `search <query>` - thin wrapper over catalog with a query
- `info <name>` - alias for `show` using pack:<name> format
- `uninstall <name>` - alias for `remove`
- `list` - list only installed entries
- `outdated` - list installed entries where local version differs from
  hub version
- `login` - store an API key to a local config file
- `logout` - remove the stored API key

The hub client is `src/skills/hub/hub-client.ts` (10.7KB). Read it to
understand what methods are already available before writing new code.

---

## Step 1: Read these files first

1. `src/cli/commands/hub-cli.ts` - FULL file; understand the existing
   sub-command structure, how `action` and `rest` are parsed, and the
   import patterns used
2. `src/skills/hub/hub-client.ts` - full file; identify every exported
   function so you know what you can call without writing new client code
3. `src/cli/registry.ts` lines 425-440 - the `hub` command registration
   and its usage string (you must update the usage string at the end)
4. `src/skills/hub/marketplace-types.ts` - understand
   `MarketplaceEntry`, `MarketplaceEntryKind` to write correct type
   annotations

---

## Step 2: Add `search` sub-command

In `hub-cli.ts`, before the final `else` / unknown action handler, add:

```typescript
if (action === 'search') {
  const query = rest.slice(1).filter((a) => !a.startsWith('--')).join(' ');
  if (!query) {
    console.error('Usage: carina hub search <query>');
    process.exit(1);
  }
  try {
    const { entries } = await fetchHubMarketplace({ q: query });
    if (json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }
    await printCatalog(entries, `Search: "${query}"`);
  } catch {
    const { queryMarketplaceCatalog } = await import('../../skills/hub/marketplace-catalog.js');
    const local = await queryMarketplaceCatalog({ q: query });
    await printCatalog(local.entries, `Search (local): "${query}"`);
  }
  return;
}
```

---

## Step 3: Add `info` sub-command

`info` is the same as `show` but accepts a bare pack name and
auto-prepends `pack:`:

```typescript
if (action === 'info') {
  const raw = rest[1];
  if (!raw) {
    console.error('Usage: carina hub info <pack-name>');
    process.exit(1);
  }
  const id = raw.includes(':') ? raw : `pack:${raw}`;
  // Reuse show logic by delegating:
  await runHubCommand(['show', id, ...(json ? ['--json'] : [])]);
  return;
}
```

---

## Step 4: Add `uninstall` sub-command

`uninstall` is an alias for `remove`:

```typescript
if (action === 'uninstall') {
  const id = rest[1];
  if (!id) {
    console.error('Usage: carina hub uninstall <kind:slug>');
    process.exit(1);
  }
  await runHubCommand(['remove', id, ...(json ? ['--json'] : [])]);
  return;
}
```

---

## Step 5: Add `list` sub-command

List only installed entries. Check the `fetchHubMarketplace` return; each
entry has a `status` field. Filter for `status === 'installed'` or
`status === 'enabled'`:

```typescript
if (action === 'list') {
  try {
    const { entries } = await fetchHubMarketplace();
    const installed = entries.filter(
      (e) => e.status === 'installed' || e.status === 'enabled',
    );
    if (json) {
      console.log(JSON.stringify(installed, null, 2));
      return;
    }
    if (installed.length === 0) {
      console.log(chalk.gray('No installed hub entries. Run: carina hub install <kind:slug>'));
      return;
    }
    await printCatalog(installed, 'Installed');
  } catch {
    const { queryMarketplaceCatalog } = await import('../../skills/hub/marketplace-catalog.js');
    const local = await queryMarketplaceCatalog();
    const installed = local.entries.filter(
      (e) => e.status === 'installed' || e.status === 'enabled',
    );
    if (json) {
      console.log(JSON.stringify(installed, null, 2));
      return;
    }
    await printCatalog(installed, 'Installed (local)');
  }
  return;
}
```

---

## Step 6: Add `outdated` sub-command

Outdated means the locally stored version differs from the remote
version. We cannot compare versions without fetching both local state
and remote, so for now: fetch all installed entries, then for each one
fetch its remote detail and compare `entry.version`.

```typescript
if (action === 'outdated') {
  try {
    const { entries } = await fetchHubMarketplace();
    const installed = entries.filter(
      (e) => e.status === 'installed' || e.status === 'enabled',
    );
    const outdated: Array<{ id: string; local: string; remote: string }> = [];
    for (const entry of installed) {
      try {
        const remote = await fetchHubMarketplaceEntry(entry.id);
        if (remote.entry.version !== entry.version) {
          outdated.push({
            id: entry.id,
            local: entry.version,
            remote: remote.entry.version,
          });
        }
      } catch {
        // remote entry unavailable; skip
      }
    }
    if (json) {
      console.log(JSON.stringify(outdated, null, 2));
      return;
    }
    if (outdated.length === 0) {
      console.log(chalk.green('All installed hub entries are up to date.'));
      return;
    }
    console.log(chalk.bold('\nOutdated\n'));
    for (const o of outdated) {
      console.log(`  ${o.id.padEnd(32)} local=${o.local}  remote=${o.remote}`);
    }
    console.log(chalk.gray('\nRun: carina hub update <kind:slug>\n'));
  } catch {
    console.error(chalk.red('Could not reach hub to check for updates.'));
    process.exit(1);
  }
  return;
}
```

---

## Step 7: Add `login` and `logout` sub-commands

The login token is stored in `~/.carina/hub-token` (plain text, readable
only by owner). Read `CARINA_HOME` from env with fallback to
`~/.carina`.

```typescript
import os from 'os';
import fsp from 'fs/promises';
```

Add the imports at the top of hub-cli.ts if not already present.

```typescript
function hubTokenPath(): string {
  const home = process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina');
  return path.join(home, 'hub-token');
}

if (action === 'login') {
  const token = rest[1];
  if (!token) {
    console.error('Usage: carina hub login <api-token>');
    process.exit(1);
  }
  const tokenPath = hubTokenPath();
  await fsp.mkdir(path.dirname(tokenPath), { recursive: true });
  await fsp.writeFile(tokenPath, token, { mode: 0o600 });
  console.log(chalk.green('Hub token saved to ' + tokenPath));
  return;
}

if (action === 'logout') {
  try {
    await fsp.unlink(hubTokenPath());
    console.log(chalk.green('Hub token removed.'));
  } catch {
    console.log(chalk.gray('No hub token found.'));
  }
  return;
}
```

Also add a helper `readHubToken()` at the module level so other commands
can pick up the stored token:

```typescript
async function readHubToken(): Promise<string | undefined> {
  try {
    const raw = await fsp.readFile(hubTokenPath(), 'utf-8');
    return raw.trim() || undefined;
  } catch {
    return undefined;
  }
}
```

Export `readHubToken` so it can be used from `hub-client.ts` if needed.

---

## Step 8: Update the usage string in registry.ts

Find this line in `src/cli/registry.ts`:

```
usage: 'carina hub <catalog|ecosystem|author|show|install|publish|status|start> [args]',
```

Replace with:

```
usage: 'carina hub <catalog|search|browse|show|info|install|update|uninstall|list|outdated|publish|login|logout|status|start> [args]',
```

---

## Files to create or modify

| File | Action |
|---|---|
| `src/cli/commands/hub-cli.ts` | MODIFY (add 7 new sub-commands + helpers) |
| `src/cli/registry.ts` | MODIFY (update usage string only) |

No new files are needed.

---

## Done-when criteria

- [ ] `pnpm build` passes with no TypeScript errors
- [ ] `carina hub search property` prints matching entries from the
  local catalog or hub
- [ ] `carina hub info <pack-name>` shows the same output as
  `carina hub show pack:<pack-name>`
- [ ] `carina hub uninstall <kind:slug>` behaves identically to
  `carina hub remove <kind:slug>`
- [ ] `carina hub list` prints only installed entries (or "None" message)
- [ ] `carina hub outdated` runs without crashing when hub is offline
  (prints an error, exits 1)
- [ ] `carina hub login abc123` writes `abc123` to `~/.carina/hub-token`
  with mode 0o600
- [ ] `carina hub logout` removes the token file
- [ ] `pnpm test` still passes

---

## Do NOT do

- Do not add network calls not already backed by hub-client.ts
- Do not add an interactive prompt for the login token (accept it as a
  positional arg only)
- Do not modify hub-client.ts itself; all changes go into hub-cli.ts and
  registry.ts
- Do not change the behavior of any existing sub-commands

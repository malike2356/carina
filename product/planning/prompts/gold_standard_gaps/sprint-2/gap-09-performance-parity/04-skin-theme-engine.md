# Gap 09 - Prompt 04: Skin / Theme Engine for CLI

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement the behavior below in Carina's own voice. No competitor product names, labels, CLI text, UI copy, or config key names may appear verbatim in shipped code. Rename all user-visible elements to Carina equivalents before committing.


**Agent:** Claude Code (fallback: Cursor)
**Estimated hours:** 3-4 hrs
**Depends on:** Gap 07 TUI/CLI work done (Ink TUI and readline TUI running)

---

## The Problem

Carina's `src/ui/theme-store.ts` and `src/tools/theme.ts` handle web UI theming. The terminal
has no theming system at all. Hermes has a data-driven skin engine: spinner faces, banner colors,
tool prefix, and branding are all set by YAML config with zero code changes. Users can switch
themes with `/skin <name>` at runtime.

The behavioral reference ships 4 built-in skins. Carina ships its own equivalents:
`default` (Carina Blue), `sentinel` (Alert Red), `void` (no color), `stone` (muted grey).
Operators can define custom skins for white-label deployments.

This matters for Carina's commercial story: operators can brand the terminal experience without
forking the codebase.

---

## Read First

```
core.carinaai.uk/src/tui/ink/components/Banner.tsx          (from gap-07 - uses hard-coded colors)
core.carinaai.uk/src/tui/ink/components/StatusLine.tsx      (hard-coded cyan)
core.carinaai.uk/src/tui/                                   (TUI directory)
core.carinaai.uk/src/config/session-config.ts               (config loading)
core.carinaai.uk/src/cli/registry.ts                        (command registry for /skin command)
```

---

## 1. Skin Schema

```typescript
// src/tui/skins/skin-schema.ts  (new file)

export interface SpinnerSkin {
  /** Array of frames to cycle through. E.g. ['|', '/', '-', '\\'] */
  frames: string[];
  /** Ink color name for the spinner. E.g. "cyan", "red", "white" */
  color: string;
}

export interface CarinaThemeSkin {
  /** Skin identifier */
  name: string;
  /** Human-readable label */
  label: string;

  /** Colors */
  accent: string; // primary accent color (Ink color name)
  dimColor: string; // muted text (usually "grey" or "dim")
  successColor: string; // green, emerald, etc.
  errorColor: string; // red, rose, etc.
  warningColor: string; // yellow, orange, etc.

  /** Banner */
  bannerGradient: string | null; // ink-gradient name, or null for solid color
  bannerColor: string; // fallback solid color if gradient is null

  /** Spinner */
  spinner: SpinnerSkin;

  /** TUI prefix shown before Carina responses */
  responsePrefix: string; // e.g. "Carina", "A", "> "

  /** Tool call display prefix */
  toolPrefix: string; // e.g. "[tool]", "> ", ""

  /** Status bar style: "minimal", "full", "none" */
  statusBar: 'minimal' | 'full' | 'none';
}
```

---

## 2. Built-In Skins

```typescript
// src/tui/skins/built-in.ts  (new file)

import type { CarinaThemeSkin } from './skin-schema.js';

export const DEFAULT_SKIN: CarinaThemeSkin = {
  name: 'default',
  label: 'Default (Carina Blue)',
  accent: 'cyan',
  dimColor: 'grey',
  successColor: 'green',
  errorColor: 'red',
  warningColor: 'yellow',
  bannerGradient: 'rainbow',
  bannerColor: 'cyan',
  spinner: { frames: ['|', '/', '-', '\\'], color: 'cyan' },
  responsePrefix: 'Carina',
  toolPrefix: '[tool]',
  statusBar: 'full',
};

export const SENTINEL_SKIN: CarinaThemeSkin = {
  name: 'sentinel',
  label: 'Sentinel (Alert Red)',
  accent: 'red',
  dimColor: 'grey',
  successColor: 'green',
  errorColor: 'redBright',
  warningColor: 'yellowBright',
  bannerGradient: null,
  bannerColor: 'red',
  spinner: { frames: ['>', '>>', '>>>', '>>'], color: 'red' },
  responsePrefix: 'Ares',
  toolPrefix: '[!]',
  statusBar: 'full',
};

export const VOID_SKIN: CarinaThemeSkin = {
  name: 'void',
  label: 'Void (No Color)',
  accent: 'white',
  dimColor: 'white',
  successColor: 'white',
  errorColor: 'white',
  warningColor: 'white',
  bannerGradient: null,
  bannerColor: 'white',
  spinner: { frames: ['.', '..', '...', '....', '...', '..'], color: 'white' },
  responsePrefix: 'A',
  toolPrefix: '[t]',
  statusBar: 'minimal',
};

export const STONE_SKIN: CarinaThemeSkin = {
  name: 'stone',
  label: 'Stone (Muted Grey)',
  accent: 'blueBright',
  dimColor: 'grey',
  successColor: 'greenBright',
  errorColor: 'redBright',
  warningColor: 'yellowBright',
  bannerGradient: 'atlas',
  bannerColor: 'blueBright',
  spinner: { frames: ['◐', '◓', '◑', '◒'], color: 'blueBright' },
  responsePrefix: 'Carina',
  toolPrefix: '[>]',
  statusBar: 'full',
};

export const BUILT_IN_SKINS: Record<string, CarinaThemeSkin> = {
  default:  DEFAULT_SKIN,
  sentinel: SENTINEL_SKIN,
  void:     VOID_SKIN,
  stone:    STONE_SKIN,
};
```

---

## 3. Skin Store

```typescript
// src/tui/skins/skin-store.ts  (new file)

import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml'; // pnpm add yaml (already in most projects)
import { BUILT_IN_SKINS, DEFAULT_SKIN } from './built-in.js';
import type { CarinaThemeSkin } from './skin-schema.js';
import { getCarinaHome } from '../config/paths.js';

let activeSkin: CarinaThemeSkin = DEFAULT_SKIN;

export function getActiveSkin(): CarinaThemeSkin {
  return activeSkin;
}

export function setActiveSkin(nameOrSkin: string | CarinaThemeSkin): void {
  if (typeof nameOrSkin === 'string') {
    const resolved = resolveSkin(nameOrSkin);
    if (!resolved) throw new Error(`Unknown skin: "${nameOrSkin}". Use: ${listSkinNames().join(', ')}`);
    activeSkin = resolved;
    // Persist active skin name to config
    saveSkinPreference(nameOrSkin);
  } else {
    activeSkin = nameOrSkin;
  }
}

export function listSkinNames(): string[] {
  return [
    ...Object.keys(BUILT_IN_SKINS),
    ...loadCustomSkinNames(),
  ];
}

function resolveSkin(name: string): CarinaThemeSkin | null {
  if (BUILT_IN_SKINS[name]) return BUILT_IN_SKINS[name];
  return loadCustomSkin(name);
}

function loadCustomSkin(name: string): CarinaThemeSkin | null {
  const skinPath = path.join(getCarinaHome(), 'skins', `${name}.yaml`);
  if (!fs.existsSync(skinPath)) return null;
  try {
    const raw = fs.readFileSync(skinPath, 'utf-8');
    return { ...DEFAULT_SKIN, ...parseYaml(raw), name };
  } catch {
    return null;
  }
}

function loadCustomSkinNames(): string[] {
  const skinsDir = path.join(getCarinaHome(), 'skins');
  if (!fs.existsSync(skinsDir)) return [];
  return fs.readdirSync(skinsDir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace('.yaml', ''));
}

function saveSkinPreference(name: string): void {
  try {
    const configPath = path.join(getCarinaHome(), 'config.json');
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8') || '{}');
    cfg.skin = name;
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  } catch { /* non-fatal */ }
}

/**
 * Load skin from config on startup.
 */
export function initSkin(): void {
  try {
    const configPath = path.join(getCarinaHome(), 'config.json');
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8') || '{}');
    if (cfg.skin) setActiveSkin(cfg.skin);
  } catch { /* use default */ }
}
```

---

## 4. Wire Skin Into TUI Components

Modify the Ink components to use skin values:

```typescript
// src/tui/ink/components/Banner.tsx  (modified)
import { getActiveSkin } from '../../skins/skin-store.js';
import Gradient from 'ink-gradient';

export function Banner({ version, model, sessionId, onDone }: BannerProps) {
  const skin = getActiveSkin();
  // ...
  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      {skin.bannerGradient ? (
        <Gradient name={skin.bannerGradient}>
          <Text>{LOGO}</Text>
        </Gradient>
      ) : (
        <Text color={skin.bannerColor}>{LOGO}</Text>
      )}
      <Box marginTop={1}>
        <Text dimColor>v{version}  </Text>
        <Text color={skin.accent}>{model}</Text>
        <Text dimColor>  Session: {sessionId.slice(0, 8)}</Text>
      </Box>
    </Box>
  );
}
```

```typescript
// src/tui/ink/components/StatusLine.tsx  (modified)
import { getActiveSkin } from '../../skins/skin-store.js';

export function StatusLine({ sessionId, model, tokenCount, connected, streaming }: StatusLineProps) {
  const skin = getActiveSkin();
  if (skin.statusBar === 'none') return null;
  return (
    <Box borderTop paddingX={1} justifyContent="space-between">
      <Text dimColor>Session: <Text color={skin.accent}>{sessionId.slice(0, 8)}</Text></Text>
      {skin.statusBar === 'full' && (
        <Text dimColor>Model: <Text color={skin.accent}>{model}</Text></Text>
      )}
      <Text color={connected ? skin.successColor : skin.errorColor}>
        {connected ? (streaming ? 'Streaming' : 'Connected') : 'Disconnected'}
      </Text>
    </Box>
  );
}
```

---

## 5. /skin Command

Register as a slash command in the TUI:

```typescript
// src/cli/commands/skin-commands.ts  (new file)

import { setActiveSkin, listSkinNames, getActiveSkin } from '../../tui/skins/skin-store.js';
import { registry } from '../registry.js';

registry.register({
  name: 'skin',
  description: 'Switch the terminal color theme',
  args: [{ name: 'name', description: 'Skin name (omit to list available)' }],
  handler: ({ name }) => {
    if (!name) {
      const names = listSkinNames();
      const active = getActiveSkin().name;
      return names.map(n => `${n === active ? '* ' : '  '}${n}`).join('\n');
    }
    try {
      setActiveSkin(name);
      return `Skin set to "${name}" (takes effect on next render)`;
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});
```

---

## 6. Custom Skin YAML Example

Operators place a YAML file at `~/.carina/skins/verlox.yaml`:

```yaml
# ~/.carina/skins/verlox.yaml
label: Verlox Brand
accent: magenta
dimColor: grey
successColor: green
errorColor: red
warningColor: yellow
bannerGradient: passion
bannerColor: magenta
spinner:
  frames: ["V", "E", "R", "L", "O", "X"]
  color: magenta
responsePrefix: "Verlox AI"
toolPrefix: "[v]"
statusBar: full
```

Then `carina theme set verlox` switches to it. No code changes needed.

---

## Files to Create

```
core.carinaai.uk/src/tui/skins/skin-schema.ts
core.carinaai.uk/src/tui/skins/built-in.ts
core.carinaai.uk/src/tui/skins/skin-store.ts
core.carinaai.uk/src/cli/commands/skin-commands.ts
```

## Files to Modify

```
core.carinaai.uk/src/tui/ink/components/Banner.tsx      use skin colors
core.carinaai.uk/src/tui/ink/components/StatusLine.tsx  use skin colors
core.carinaai.uk/src/tui/ink/start.ts                   call initSkin() on startup
core.carinaai.uk/bin/carina.ts                          register skin commands
```

---

## Done When

- [ ] `carina /skin list` shows: default, ares, mono, slate, and any custom skins
- [ ] `carina /skin ares` switches to red bold theme on next render
- [ ] `carina /skin mono` disables all color
- [ ] Active skin name is saved to config and restored on next launch
- [ ] Placing a YAML file at `~/.carina/skins/custom.yaml` makes it appear in the list
- [ ] Custom YAML merges with DEFAULT_SKIN (missing keys fall back to default)
- [ ] Banner gradient renders with skin's bannerGradient value
- [ ] statusBar: 'none' hides the status bar entirely
- [ ] statusBar: 'minimal' shows only connection status (no tokens/model)
- [ ] spinner.frames are used by the Ink spinner component
- [ ] Unit test: resolveSkin('default') returns DEFAULT_SKIN
- [ ] Unit test: resolveSkin('unknown') returns null
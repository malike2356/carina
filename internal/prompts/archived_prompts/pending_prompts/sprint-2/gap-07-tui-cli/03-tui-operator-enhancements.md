# Gap 07 - Prompt 03: Operator TUI Enhancements

**Agent:** Claude Code
**Estimated hours:** 3-4 hrs
**Depends on:** Existing readline TUI (`src/tui/`) - does NOT require Ink TUI from 01

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
core.carinaai.uk/src/tui/             (14 files, 42KB - existing readline TUI)
core.carinaai.uk/src/tui/tui.ts       (main TUI entry)
core.carinaai.uk/src/tui/panels/      (existing panel system if any)
core.carinaai.uk/src/security/shield-report.ts
core.carinaai.uk/src/memory/
core.carinaai.uk/src/skills/
core.carinaai.uk/src/agents/orchestrator.ts
```

---

## Context

The readline TUI is the "operator mode" - used when running Carina headlessly on a server or via SSH. It shows raw event streams and has basic keyboard controls. This prompt enhances it with proper panels (Scout, Memory, Skills, Log Tail) and F-key shortcuts, making it a real operator console without replacing the readline base.

This is NOT an Ink rewrite. All additions are to the existing readline-based TUI.

---

## 1. Panel Manager (`src/tui/panels/panel-manager.ts`)

The existing TUI probably renders as a single stream. Add a two-zone layout: main event stream on the left, switchable panel on the right.

```typescript
import * as readline from 'readline';
import * as process from 'process';

export type PanelType = 'scout' | 'memory' | 'skills' | 'logs' | 'none';

export class PanelManager {
  private activePanelType: PanelType = 'none';
  private termWidth = process.stdout.columns || 120;
  private termHeight = process.stdout.rows || 30;

  private mainWidth: number;
  private panelWidth: number;

  constructor() {
    this.mainWidth = Math.floor(this.termWidth * 0.65);
    this.panelWidth = this.termWidth - this.mainWidth - 1;

    process.stdout.on('resize', () => {
      this.termWidth = process.stdout.columns;
      this.termHeight = process.stdout.rows;
      this.mainWidth = Math.floor(this.termWidth * 0.65);
      this.panelWidth = this.termWidth - this.mainWidth - 1;
      this.render();
    });
  }

  setPanel(type: PanelType) {
    this.activePanelType = type;
    this.render();
  }

  togglePanel(type: PanelType) {
    this.activePanelType = this.activePanelType === type ? 'none' : type;
    this.render();
  }

  private render() {
    // Clear and redraw using ANSI escape codes
    // Use cursor positioning to draw panel alongside event stream
    // This is a simplified version - full implementation uses term-kit or blessed
    process.stdout.write('\x1b[2J\x1b[H'); // clear screen
    this.drawDivider();
    this.drawPanelHeader();
    this.drawPanelContent();
  }

  private drawDivider() {
    const col = this.mainWidth + 1;
    for (let row = 1; row <= this.termHeight; row++) {
      process.stdout.write(`\x1b[${row};${col}H│`); // vertical bar
    }
  }

  private drawPanelHeader() {
    if (this.activePanelType === 'none') return;
    const title = {
      scout: 'SCOUT SECURITY',
      memory: 'MEMORY',
      skills: 'SKILLS',
      logs: 'LOG TAIL',
    }[this.activePanelType];
    const col = this.mainWidth + 3;
    process.stdout.write(`\x1b[1;${col}H\x1b[33m[${title}]\x1b[0m`);
  }

  private drawPanelContent() {
    // Delegate to panel-specific renderer
    // Each panel: getLines(width, height) → string[]
  }
}
```

### Simpler approach: use `blessed` or `term-kit`

If the existing TUI already uses a library, extend it. If it's raw readline, use `neo-blessed`:

```bash
pnpm add neo-blessed
```

Then build panels as `blessed.box()` elements positioned on the right side.

---

## 2. Scout Security Panel (`src/tui/panels/scout-panel.ts`)

```typescript
import { getShieldReport } from '../../security/shield-report';

export class ScoutPanel {
  async getLines(width: number, height: number): Promise<string[]> {
    const report = await getShieldReport();
    const lines: string[] = [];

    // Trust score
    const score = report.trustScore;
    const scoreColor = score >= 90 ? '\x1b[32m' : score >= 70 ? '\x1b[33m' : '\x1b[31m';
    lines.push(`${scoreColor}Trust Score: ${score}/100\x1b[0m`);
    lines.push('');

    // Kill switch
    if (report.killSwitchActive) {
      lines.push('\x1b[41m\x1b[37m KILL SWITCH ACTIVE \x1b[0m');
      lines.push(`Triggered: ${report.killSwitchReason}`);
      lines.push('');
    }

    // Recent events (last 8)
    lines.push('\x1b[90mRecent Events:\x1b[0m');
    for (const event of report.recentEvents.slice(0, 8)) {
      const severity = event.severity === 'critical' ? '\x1b[31m' :
                       event.severity === 'warning' ? '\x1b[33m' : '\x1b[90m';
      const time = new Date(event.timestamp).toLocaleTimeString();
      const msg = event.summary.slice(0, width - 12);
      lines.push(`${severity}[${event.severity.slice(0,4).toUpperCase()}]\x1b[0m ${time} ${msg}`);
    }

    return lines.slice(0, height - 2);
  }
}
```

## 3. Memory Panel (`src/tui/panels/memory-panel.ts`)

```typescript
export class MemoryPanel {
  async getLines(width: number, height: number): Promise<string[]> {
    // GET /memory/recent → list of recent memory entries
    const memories = await fetchRecentMemories(20);
    const lines: string[] = [];

    lines.push('\x1b[90mRecent Memories:\x1b[0m');
    lines.push('');

    for (const mem of memories) {
      const age = formatAge(mem.createdAt);
      const content = mem.content.slice(0, width - 10);
      lines.push(`\x1b[36m${age}\x1b[0m ${content}`);
      if (mem.tags?.length) {
        const tags = mem.tags.map((t: string) => `#${t}`).join(' ');
        lines.push(`  \x1b[90m${tags}\x1b[0m`);
      }
      lines.push('');
    }

    return lines.slice(0, height - 2);
  }
}
```

## 4. Skills Panel (`src/tui/panels/skills-panel.ts`)

```typescript
export class SkillsPanel {
  async getLines(width: number, height: number): Promise<string[]> {
    const skills = await fetchInstalledSkills();
    const lines: string[] = [];

    lines.push(`\x1b[90mInstalled Skills (${skills.length}):\x1b[0m`);
    lines.push('');

    for (const skill of skills) {
      const status = skill.enabled ? '\x1b[32m[ON]\x1b[0m' : '\x1b[90m[OFF]\x1b[0m';
      const name = skill.name.slice(0, width - 12);
      lines.push(`${status} \x1b[37m${name}\x1b[0m`);
      lines.push(`     \x1b[90m${skill.description?.slice(0, width - 6) || ''}\x1b[0m`);
    }

    return lines.slice(0, height - 2);
  }
}
```

## 5. Log Tail Panel (`src/tui/panels/log-panel.ts`)

```typescript
import { tail } from 'tail';

export class LogPanel {
  private lines: string[] = [];
  private maxLines = 200;

  startTailing(logPath: string) {
    const t = new tail(logPath, { follow: true });
    t.on('line', (line: string) => {
      this.lines.push(line);
      if (this.lines.length > this.maxLines) {
        this.lines.shift();
      }
    });
  }

  getLines(width: number, height: number): string[] {
    return this.lines
      .slice(-(height - 2))
      .map(line => line.slice(0, width));
  }
}
```

---

## 6. F-Key Shortcuts

Add to the main TUI input handler:

```typescript
// In src/tui/tui.ts - extend the keypress handler

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.on('keypress', (str, key) => {
  if (!key) return;

  switch (key.name) {
    case 'f1':
      panelManager.togglePanel('scout');
      break;
    case 'f2':
      panelManager.togglePanel('memory');
      break;
    case 'f3':
      panelManager.togglePanel('skills');
      break;
    case 'f4':
      panelManager.togglePanel('logs');
      break;
    case 'f5':
      panelManager.setPanel('none');
      break;
    case 'f10':
      gracefulShutdown();
      break;
  }
});
```

F-key reference shown in bottom status bar:
```
[F1] Scout  [F2] Memory  [F3] Skills  [F4] Logs  [F5] Close Panel  [F10] Quit
```

---

## 7. Status Bar (`src/tui/status-bar.ts`)

Sticky bottom line (ANSI cursor positioning):

```typescript
export function renderStatusBar(state: {
  sessionId: string;
  model: string;
  trustScore: number;
  tokenCount: number;
  activeAgents: number;
}) {
  const { rows, columns } = process.stdout;
  const scoreColor = state.trustScore >= 90 ? '\x1b[32m' :
                     state.trustScore >= 70 ? '\x1b[33m' : '\x1b[31m';

  const parts = [
    `Session: ${state.sessionId.slice(0, 8)}`,
    `Model: ${state.model}`,
    `${scoreColor}Trust: ${state.trustScore}\x1b[0m`,
    `Tokens: ${state.tokenCount.toLocaleString()}`,
    state.activeAgents > 0 ? `\x1b[35mAgents: ${state.activeAgents}\x1b[0m` : '',
    '[F1-F4] Panels  [Ctrl+A] Agents  [Ctrl+Q] Quit',
  ].filter(Boolean).join('  |  ');

  // Position at bottom row
  process.stdout.write(`\x1b[${rows};0H\x1b[90m${parts.slice(0, columns)}\x1b[0m`);
}
```

---

## Files to Create

```
core.carinaai.uk/src/tui/
├── panels/
│   ├── panel-manager.ts
│   ├── scout-panel.ts
│   ├── memory-panel.ts
│   ├── skills-panel.ts
│   └── log-panel.ts
└── status-bar.ts
```

## Files to Modify

```
src/tui/tui.ts    → import PanelManager, add F-key handler, render status bar
```

---

## Done When

- [ ] Pressing F1 opens Scout panel on the right showing trust score and recent events
- [ ] Pressing F2 opens Memory panel showing recent memory entries
- [ ] Pressing F3 opens Skills panel showing installed skill packs
- [ ] Pressing F4 opens Log Tail panel streaming the Carina log file
- [ ] Pressing F5 closes whatever panel is open
- [ ] Pressing the same F-key again closes that panel (toggle behavior)
- [ ] Status bar at bottom shows session ID, model, trust score, token count, and agent count
- [ ] Terminal resize updates panel and status bar correctly
- [ ] F-key help is always visible in the status bar

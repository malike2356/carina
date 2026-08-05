# Carina TUI & CLI; Gold Standard Upgrade

> **REUSE RULE:** See `../REUSE-RULES.md`. This document benchmarks behavior against competitor agents. The implementation must match the quality and capability described, but use Carina's own voice, naming, and presentation throughout.


**Date:** 2026-06-17 (revised 2026-06-18)
**Purpose:** Make Carina's TUI and CLI the new gold standard, absorbing ALL features from Hermes, OpenClaw, and Odysseus, plus native Scout integration
**Reference agents:** Hermes (202 TUI files, 14K-line CLI), OpenClaw (37 TUI files, 265 CLI files), Odysseus (web-only)
**Existing code:** `src/tui/` (14 files, 42KB), `src/cli/` (10+ files, 91KB+)
**Target:** Carina TUI + CLI must exceed all reference agents in every category

> IMPORTANT UPDATES (2026-06-18):
>
> ONBOARDING (second half of Gap 7) is partially done:
>   cli/first-run.ts; First-run detection and setup flow - BUILT
>   cli/first-run-onboarding.ts; Onboarding experience - BUILT
>   cli/onboarding-gateway.ts; Gateway onboarding - BUILT
>   cli/provider-bootstrap.ts; Provider setup - BUILT
>   These reduce the onboarding phase by ~2 weeks.
>
> SHELL COMPLETIONS are partially done:
>   cli/completion-metadata.ts; Completion metadata for fish/zsh/bash - BUILT
>   This reduces the completions section by ~3-4 days.
>
> TUI EXISTING: The current `src/tui/` uses readline (not Ink). 14 files, 42KB.
>   app.ts; main TUI loop
>   commands.ts; TUI commands
>   data-provider.ts; data bridging
>   slash-commands.ts; slash handling
>   task-actions.ts; task operations
>   terminal.ts; terminal management
>   layout.ts, views.ts; layout + views
>   log-buffer.ts; log buffering
>   The recommendation: KEEP readline for operator mode, build Ink for new chat TUI mode.
>
> CLI DIRECTORIES:
>   cli/commands/; command modules (sub-commands)
>   cli/config/; config sub-commands
>   cli/local/; local mode commands
>   cli/output/; output formatting
>   Use these patterns when adding new commands.

---

## ARCHITECTURE DECISION

### Two-Pronged Approach

Carina will have **TWO TUI modes** and **TWO CLI modes**, selectable by flag:

```
carina tui              → Full Chat TUI (Hermes Ink/React pattern)
carina tui --operator   → Operator Dashboard (existing, enhanced)

carina                  → Interactive Chat CLI (Hermes prompt_toolkit pattern)
carina cli              → Command CLI (OpenClaw command-tree pattern, existing enhanced)
```

### Technology Stack

```
TUI (Chat Mode):
  Framework: Ink 5 (React for terminal)
  Transport: JSON-RPC over stdio to Carina Gateway
  State: nanostores
  Streaming: SSE parser
  Styling: Ink theming + 256-color support

TUI (Operator Mode):
  Framework: Existing readline (enhance with blessed/blessed-contrib)
  Transport: Direct imports (same process)
  
CLI (Interactive):
  Framework: @inquirer/prompts (already in use in index.ts)
  Formatting: chalk + gradient-string + boxen
  Autocomplete: Custom fuzzy matcher

CLI (Command):
  Framework: Existing registry.ts (75 commands, expand to 150+)
  Formatting: chalk tables, JSON output mode
  Shell completions: fish, zsh, bash
```

---

## PART 1; TUI CHAT MODE (from Hermes)

### 1.1 Core Transport Layer

Adopt Hermes' JSON-RPC over stdio transport:

```typescript
// src/tui/transport/json-rpc.ts
// Bidirectional JSON-RPC over stdio
// Request/response pattern with message IDs
// Event streaming from server → client
// Reconnection with state recovery

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

// Methods:
// prompt.submit      → submit user message
// session.list       → list sessions
// session.resume     → resume session
// slash.exec         → execute slash command
// approval.respond   → respond to approval request
// clarify.respond    → respond to clarification
// model.list         → list available models
// model.switch       → switch active model
// scout.status       → get Scout status
// scout.trust        → get trust score
// scout.events       → get security events
```

**Study reference:** `hermes-agent/ui-tui/src/gatewayClient.ts`, `hermes-agent/tui_gateway/server.py`

### 1.2 Streaming Engine

```typescript
// src/tui/streaming/assembler.ts
// Token-by-token streaming display
// SSE protocol parser
// Handles: message.delta, message.complete, tool.start, tool.progress, tool.complete

interface StreamEvent {
  type: 'message.delta' | 'message.complete' | 'tool.start' | 'tool.progress' | 'tool.complete' | 'error';
  data: unknown;
}

class StreamAssembler {
  private buffer = '';
  private currentMessage = '';
  private activeTools: Map<string, ToolState> = new Map();

  feed(chunk: string): StreamEvent[] { /* ... */ }
  getCurrentMessage(): string { /* ... */ }
  getActiveTools(): ToolState[] { /* ... */ }
}
```

**Study reference:** `openclaw/src/tui/tui-stream-assembler.ts`, `hermes-agent/ui-tui/src/components/streamingAssistant.tsx`

### 1.3 Chat Components (26 components from Hermes)

```
src/tui/chat/
├── ChatApp.tsx; main app shell (from Hermes app.tsx)
├── MessageLine.tsx; single message with role styling
├── StreamingAssistant.tsx; live token-by-token display
├── StreamingMarkdown.tsx; markdown with syntax highlighting
├── UserMessage.tsx; user message display
├── SystemMessage.tsx; system notifications
├── Thinking.tsx; tool activity with animated spinner
├── ToolCall.tsx; individual tool call (name, args, result)
├── ToolResult.tsx; collapsible tool output
├── Markdown.tsx; rendered markdown (code blocks, tables, lists)
├── CodeBlock.tsx; syntax highlighted code with language detection
├── PromptOverlay.tsx; modal overlay container
├── ApprovalPrompt.tsx; confirm/deny for dangerous ops
├── ClarifyPrompt.tsx; agent needs clarification
├── SudoPrompt.tsx; elevated access request
├── SecretPrompt.tsx; masked input for secrets
├── HelpHint.tsx; contextual keyboard shortcuts
├── QueuedMessages.tsx; pending message queue
├── Composer.tsx; text input with autocomplete
├── SlashPopover.tsx; slash command suggestions
├── AtMentionPopover.tsx; @-mention suggestions
├── ModelPicker.tsx; model selection with cost warnings
├── SkillsHub.tsx; skills browser with search
├── PluginsHub.tsx; plugins browser
├── AgentsOverlay.tsx; subagent management
├── TodoPanel.tsx; task list
├── Branding.tsx; ASCII art logo + branding
├── ActiveSessionSwitcher.tsx; session list + switch
├── FpsOverlay.tsx; debug FPS counter
├── PerfPane.tsx; performance metrics
```

**Study reference:** `hermes-agent/ui-tui/src/components/*.tsx`

### 1.4 TUI Hooks & State

```typescript
// src/tui/hooks/
├── useGateway.ts; JSON-RPC connection management
├── useStreaming.ts; stream event handling
├── useSession.ts; session lifecycle
├── useComposer.ts; input state + autocomplete
├── useSlashCommands.ts; command registry + execution
├── useModelPicker.ts; model selection state
├── useToolActivity.ts; active tool tracking
├── useApproval.ts; approval prompt state
├── useScrollback.ts; virtual scroll for history
├── useKeyboard.ts; global keyboard shortcuts
├── useTheme.ts; theme/token management
└── useScout.ts; Scout integration hook
```

### 1.5 Styling & Theme Engine

Adopt Hermes' skin engine concept for TUI:

```typescript
// src/tui/theme/
├── tokens.ts; color palette, spacing, borders
├── skins/
│   ├── default.ts; dark Carina theme
│   ├── light.ts; light theme
│   ├── retro.ts; green phosphor theme
│   └── scout.ts; Scout-branded theme (red/black)
├── faces.ts; ASCII spinner faces
├── verbs.ts; action verbs for spinners
└── branding.ts; logo variants
```

### 1.6 Keyboard Shortcuts

```
Ctrl+N; new session
Ctrl+L; clear screen
Ctrl+R; retry last message
Ctrl+P; model picker
Ctrl+K; skills hub
Ctrl+J; toggle todo panel
Ctrl+[/]; prev/next session
Ctrl+Shift+K; kill active subagent
Ctrl+Shift+S; Scout status overlay
Ctrl+Shift+E; Scout security events
Esc; close overlay
Tab; autocomplete
↑/↓; navigate history/autocomplete
```

---

## PART 2; TUI OPERATOR MODE (Carina enhanced + OpenClaw)

### 2.1 Enhanced Multiview Dashboard

Expand existing 3 views to 8 views:

```
Views:
  1. Sessions; session list with search, status, context %
  2. Chat; live chat with streaming (from Chat TUI)
  3. Agents; subagent/orchestrator status (NEW)
  4. Scout; trust score, events, kill switch (NEW, gated)
  5. Tasks; kanban board + cron jobs (enhanced)
  6. Resources; CPU, memory, disk, token usage (NEW)
  7. Logs; live log tail with filtering (enhanced)
  8. Help; keyboard shortcuts + command reference
```

### 2.2 Operator Navigation

```
Tab / Shift+Tab; cycle views
1-8; jump to view
j/k or ↑/↓; navigate items
Enter; select / expand
/; search/filter within view
:; command mode (vim-style)
q; quit
```

### 2.3 Gateway Chat Mode (from OpenClaw)

Connect TUI to a remote Carina instance:

```typescript
// src/tui/operator/gateway-chat.ts
// Connect to remote Carina Gateway via WebSocket
// Authenticate with API token
// Stream responses from remote instance
// Local display with remote processing

carina tui --connect https://carina.example.com --token <api_key>
carina tui --connect ws://192.168.1.100:4001
```

**Study reference:** `openclaw/src/tui/gateway-chat.ts`

### 2.4 Hyperlinks (from OpenClaw OSC8)

```typescript
// src/tui/operator/hyperlinks.ts
// OSC8 escape sequences for clickable links in terminal
// Supported in: iTerm2, Terminal.app, Windows Terminal, kitty, WezTerm
// Format: \x1b]8;{url}\x1b\\{text}\x1b]8;\x1b\\

function osc8Link(url: string, text: string): string {
  return `\x1b]8;${url}\x1b\\${text}\x1b]8;\x1b\\`;
}
```

**Study reference:** `openclaw/src/tui/osc8-hyperlinks.ts`

### 2.5 Fuzzy Search (from OpenClaw)

```typescript
// src/tui/operator/fuzzy-filter.ts
// Fuse.js or custom fuzzy matcher
// Applied to: sessions, skills, plugins, models, docs

function fuzzyFilter<T>(items: T[], query: string, keys: string[]): T[] {
  // Returns items ranked by fuzzy match score
}
```

**Study reference:** `openclaw/src/tui/components/fuzzy-filter.ts`

### 2.6 External Editor (from OpenClaw)

```typescript
// src/tui/operator/external-editor.ts
// Open $EDITOR for long messages
// Ctrl+X to open editor with current composer content
// Returns edited text to composer

async function openExternalEditor(initialContent: string): Promise<string> {
  const editor = process.env.EDITOR || process.env.VISUAL || 'nano';
  // Write temp file → spawn editor → read result → clean up
}
```

**Study reference:** `openclaw/src/tui/components/custom-editor.ts`

---

## PART 3; SCOUT INTEGRATION IN TUI

### 3.1 Scout View (Operator Mode)

```typescript
// src/tui/operator/views/scout.ts

interface ScoutViewState {
  trustScore: number; // 0-100 overall trust score
  activeThreats: number; // active security threats
  eventsLast24h: number; // events in last 24 hours
  killSwitchStatus: 'armed' | 'disarmed' | 'triggered';
  shieldStatus: 'active' | 'degraded' | 'offline';
  monitoredAgents: number; // agents under Scout watch
  lastAuditTimestamp: string;
  complianceScore: number; // trust compliance score
}

function renderScoutView(state: ScoutViewState): string[] {
  // Rich dashboard with color-coded metrics
  // Red/Amber/Green status indicators
  // Event timeline
  // Threat severity distribution
  // Agent trust score table
}
```

### 3.2 Scout Overlay (Chat Mode)

```typescript
// Ctrl+Shift+S toggles Scout overlay
// Shows compact status bar at top of chat:
// [Scout: Trust 87/100 | 2 threats | Shield: ACTIVE | Kill Switch: ARMED]
```

### 3.3 Scout Commands

```
/scout status; full Scout dashboard
/scout trust [agent]; trust score for agent
/scout events; recent security events
/scout threats; active threats
/scout audit; run security audit
/scout shield on|off; toggle shield
/scout killswitch; arm/disarm kill switch
/scout report; generate security report
```

### 3.4 Scout Access Gating

```typescript
// Scout features are gated behind Scout subscription
// Check access before rendering Scout views/commands

async function hasScoutAccess(): Promise<boolean> {
  // Check: user has active Scout subscription
  // Check: tenant has Scout provisioned
  // Check: Scout client is configured and reachable
  const billing = await getWorkspaceBilling();
  return billing.scoutAccess === 'active';
}

// In TUI:
if (await hasScoutAccess()) {
  registerView('scout', renderScoutView);
  registerCommands(SCOUT_COMMANDS);
}
```

**Study reference:** Carina's own `security/scout-client.ts`, `security/scout-context.ts`, `billing/tenant-scout.ts`

---

## PART 4; CLI INTERACTIVE MODE (from Hermes + OpenClaw)

### 4.1 Interactive Chat CLI

```typescript
// src/cli/interactive/chat.ts
// Full interactive chat experience in the terminal
// Pattern: Hermes prompt_toolkit but in Node.js using @inquirer + readline

Features:
  - Rich banner on startup
  - Prompt with model name and session indicator
  - Streaming responses inline
  - Tool call display with progress
  - Slash commands with Tab autocomplete
  - @-mention autocomplete for sessions/agents
  - History navigation (↑/↓)
  - Multi-line input (Alt+Enter or \\ for continuation)
  - Model switching via /model command
  - Session management via /new, /resume, /list
  - Scout integration via /scout commands
```

```typescript
// src/cli/interactive/prompt.ts
// Custom prompt display:
// carina [claude-sonnet-4] session-abc123 > _

function buildPrompt(modelName: string, sessionId: string, scoutStatus?: string): string {
  const parts: string[] = [];
  parts.push(chalk.cyan('carina'));
  parts.push(chalk.gray(`[${modelName}]`));
  parts.push(chalk.dim(sessionId.slice(0, 8)));
  if (scoutStatus) {
    parts.push(chalk.red(`[Scout:${scoutStatus}]`));
  }
  parts.push(chalk.green('>'));
  return parts.join(' ') + ' ';
}
```

### 4.2 Streaming Output in CLI

```typescript
// src/cli/interactive/streaming-output.ts
// Overwrite current line with streaming response
// Token-by-token display in the terminal
// Tool calls: inline status with spinner, replace with result on completion

class CliStreamingOutput {
  private currentLine = '';

  writeDelta(token: string): void {
    // Append token to current output
    this.currentLine += token;
    process.stdout.write(token);
  }

  writeToolStart(name: string): void {
    // Show spinner: ⏳ Running tool_name...
    const spinner = frames[frameIndex % frames.length];
    process.stdout.write(`\r${spinner} ${chalk.yellow(name)}...`);
  }

  writeToolComplete(name: string, result: string): void {
    // Replace spinner with result preview
    process.stdout.write(`\r${chalk.green('')} ${name}: ${truncate(result, 80)}\n`);
  }

  writeMessageComplete(): void {
    // Finalize message
    process.stdout.write('\n');
    this.currentLine = '';
  }
}
```

### 4.3 CLI Autocomplete System

```typescript
// src/cli/interactive/autocomplete.ts

interface CompletionSource {
  // Slash commands
  commands: () => Promise<string[]>;
  // File paths
  files: (partial: string) => Promise<string[]>;
  // Session IDs
  sessions: (partial: string) => Promise<string[]>;
  // Model names
  models: () => Promise<string[]>;
  // Skill names
  skills: (partial: string) => Promise<string[]>;
  // @-mentions (agents, sessions)
  mentions: (partial: string) => Promise<string[]>;
}

// Trigger rules:
// / → complete slash commands
// @ → complete mentions
// default → complete from history
```

### 4.4 CLI Styling & Banner

```typescript
// src/cli/interactive/banner.ts
// Rich ASCII art banner on startup
// Shows: Carina logo, version, active profile, model, Scout status

function renderBanner(state: CliBannerState): string {
  return `
${chalk.cyan(ASCII_LOGO)}
${chalk.gray('Carina AI · v2.0.0')}
${chalk.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
${chalk.white('Profile:')}  ${chalk.green(state.profileName)}
${chalk.white('Model:')}    ${chalk.yellow(state.modelName)}
${chalk.white('Provider:')} ${chalk.magenta(state.providerName)}
${state.scoutAccess ? chalk.white('Scout:') + '    ' + chalk.red('ACTIVE · Trust ' + state.trustScore + '/100') : ''}
${chalk.white('Tools:')}    ${chalk.gray(state.toolCount + ' available')}
${chalk.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
`;
}
```

---

## PART 5; CLI COMMAND MODE (from OpenClaw + Carina enhanced)

### 5.1 Command Tree Expansion

Expand from 75 commands to 150+ commands. Adopt OpenClaw's command group pattern:

```
carina
├── agent
│   ├── agent chat; interactive chat CLI
│   ├── agent tui; launch TUI
│   ├── agent tui --operator; launch operator TUI
│   ├── agent run <prompt>; one-shot agent run
│   ├── agent list; list configured agents
│   └── agent create <name>; create new agent
├── gateway
│   ├── gateway start; start gateway
│   ├── gateway stop; stop gateway
│   ├── gateway restart; restart gateway
│   ├── gateway status; gateway health + status
│   ├── gateway logs; view gateway logs
│   └── gateway install; install as system service
├── daemon
│   ├── daemon install; install launchd/systemd service
│   ├── daemon uninstall; remove service
│   ├── daemon start; start daemon
│   ├── daemon stop; stop daemon
│   ├── daemon restart; restart daemon
│   └── daemon status; daemon health
├── session
│   ├── session list; list sessions
│   ├── session resume <id>; resume session
│   ├── session delete <id>; delete session
│   ├── session export <id>; export as markdown
│   └── session search <query>; search sessions
├── model
│   ├── model list; list available models
│   ├── model switch <name>; switch active model
│   ├── model info <name>; model details + pricing
│   └── model default <name>; set default model
├── skill
│   ├── skill list; list installed skills
│   ├── skill info <name>; skill details
│   ├── skill install <source>; install skill
│   ├── skill uninstall <name>; remove skill
│   ├── skill update <name>; update skill
│   ├── skill create <path>; create new skill
│   ├── skill validate <path>; validate skill format
│   └── skill publish <name>; publish to CarinaHub
├── hub
│   ├── hub search <query>; search CarinaHub
│   ├── hub info <name>; skill details from hub
│   ├── hub install <name>; install from hub
│   └── hub login; authenticate with hub
├── plugin
│   ├── plugin list; list installed plugins
│   ├── plugin install <source>; install plugin
│   ├── plugin uninstall <name>; remove plugin
│   ├── plugin update <name>; update plugin
│   ├── plugin search <query>; search available plugins
│   └── plugin info <name>; plugin details
├── cron
│   ├── cron list; list cron jobs
│   ├── cron create; create cron job
│   ├── cron edit <id>; edit cron job
│   ├── cron delete <id>; delete cron job
│   ├── cron pause <id>; pause job
│   ├── cron resume <id>; resume job
│   └── cron run <id>; run job now
├── config
│   ├── config show; show current config
│   ├── config get <key>; get config value
│   ├── config set <key> <value>; set config value
│   ├── config edit; open config in editor
│   └── config validate; validate config
├── doctor
│   ├── doctor; run diagnostics
│   ├── doctor --fix; auto-repair
│   ├── doctor config; check config
│   ├── doctor state; check state integrity
│   ├── doctor permissions; check file permissions
│   └── doctor network; check connectivity
├── security
│   ├── security audit; run security audit
│   ├── security advisories; check advisories
│   └── security doctor; security-focused repair
├── scout                           GATED BEHIND SCOUT ACCESS 
│   ├── scout status; Scout dashboard
│   ├── scout trust [agent]; trust score
│   ├── scout events; security events
│   ├── scout threats; active threats
│   ├── scout audit; run Scout audit
│   ├── scout shield on|off; toggle shield
│   ├── scout killswitch arm|disarm; arm/disarm kill switch
│   └── scout report; generate report
├── message
│   ├── message send <target> <text>; send to channel
│   └── message broadcast <text>; broadcast to all
├── backup
│   ├── backup create; create backup
│   ├── backup restore <file>; restore from backup
│   └── backup list; list backups
├── update
│   ├── update check; check for updates
│   ├── update install; install update
│   └── update changelog; view changelog
├── setup
│   ├── setup; run setup wizard
│   ├── setup provider; configure provider
│   └── setup channel; configure channel
├── profile
│   ├── profile list; list profiles
│   ├── profile create <name>; create profile
│   ├── profile switch <name>; switch profile
│   ├── profile delete <name>; delete profile
│   └── profile clone <name>; clone profile
├── workspace
│   ├── workspace init; initialize workspace
│   └── workspace info; workspace details
└── version; version info
```

### 5.2 JSON Output Mode (from OpenClaw)

```typescript
// All CLI commands support --json flag for machine-readable output
// carina agent list --json
// carina model info claude-sonnet-4 --json
// carina scout status --json

interface CliOutput {
  mode: 'pretty' | 'json';
  print(data: unknown): void;
  table(rows: Record<string, unknown>[]): void;
}
```

**Study reference:** `openclaw/src/cli/json-output-mode.ts`

### 5.3 Shell Completions (from OpenClaw)

Generate completions for fish, zsh, and bash:

```bash
# carina completion fish > ~/.config/fish/completions/carina.fish
# carina completion zsh > ~/.zsh/completions/_carina
# carina completion bash > /etc/bash_completion.d/carina
```

```typescript
// src/cli/completions/
├── fish.ts; fish shell completions
├── zsh.ts; zsh completions
└── bash.ts; bash completions

// Auto-generated from command registry
// carina completion generate --shell fish|zsh|bash
```

### 5.4 Progress Indicators

```typescript
// src/cli/progress.ts
// For long-running commands:
// carina backup create → shows progress bar
// carina update install → shows download progress
// carina hub install → shows install progress

import ora from 'ora'; // or custom spinner

const spinner = ora('Creating backup...').start();
// ... work ...
spinner.succeed('Backup created: carina-2026-06-17.tar.gz');
```

---

## PART 6; SCOUT DEEP INTEGRATION (TUI + CLI)

### 6.1 Scout Access Model

```
Free tier:        No Scout access
Starter (£19/mo): Basic Scout (trust score, basic events)
Team (£49/mo):    Full Scout (shield, kill switch, audit, reports)
Enterprise:       Custom Scout deployment
```

### 6.2 Scout Gate Implementation

```typescript
// src/cli/scout-gate.ts
// Check Scout access before any Scout command

export async function requireScoutAccess(command: string): Promise<ScoutAccess> {
  // 1. Check workspace billing for Scout subscription
  const billing = await getWorkspaceBilling();
  
  if (!billing.scoutProvisioned) {
    throw new CliError(
      'Scout is not provisioned for this workspace.\n' +
      '  Upgrade at: https://carinaai.uk/billing\n' +
      '  Or run: carina billing upgrade --add-scout'
    );
  }

  // 2. Check Scout client connectivity
  const scoutClient = await getScoutClient();
  const healthy = await scoutClient.ping();
  
  if (!healthy) {
    throw new CliError(
      'Scout service is unreachable.\n' +
      '  Check: carina scout status\n' +
      '  Restart: carina gateway restart'
    );
  }

  return {
    tier: billing.scoutTier,     // 'basic' | 'full'
    trustScore: await scoutClient.getTrustScore(),
    activeThreats: await scoutClient.getActiveThreats(),
  };
}
```

### 6.3 Scout TUI View; Full Dashboard

```typescript
// src/tui/chat/ScoutDashboard.tsx
// Full-screen Scout dashboard (Ink component)

function ScoutDashboard({ access }: { access: ScoutAccess }) {
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="double" borderColor="red">
        <Text bold color="red">SCOUT SECURITY DASHBOARD</Text>
        <Text dimColor>Trust Score: {access.trustScore}/100</Text>
      </Box>

      {/* Metric Grid */}
      <Box flexDirection="row" marginY={1}>
        <MetricBox label="Active Threats" value={access.activeThreats} color="red" />
        <MetricBox label="Events (24h)" value={access.events24h} color="yellow" />
        <MetricBox label="Shield" value={access.shieldStatus} color="green" />
        <MetricBox label="Kill Switch" value={access.killSwitch} color="red" />
      </Box>

      {/* Threat List */}
      <Box borderStyle="single" marginY={1}>
        <Text bold>Active Threats</Text>
        {access.threats.map(t => (
          <ThreatRow key={t.id} threat={t} />
        ))}
      </Box>

      {/* Event Timeline */}
      <Box borderStyle="single" flexGrow={1}>
        <Text bold>Recent Events</Text>
        {access.recentEvents.map(e => (
          <EventRow key={e.id} event={e} />
        ))}
      </Box>

      {/* Scout Commands */}
      <Box marginTop={1}>
        <Text dimColor>
          /scout audit | /scout report | /scout shield on|off | /scout killswitch
        </Text>
      </Box>
    </Box>
  );
}
```

### 6.4 Scout CLI Output Format

```
$ carina scout status

  SCOUT STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trust Score:        87/100  ●●●●●●●●●○  (Good)
Active Threats:     2       
Events (24h):       47      
Shield:             ACTIVE  
Kill Switch:        ARMED   
Monitored Agents:   12      
Last Audit:         2h ago  
Compliance:         94/100  Done: 

Active Threats:
   HIGH    Prompt injection attempt; agent: coding-agent; 5m ago
   MEDIUM  Unusual tool sequence; agent: carina-main; 23m ago

Recent Events:
  10:32  Done:  Shield blocked egress to unknown host
  10:28  WARNING:   Elevated tool usage detected
  10:15  Done:  Kill switch health check passed
  10:01  ℹ  Trust score recalibrated (+2)

$ carina scout audit
 Running Scout security audit...
    Path safety check
    Credential exposure scan
    Prompt injection guard test
    Egress filter verification
    Tool sequence analysis
   ⠋ Honeypot deployment check...
```

---

## PART 7; IMPLEMENTATION PLAN

### Phase 1; Foundation (Weeks 1-2)
```
- Set up Ink React project in src/tui/chat/
- Implement JSON-RPC transport layer
- Build core ChatApp shell
- Build MessageLine + basic Markdown renderer
- Build Composer with history
- Wire up to existing Gateway

Deliverable: Basic chat TUI (text in, text out)
```

### Phase 2; Streaming & Tools (Weeks 3-4)
```
- Implement SSE streaming parser
- Build StreamingAssistant + StreamingMarkdown
- Build Thinking + ToolCall components
- Build ToolResult with collapsible output
- Implement stream assembler

Deliverable: Streaming chat with tool progress
```

### Phase 3; Prompts & Navigation (Weeks 5-6)
```
- Build ApprovalPrompt, ClarifyPrompt, SudoPrompt
- Build ModelPicker with cost warnings
- Build ActiveSessionSwitcher
- Build SkillsHub + PluginsHub
- Build AgentsOverlay
- Implement keyboard shortcuts

Deliverable: Full-featured chat TUI
```

### Phase 4; CLI Interactive (Weeks 7-8)
```
- Build interactive chat CLI with streaming
- Implement autocomplete system
- Build rich banner
- Wire slash commands to registry
- Implement command history and navigation

Deliverable: carina chat command
```

### Phase 5; CLI Commands (Weeks 9-10)
```
- Expand registry from 75 to 150+ commands
- Implement all new command groups
- Add --json output mode
- Add shell completions
- Add progress indicators

Deliverable: Full command CLI
```

### Phase 6; Scout Integration (Weeks 11-12)
```
- Build Scout access gating
- Build Scout TUI dashboard
- Build Scout CLI commands
- Build Scout overlay for chat TUI
- Test with actual Scout client

Deliverable: Scout in TUI + CLI
```

### Phase 7; Polish (Weeks 13-14)
```
- Theme engine + skins
- Branding/banner system
- Operator TUI enhancement (8 views)
- Gateway chat mode
- Hyperlinks
- Fuzzy search
- External editor
- Performance optimization

Deliverable: Gold standard TUI/CLI
```

---

## FILE STRUCTURE (Final)

```
src/
├── tui/
│   ├── chat/                     NEW; Ink React TUI
│   │   ├── ChatApp.tsx
│   │   ├── components/
│   │   │   ├── MessageLine.tsx
│   │   │   ├── StreamingAssistant.tsx
│   │   │   ├── StreamingMarkdown.tsx
│   │   │   ├── UserMessage.tsx
│   │   │   ├── Thinking.tsx
│   │   │   ├── ToolCall.tsx
│   │   │   ├── ToolResult.tsx
│   │   │   ├── Markdown.tsx
│   │   │   ├── CodeBlock.tsx
│   │   │   ├── PromptOverlay.tsx
│   │   │   ├── ApprovalPrompt.tsx
│   │   │   ├── ClarifyPrompt.tsx
│   │   │   ├── SudoPrompt.tsx
│   │   │   ├── SecretPrompt.tsx
│   │   │   ├── HelpHint.tsx
│   │   │   ├── QueuedMessages.tsx
│   │   │   ├── Composer.tsx
│   │   │   ├── SlashPopover.tsx
│   │   │   ├── AtMentionPopover.tsx
│   │   │   ├── ModelPicker.tsx
│   │   │   ├── SkillsHub.tsx
│   │   │   ├── PluginsHub.tsx
│   │   │   ├── AgentsOverlay.tsx
│   │   │   ├── TodoPanel.tsx
│   │   │   ├── Branding.tsx
│   │   │   ├── ActiveSessionSwitcher.tsx
│   │   │   └── ScoutDashboard.tsx     Scout
│   │   ├── hooks/
│   │   │   ├── useGateway.ts
│   │   │   ├── useStreaming.ts
│   │   │   ├── useSession.ts
│   │   │   ├── useComposer.ts
│   │   │   ├── useSlashCommands.ts
│   │   │   ├── useModelPicker.ts
│   │   │   ├── useToolActivity.ts
│   │   │   ├── useApproval.ts
│   │   │   ├── useKeyboard.ts
│   │   │   ├── useTheme.ts
│   │   │   └── useScout.ts           Scout
│   │   ├── transport/
│   │   │   └── json-rpc.ts
│   │   ├── streaming/
│   │   │   └── assembler.ts
│   │   ├── theme/
│   │   │   ├── tokens.ts
│   │   │   ├── skins/
│   │   │   ├── faces.ts
│   │   │   ├── verbs.ts
│   │   │   └── branding.ts
│   │   └── index.ts
│   ├── operator/                  ENHANCED
│   │   ├── app.ts
│   │   ├── views/
│   │   │   ├── sessions.ts
│   │   │   ├── chat.ts
│   │   │   ├── agents.ts
│   │   │   ├── scout.ts           Scout
│   │   │   ├── tasks.ts
│   │   │   ├── resources.ts
│   │   │   ├── logs.ts
│   │   │   └── help.ts
│   │   ├── gateway-chat.ts
│   │   ├── hyperlinks.ts
│   │   ├── fuzzy-filter.ts
│   │   └── external-editor.ts
│   ├── ...existing files (commands.ts, slash-commands.ts, terminal.ts, etc.)
│   └── scout-gate.ts               Scout access gate
├── cli/
│   ├── interactive/                NEW
│   │   ├── chat.ts
│   │   ├── prompt.ts
│   │   ├── streaming-output.ts
│   │   ├── autocomplete.ts
│   │   └── banner.ts
│   ├── commands/                   NEW
│   │   ├── gateway.ts
│   │   ├── daemon.ts
│   │   ├── doctor.ts
│   │   ├── security.ts
│   │   ├── scout.ts               Scout
│   │   ├── message.ts
│   │   ├── update.ts
│   │   └── backup.ts
│   ├── completions/                NEW
│   │   ├── fish.ts
│   │   ├── zsh.ts
│   │   └── bash.ts
│   ├── progress.ts                NEW
│   ├── json-output.ts             NEW
│   ├── scout-gate.ts              Scout access gate
│   └── ...existing files (registry.ts, entrance.ts, help.ts, etc.)
```

---

## REFERENCE FILES TO STUDY

```
Hermes TUI:
  hermes-agent/ui-tui/src/components/messageLine.tsx
  hermes-agent/ui-tui/src/components/streamingAssistant.tsx
  hermes-agent/ui-tui/src/components/streamingMarkdown.tsx
  hermes-agent/ui-tui/src/components/thinking.tsx
  hermes-agent/ui-tui/src/components/prompts.tsx
  hermes-agent/ui-tui/src/components/modelPicker.tsx
  hermes-agent/ui-tui/src/components/skillsHub.tsx
  hermes-agent/ui-tui/src/components/agentsOverlay.tsx
  hermes-agent/ui-tui/src/components/textInput.tsx
  hermes-agent/ui-tui/src/gatewayClient.ts
  hermes-agent/cli.py (command registry, skin engine)

OpenClaw TUI:
  openclaw/src/tui/tui.ts
  openclaw/src/tui/gateway-chat.ts
  openclaw/src/tui/tui-stream-assembler.ts
  openclaw/src/tui/components/markdown-message.ts
  openclaw/src/tui/components/hyperlink-markdown.ts
  openclaw/src/tui/components/tool-execution.ts
  openclaw/src/tui/components/fuzzy-filter.ts

OpenClaw CLI:
  openclaw/src/cli/program/core-command-descriptors.ts
  openclaw/src/cli/program/register-configure.ts
  openclaw/src/cli/program/register-onboard.ts
  openclaw/src/cli/daemon-cli.ts
  openclaw/src/cli/update-cli.ts
  openclaw/src/cli/json-output-mode.ts

Carina (existing):
  src/tui/app.ts (operator TUI to enhance)
  src/tui/index.ts (simple TUI CLI)
  src/cli/registry.ts (75 commands to expand)
  src/cli/entrance.ts (banner to enhance)
  src/security/scout-client.ts (Scout integration)
  src/security/scout-context.ts (Scout context)
```
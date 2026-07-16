export type CommandCenterContractStatus = 'present' | 'partial' | 'missing';

export interface CommandCenterContractArea {
  id: string;
  order: number;
  title: string;
  status: CommandCenterContractStatus;
  target: string;
  current: string;
  files: string[];
  plannedPrompt: string;
}

export interface CommandCenterContractSummary {
  total: number;
  present: number;
  partial: number;
  missing: number;
  percentReady: number;
}

export const COMMAND_CENTER_CONTRACT_AREAS: CommandCenterContractArea[] = [
  {
    id: 'command-registry-slash-fallthrough',
    order: 1,
    title: 'Command registry and slash fallthrough',
    status: 'present',
    target: 'One source of truth for TUI slash metadata, local handlers, and runtime fallthrough.',
    current: 'Slash catalog, fuzzy menu, and gateway fallback exist, but the registry contract is split.',
    files: ['src/tui/ink/slash-catalog.ts', 'src/tui/slash-commands.ts', 'src/gateway/commands.ts'],
    plannedPrompt: 'carina-tui-command-center--02-command-registry-and-slash-fallthrough.md',
  },
  {
    id: 'runtime-transport-proximity',
    order: 2,
    title: 'Runtime transport proximity',
    status: 'present',
    target: 'Transport layer can run close to the runtime and expose streaming, interrupt, and health contracts.',
    current: 'Ink JSON-RPC transport and operator shell flows exist, but no Command Center transport contract is published.',
    files: ['src/tui/ink/transport/json-rpc.ts', 'src/tui/ink/hooks/useMessages.ts', 'src/tui/app.ts'],
    plannedPrompt: 'carina-tui-command-center--03-runtime-transport-proximity.md',
  },
  {
    id: 'renderer-contracts-benchmarks',
    order: 3,
    title: 'Renderer contracts and benchmarks',
    status: 'present',
    target: 'Renderer output, terminal width, long transcript, and streaming benchmarks are measurable.',
    current: 'Responsive frame and terminal helpers have tests, but no renderer contract benchmark exists.',
    files: ['src/tui/terminal.ts', 'src/tui/responsive-frame.ts', 'src/tui/ink/components/MessageList.tsx'],
    plannedPrompt: 'carina-tui-command-center--04-renderer-contracts-and-benchmarks.md',
  },
  {
    id: 'command-center-cockpit',
    order: 4,
    title: 'Command Center cockpit',
    status: 'present',
    target: 'A cockpit summarizes session, model, queue, trust, Scout, tools, and approvals in one scan.',
    current: 'Status bars, launcher columns, Scout overlay, and Agent overlay exist, but not a unified cockpit.',
    files: ['src/tui/status-bar.ts', 'src/tui/ink/launcher/LauncherTUI.tsx', 'src/tui/ink/components/StatusBar.tsx'],
    plannedPrompt: 'carina-tui-command-center--05-command-center-cockpit-and-status.md',
  },
  {
    id: 'runtime-timeline',
    order: 5,
    title: 'Runtime timeline',
    status: 'present',
    target: 'Turns, tool calls, approvals, retries, interrupts, and runtime notices appear in a timeline.',
    current: 'Messages and tool call blocks render, but there is no durable timeline model.',
    files: ['src/tui/ink/components/MessageList.tsx', 'src/tui/ink/components/ToolCallBlock.tsx'],
    plannedPrompt: 'carina-tui-command-center--06-runtime-timeline.md',
  },
  {
    id: 'tool-cards-redaction-details',
    order: 6,
    title: 'Tool cards with redaction and details',
    status: 'present',
    target: 'Tool execution cards redact secrets, expose detail views, and preserve inspectable metadata.',
    current: 'Tool call blocks exist, but redaction and details are not contract-tested as Command Center features.',
    files: ['src/tui/ink/components/ToolCallBlock.tsx', 'src/tui/ink/types/approval.ts'],
    plannedPrompt: 'carina-tui-command-center--07-tool-cards-redaction-and-details.md',
  },
  {
    id: 'session-map-branch-navigation',
    order: 7,
    title: 'Session map and branch navigation',
    status: 'present',
    target: 'Operators can inspect sessions, branches, restarts, and current path without losing context.',
    current: 'Session switcher exists, but branch navigation and map contracts are not present.',
    files: ['src/tui/ink/components/SessionSwitcher.tsx', 'src/tui/ink/hooks/useSession.ts'],
    plannedPrompt: 'carina-tui-command-center--08-session-map-and-branch-navigation.md',
  },
  {
    id: 'review-search-export-copy',
    order: 8,
    title: 'Review mode, search, export, and copy',
    status: 'present',
    target: 'Review mode supports transcript search, focused copy, export, and operator-safe summaries.',
    current: 'History search exists, but review mode and export contracts are not complete.',
    files: ['src/tui/ink/components/HistorySearch.tsx', 'src/tui/operator/external-editor.ts'],
    plannedPrompt: 'carina-tui-command-center--09-review-mode-search-export-copy.md',
  },
  {
    id: 'debug-overlay',
    order: 9,
    title: 'Debug overlay',
    status: 'present',
    target: 'Debug overlay exposes render state, events, transport health, faults, and recovery hints.',
    current: 'Logs and panels exist, but there is no Command Center debug overlay.',
    files: ['src/tui/log-buffer.ts', 'src/tui/panels/log-panel.ts'],
    plannedPrompt: 'carina-tui-command-center--10-debug-overlay-faults-and-long-session-tests.md',
  },
  {
    id: 'fault-long-session-terminal-overlay',
    order: 10,
    title: 'Fault injection, long-session behavior, terminal matrix, and overlay recovery',
    status: 'present',
    target: 'Faults, resize, overlays, terminal widths, and long sessions have automated regression coverage.',
    current: 'Terminal and layout tests exist, but no full fault and long-session suite exists.',
    files: ['src/tui/terminal.ts', 'src/tui/layout.ts', 'src/tui/responsive-frame.ts'],
    plannedPrompt: 'carina-tui-command-center--10-debug-overlay-faults-and-long-session-tests.md',
  },
  {
    id: 'splash-logo-appearance-marketing',
    order: 11,
    title: 'Carina splash, logo, appearance, and marketing alignment',
    status: 'present',
    target: 'TUI splash, appearance, and marketing present the upgraded Carina Command Center consistently.',
    current: 'Carina branding and themes exist, but the Command Center narrative is not fully connected.',
    files: ['src/tui/ink/launcher/LauncherHeader.tsx', 'src/tui/ink/theme/tokens.ts', '../../03-frontends/marketing/carinaai.uk'],
    plannedPrompt: 'carina-tui-command-center--11-visual-upgrade-splash-logo-and-marketing.md',
  },
];

export function getCommandCenterContractSummary(
  areas: CommandCenterContractArea[] = COMMAND_CENTER_CONTRACT_AREAS,
): CommandCenterContractSummary {
  const present = areas.filter((area) => area.status === 'present').length;
  const partial = areas.filter((area) => area.status === 'partial').length;
  const missing = areas.filter((area) => area.status === 'missing').length;
  const score = present + partial * 0.5;
  return {
    total: areas.length,
    present,
    partial,
    missing,
    percentReady: Math.round((score / areas.length) * 100),
  };
}

export function renderCommandCenterContractTable(
  areas: CommandCenterContractArea[] = COMMAND_CENTER_CONTRACT_AREAS,
): string {
  const summary = getCommandCenterContractSummary(areas);
  const rows = areas
    .map((area) => `${area.order.toString().padStart(2, '0')}  ${area.status.padEnd(7)}  ${area.title}`)
    .join('\n');

  return [
    'Carina TUI Command Center contract',
    `Ready: ${summary.percentReady}% (${summary.present} present, ${summary.partial} partial, ${summary.missing} missing)`,
    '',
    'No missing item fails this report until its build prompt is executed.',
    '',
    rows,
  ].join('\n');
}

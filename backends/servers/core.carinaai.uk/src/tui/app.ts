import readline from 'readline';
import { CarinaOrchestrator } from '../agents/orchestrator.js';
import { llm } from '../brain/llm.js';
import { countTokens } from '../brain/token-counter.js';
import { killProcess } from '../tools/process-registry.js';
import { listSubagentMetrics } from '../telemetry/subagent-metrics.js';
import { loadTuiSnapshot } from './data-provider.js';
import { parseInputLine, viewFromKey, type TuiCommand } from './commands.js';
import { appendLog, getLogLines } from './log-buffer.js';
import {
  computeLayout,
  tabBar,
  TUI_VIEWS,
  VIEW_LABELS,
  type TuiView,
} from './layout.js';
import {
  ALT_SCREEN_OFF,
  ALT_SCREEN_ON,
  CLEAR_SCREEN,
  drawBox,
  getTerminalSize,
  HIDE_CURSOR,
  SHOW_CURSOR,
  truncate,
} from './terminal.js';
import { computeSplitLayout, mergeSplitLines } from './split-layout.js';
import { PanelManager, sidePanelFromFKey, type SidePanelType } from './panels/panel-manager.js';
import { buildScoutSnapshot } from './panels/scout-panel.js';
import { renderOperatorStatusBar, sidePanelLabel } from './status-bar.js';
import { getSessionConfig } from '../config/session-config.js';
import { hasPendingInvalidation } from '../brain/prompt-cache.js';
import { maxSelectable, renderViewLines } from './views.js';
import { handleTuiSlashCommand } from './slash-commands.js';
import { runSelectedTaskAction } from './task-actions.js';

export interface OperatorTuiState {
  view: TuiView;
  selectedIndex: number;
  scrollTop: number;
  input: string;
  chatSessionId: string;
  chatLines: string[];
  lastUserMessage: string;
  busy: boolean;
  statusMessage: string;
}

export function createInitialState(sessionId?: string): OperatorTuiState {
  return {
    view: 'sessions',
    selectedIndex: 0,
    scrollTop: 0,
    input: '',
    chatSessionId: sessionId ?? `tui:${Date.now()}`,
    chatLines: [],
    lastUserMessage: '',
    busy: false,
    statusMessage: 'Ready',
  };
}

export function applyScroll(state: OperatorTuiState, snapshot: Awaited<ReturnType<typeof loadTuiSnapshot>>, contentHeight: number): void {
  const max = maxSelectable(state.view, snapshot, getLogLines());
  state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, max));
  const lineCount = renderViewLines(
    state.view,
    snapshot,
    getLogLines(),
    state.chatLines,
    state.selectedIndex,
    80,
  ).length;
  if (state.selectedIndex < state.scrollTop) {
    state.scrollTop = state.selectedIndex;
  }
  if (state.selectedIndex >= state.scrollTop + contentHeight) {
    state.scrollTop = state.selectedIndex - contentHeight + 1;
  }
  if (state.scrollTop > Math.max(0, lineCount - contentHeight)) {
    state.scrollTop = Math.max(0, lineCount - contentHeight);
  }
}

function countActiveSubagents(): number {
  const metrics = listSubagentMetrics(50);
  const latest = new Map<string, string>();
  for (const m of metrics) {
    const key = `${m.sessionId}:${m.agentType}`;
    if (!latest.has(key)) latest.set(key, m.status);
  }
  let count = 0;
  for (const status of latest.values()) {
    if (status === 'started') count++;
  }
  return count;
}

export function renderFrame(
  state: OperatorTuiState,
  snapshot: Awaited<ReturnType<typeof loadTuiSnapshot>>,
  panelLines: string[] = [],
  sidePanel: SidePanelType = 'none',
): string {
  const size = getTerminalSize();
  const layout = computeSplitLayout(size, sidePanel);
  const lines: string[] = [];

  lines.push(tabBar(state.view, layout.width));
  if (layout.narrow) {
    lines.push(truncate('Tab:1-6  j/k:move  Enter:cmd  F1-F4 panels  :q quit', layout.width));
  } else {
    lines.push(truncate(
      `F-keys 1-6 tabs | F1-F4 side panels | j/k scroll | r refresh | ${VIEW_LABELS[state.view]} | ${state.statusMessage}`,
      layout.width,
    ));
  }

  const contentLines = renderViewLines(
    state.view,
    snapshot,
    getLogLines(),
    state.chatLines,
    state.selectedIndex,
    layout.mainWidth - 2,
  ).slice(state.scrollTop, state.scrollTop + layout.contentHeight);

  const boxed = drawBox(
    VIEW_LABELS[state.view],
    contentLines,
    layout.mainWidth,
    layout.contentHeight + 2,
    true,
  );

  if (layout.panelWidth > 0 && panelLines.length > 0) {
    lines.push(...mergeSplitLines(boxed, panelLines, layout.panelWidth));
  } else {
    lines.push(...boxed);
  }

  const prompt = state.busy ? '… ' : '> ';
  lines.push(truncate(`${prompt}${state.input}`, layout.width));

  const chatText = state.chatLines.join('\n');
  let model = 'unknown';
  try {
    model = llm.current().name;
  } catch {
    model = 'unknown';
  }
  lines.push(renderOperatorStatusBar({
    sessionId: state.chatSessionId,
    model,
    trustScore: buildScoutSnapshot().trustScore,
    tokenCount: countTokens(chatText).tokens,
    thinkingLevel: getSessionConfig(state.chatSessionId)?.thinkingLevel
      ?? (getSessionConfig(state.chatSessionId)?.fastModeUntilTurn ? 'off' : undefined),
    activeAgents: countActiveSubagents(),
    sidePanelLabel: sidePanelLabel(sidePanel),
    promptRefreshPending: hasPendingInvalidation(state.chatSessionId),
  }, layout.width));

  return `${CLEAR_SCREEN}${lines.join('\n')}`;
}

async function executeCommand(
  cmd: TuiCommand,
  state: OperatorTuiState,
  snapshot: Awaited<ReturnType<typeof loadTuiSnapshot>>,
  agentRef: { current: CarinaOrchestrator },
  abortRef: { current: AbortController | null },
  memoryReady: boolean,
  refresh: () => Promise<void>,
): Promise<boolean> {
  const resetSession = (): string => {
    const sessionId = `tui:${Date.now()}`;
    state.chatSessionId = sessionId;
    state.chatLines = [];
    state.lastUserMessage = '';
    agentRef.current = new CarinaOrchestrator(sessionId, memoryReady, undefined, { platform: 'cli' });
    return sessionId;
  };

  switch (cmd.type) {
    case 'quit':
      return false;
    case 'refresh':
      await refresh();
      state.statusMessage = 'Refreshed';
      return true;
    case 'tab':
      state.view = cmd.view;
      state.selectedIndex = 0;
      state.scrollTop = 0;
      return true;
    case 'scroll':
      state.selectedIndex = Math.max(0, state.selectedIndex + cmd.delta);
      return true;
    case 'stop_turn': {
      abortRef.current?.abort();
      state.statusMessage = 'Stop requested';
      return true;
    }
    case 'task_action': {
      const task = snapshot.tasks[state.selectedIndex];
      try {
        const message = await runSelectedTaskAction(task, cmd.action);
        appendLog(message);
        state.statusMessage = message;
        await refresh();
      } catch (err) {
        state.statusMessage = err instanceof Error ? err.message : String(err);
      }
      return true;
    }
    case 'kill_process': {
      const proc = snapshot.processes[state.selectedIndex];
      if (!proc) {
        state.statusMessage = 'No process selected';
        return true;
      }
      try {
        await killProcess(proc.sessionId);
        appendLog(`Killed process ${proc.sessionId}`);
        state.statusMessage = `Killed ${proc.pid}`;
        await refresh();
      } catch (err) {
        state.statusMessage = err instanceof Error ? err.message : String(err);
      }
      return true;
    }
    case 'open_session': {
      const row = snapshot.sessions[state.selectedIndex];
      if (!row) {
        state.statusMessage = 'No session selected';
        return true;
      }
      state.chatSessionId = row.sessionId;
      state.view = 'chat';
      state.chatLines.push(`--- opened session ${row.sessionId} ---`);
      appendLog(`Opened session ${row.sessionId}`);
      state.statusMessage = `Chat session ${row.sessionId}`;
      return true;
    }
    case 'chat': {
      state.view = 'chat';
      let message = cmd.message;

      if (message.startsWith('/')) {
        const slash = await handleTuiSlashCommand(message, {
          sessionId: state.chatSessionId,
          lastUserMessage: state.lastUserMessage,
          resetSession,
          abortTurn: () => abortRef.current?.abort(),
          switchView: (view) => { state.view = view; },
        });
        if (slash.handled) {
          if (slash.reply) {
            state.chatLines.push(`cmd> ${slash.reply}`);
            appendLog(slash.reply);
          }
          if (slash.quit) return false;
          if (slash.retryMessage) {
            message = slash.retryMessage;
          } else {
            state.statusMessage = slash.reply?.slice(0, 60) ?? 'Command handled';
            return true;
          }
        }
      }

      state.chatLines.push(`you> ${message}`);
      if (!message.startsWith('/')) {
        state.lastUserMessage = message;
      }
      state.busy = true;
      state.statusMessage = 'Thinking...';
      abortRef.current = new AbortController();
      agentRef.current.setAbortSignal(abortRef.current.signal);
      let response = '';
      try {
        for await (const event of agentRef.current.turn(message)) {
          if (abortRef.current.signal.aborted) break;
          if (event.type === 'text' || event.type === 'tool' || event.type === 'status') {
            response += event.content;
          }
        }
        if (abortRef.current.signal.aborted) {
          state.chatLines.push('Carina> (interrupted)');
          state.statusMessage = 'Turn interrupted';
        } else {
          state.chatLines.push(`Carina> ${response || '(no response)'}`);
          appendLog(`Chat turn completed (${response.length} chars)`);
          state.statusMessage = 'Chat complete';
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        state.chatLines.push(`error> ${msg}`);
        appendLog(`Chat error: ${msg}`);
        state.statusMessage = 'Chat failed';
      } finally {
        state.busy = false;
        abortRef.current = null;
        agentRef.current.setAbortSignal(undefined);
      }
      return true;
    }
    case 'noop':
      return true;
    default:
      return true;
  }
}

export async function runOperatorTui(options: { memoryReady?: boolean; sessionId?: string } = {}): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Operator TUI requires an interactive terminal (TTY). Try: carina tui --simple');
  }

  let memoryReady = options.memoryReady ?? false;
  if (!memoryReady) {
    try {
      const { initDb } = await import('../memory/db.js');
      await initDb();
      memoryReady = true;
    } catch {
      memoryReady = false;
    }
  }

  try {
    const { initMemoryBackend } = await import('../memory/backends/index.js');
    initMemoryBackend();
  } catch {
    // optional
  }

  const { initRouter } = await import('../gateway/router.js');
  initRouter(memoryReady);

  const { startProcessCleanup } = await import('../tools/process-registry.js');
  startProcessCleanup();

  const { getRouter } = await import('../gateway/router.js');
  const { loadLastSurfaceSession, saveLastSurfaceSession } = await import('../surfaces/session-store.js');
  const { resolveSurfaceExternalUserId } = await import('../surfaces/index.js');
  const router = getRouter();
  const externalUserId = resolveSurfaceExternalUserId('tui');
  const last = await loadLastSurfaceSession('tui');
  const started = await router.startSurfaceSession('tui', externalUserId);
  const initialSessionId = options.sessionId ?? last?.sessionId ?? started.sessionId;

  const state = createInitialState(initialSessionId);
  const agentRef = { current: new CarinaOrchestrator(state.chatSessionId, memoryReady, undefined, { platform: 'cli' }) };
  const abortRef: { current: AbortController | null } = { current: null };
  const panelManager = new PanelManager();
  let panelLines: string[] = [];
  let snapshot = await loadTuiSnapshot(memoryReady);

  const refresh = async () => {
    snapshot = await loadTuiSnapshot(memoryReady);
    applyScroll(state, snapshot, computeLayout(getTerminalSize()).contentHeight);
  };

  process.stdout.write(ALT_SCREEN_ON);
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  appendLog('Carina operator TUI started');

  const paint = async () => {
    applyScroll(state, snapshot, computeLayout(getTerminalSize()).contentHeight);
    const layout = computeSplitLayout(getTerminalSize(), panelManager.getActivePanel());
    if (layout.panelWidth > 0) {
      panelLines = await panelManager.getPanelLines(layout.panelWidth, layout.contentHeight + 2);
    } else {
      panelLines = [];
    }
    process.stdout.write(HIDE_CURSOR);
    process.stdout.write(renderFrame(state, snapshot, panelLines, panelManager.getActivePanel()));
  };

  void paint();

  const onResize = () => { void paint(); };
  process.stdout.on('resize', onResize);

  await new Promise<void>((resolve) => {
    const cleanup = () => {
      panelManager.dispose();
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.removeListener('resize', onResize);
      process.stdout.write(SHOW_CURSOR);
      process.stdout.write(ALT_SCREEN_OFF);
      void saveLastSurfaceSession('tui', {
        sessionId: state.chatSessionId,
        externalUserId,
        updatedAt: new Date().toISOString(),
      });
    };

    const shutdown = () => {
      cleanup();
      resolve();
    };

    process.stdin.on('keypress', (str, key) => {
      if (!key) return;

      const fKey = sidePanelFromFKey(key.name);
      if (fKey === 'close') {
        panelManager.closePanel();
        void paint();
        return;
      }
      if (fKey) {
        panelManager.togglePanel(fKey);
        void paint();
        return;
      }
      if (key.name === 'f10') {
        shutdown();
        return;
      }

      if (key.ctrl && key.name === 'c') {
        if (state.busy) {
          abortRef.current?.abort();
          state.statusMessage = 'Stop requested';
          void paint();
          return;
        }
        shutdown();
        return;
      }
      if (state.busy) {
        if (key.name === 'escape') {
          abortRef.current?.abort();
          state.statusMessage = 'Stop requested';
          void paint();
        }
        return;
      }

      if (key.name === 'tab') {
        const idx = TUI_VIEWS.indexOf(state.view);
        const next = TUI_VIEWS[(idx + 1) % TUI_VIEWS.length]!;
        void executeCommand({ type: 'tab', view: next }, state, snapshot, agentRef, abortRef, memoryReady, refresh).then(() => paint());
        return;
      }
      if (str && str >= '1' && str <= '6') {
        void executeCommand(viewFromKey(str), state, snapshot, agentRef, abortRef, memoryReady, refresh).then(() => paint());
        return;
      }
      if (key.name === 'up' || key.name === 'k') {
        void executeCommand({ type: 'scroll', delta: -1 }, state, snapshot, agentRef, abortRef, memoryReady, refresh).then(() => paint());
        return;
      }
      if (key.name === 'down' || key.name === 'j') {
        void executeCommand({ type: 'scroll', delta: 1 }, state, snapshot, agentRef, abortRef, memoryReady, refresh).then(() => paint());
        return;
      }
      if (key.name === 'return') {
        const cmd = parseInputLine(state.input, state.view);
        state.input = '';
        void executeCommand(cmd, state, snapshot, agentRef, abortRef, memoryReady, refresh).then((cont) => {
          if (!cont) {
            shutdown();
            return;
          }
          void paint();
        });
        return;
      }
      if (key.name === 'backspace') {
        state.input = state.input.slice(0, -1);
        void paint();
        return;
      }
      if (str && !key.ctrl && !key.meta && str >= ' ') {
        state.input += str;
        void paint();
      }
    });
  });
}

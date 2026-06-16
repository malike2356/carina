import readline from 'readline';
import { CarinaOrchestrator } from '../agents/orchestrator.js';
import { killProcess } from '../tools/process-registry.js';
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
import { maxSelectable, renderViewLines } from './views.js';

export interface OperatorTuiState {
  view: TuiView;
  selectedIndex: number;
  scrollTop: number;
  input: string;
  chatSessionId: string;
  chatLines: string[];
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

export function renderFrame(
  state: OperatorTuiState,
  snapshot: Awaited<ReturnType<typeof loadTuiSnapshot>>,
): string {
  const size = getTerminalSize();
  const layout = computeLayout(size);
  const lines: string[] = [];

  lines.push(tabBar(state.view, layout.width));
  if (layout.narrow) {
    lines.push(truncate('Tab:1-6  j/k:move  Enter:cmd  :q quit', layout.width));
  } else {
    lines.push(truncate(
      `F-keys 1-6 tabs | j/k scroll | r refresh (:refresh) | ${VIEW_LABELS[state.view]} | ${state.statusMessage}`,
      layout.width,
    ));
  }

  const contentLines = renderViewLines(
    state.view,
    snapshot,
    getLogLines(),
    state.chatLines,
    state.selectedIndex,
    layout.width - 2,
  ).slice(state.scrollTop, state.scrollTop + layout.contentHeight);

  const boxed = drawBox(
    VIEW_LABELS[state.view],
    contentLines,
    layout.width,
    layout.contentHeight + 2,
    true,
  );
  lines.push(...boxed);

  const prompt = state.busy ? '… ' : '> ';
  lines.push(truncate(`${prompt}${state.input}`, layout.width));
  lines.push(truncate(
    `profile:${snapshot.activeProfile} mem:${snapshot.memoryReady ? 'on' : 'off'} session:${truncate(state.chatSessionId, 18)}`,
    layout.width,
  ));

  return `${CLEAR_SCREEN}${lines.join('\n')}`;
}

async function executeCommand(
  cmd: TuiCommand,
  state: OperatorTuiState,
  snapshot: Awaited<ReturnType<typeof loadTuiSnapshot>>,
  agent: CarinaOrchestrator,
  refresh: () => Promise<void>,
): Promise<boolean> {
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
      state.chatLines.push(`you> ${cmd.message}`);
      state.busy = true;
      let response = '';
      try {
        for await (const event of agent.turn(cmd.message)) {
          if (event.type === 'text' || event.type === 'tool' || event.type === 'status') {
            response += event.content;
          }
        }
        state.chatLines.push(`Carina> ${response || '(no response)'}`);
        appendLog(`Chat turn completed (${response.length} chars)`);
        state.statusMessage = 'Chat complete';
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        state.chatLines.push(`error> ${msg}`);
        appendLog(`Chat error: ${msg}`);
        state.statusMessage = 'Chat failed';
      } finally {
        state.busy = false;
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
  const agent = new CarinaOrchestrator(state.chatSessionId, memoryReady, undefined, { platform: 'cli' });
  let snapshot = await loadTuiSnapshot(memoryReady);

  const refresh = async () => {
    snapshot = await loadTuiSnapshot(memoryReady);
    applyScroll(state, snapshot, computeLayout(getTerminalSize()).contentHeight);
  };

  process.stdout.write(ALT_SCREEN_ON);
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  let running = true;
  appendLog('Carina operator TUI started');

  const paint = () => {
    applyScroll(state, snapshot, computeLayout(getTerminalSize()).contentHeight);
    process.stdout.write(HIDE_CURSOR);
    process.stdout.write(renderFrame(state, snapshot));
  };

  paint();

  const onResize = () => paint();
  process.stdout.on('resize', onResize);

  await new Promise<void>((resolve) => {
    const cleanup = () => {
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

    process.stdin.on('keypress', (str, key) => {
      if (!key) return;
      if (key.ctrl && key.name === 'c') {
        running = false;
        cleanup();
        resolve();
        return;
      }
      if (state.busy) return;

      if (key.name === 'tab') {
        const idx = TUI_VIEWS.indexOf(state.view);
        const next = TUI_VIEWS[(idx + 1) % TUI_VIEWS.length]!;
        void executeCommand({ type: 'tab', view: next }, state, snapshot, agent, refresh).then(() => paint());
        return;
      }
      if (str && str >= '1' && str <= '6') {
        void executeCommand(viewFromKey(str), state, snapshot, agent, refresh).then(() => paint());
        return;
      }
      if (key.name === 'up' || key.name === 'k') {
        void executeCommand({ type: 'scroll', delta: -1 }, state, snapshot, agent, refresh).then(() => paint());
        return;
      }
      if (key.name === 'down' || key.name === 'j') {
        void executeCommand({ type: 'scroll', delta: 1 }, state, snapshot, agent, refresh).then(() => paint());
        return;
      }
      if (key.name === 'return') {
        const cmd = parseInputLine(state.input, state.view);
        state.input = '';
        void executeCommand(cmd, state, snapshot, agent, refresh).then((cont) => {
          if (!cont) {
            running = false;
            cleanup();
            resolve();
            return;
          }
          paint();
        });
        return;
      }
      if (key.name === 'backspace') {
        state.input = state.input.slice(0, -1);
        paint();
        return;
      }
      if (str && !key.ctrl && !key.meta && str >= ' ') {
        state.input += str;
        paint();
      }
    });
  });
}

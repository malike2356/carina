import type { TuiView } from './layout.js';

export type TuiCommand =
  | { type: 'quit' }
  | { type: 'refresh' }
  | { type: 'tab'; view: TuiView }
  | { type: 'scroll'; delta: number }
  | { type: 'kill_process' }
  | { type: 'open_session' }
  | { type: 'chat'; message: string }
  | { type: 'noop' };

export function parseInputLine(line: string, activeView: TuiView): TuiCommand {
  const trimmed = line.trim();
  if (!trimmed) return { type: 'noop' };

  if (trimmed === ':q' || trimmed === ':quit' || trimmed === '/quit') {
    return { type: 'quit' };
  }
  if (trimmed === ':r' || trimmed === ':refresh' || trimmed === '/refresh') {
    return { type: 'refresh' };
  }
  if (trimmed.startsWith(':tab ')) {
    const name = trimmed.slice(5).trim().toLowerCase() as TuiView;
    if (['sessions', 'tasks', 'processes', 'tools', 'logs', 'chat'].includes(name)) {
      return { type: 'tab', view: name };
    }
  }
  if (trimmed === ':kill' && activeView === 'processes') {
    return { type: 'kill_process' };
  }
  if (trimmed === ':open' && activeView === 'sessions') {
    return { type: 'open_session' };
  }

  if (activeView === 'chat' && !trimmed.startsWith(':')) {
    return { type: 'chat', message: trimmed };
  }

  if (trimmed.startsWith('/')) {
    return { type: 'chat', message: trimmed };
  }

  return { type: 'noop' };
}

export function viewFromKey(key: string): TuiCommand {
  const idx = Number(key);
  if (idx >= 1 && idx <= 6) {
    const views = ['sessions', 'tasks', 'processes', 'tools', 'logs', 'chat'] as const;
    return { type: 'tab', view: views[idx - 1]! };
  }
  return { type: 'noop' };
}

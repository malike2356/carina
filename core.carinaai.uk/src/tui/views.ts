import { truncate } from './terminal.js';
import type { TuiSnapshot } from './data-provider.js';
import type { TuiView } from './layout.js';

export function renderViewLines(
  view: TuiView,
  snapshot: TuiSnapshot,
  logs: string[],
  chatLines: string[],
  selectedIndex: number,
  width: number,
): string[] {
  const colW = Math.max(10, width - 2);
  const lines: string[] = [];

  if (view === 'sessions') {
    if (!snapshot.memoryReady) lines.push('Memory store unavailable (start Postgres or use local mode).');
    if (snapshot.sessions.length === 0) lines.push('(no sessions)');
    snapshot.sessions.forEach((s, i) => {
      const mark = i === selectedIndex ? '>' : ' ';
      lines.push(`${mark} ${truncate(s.title, colW - 14)}  ${s.lastAt}`);
      lines.push(`  ${truncate(s.sessionId, colW - 2)}`);
    });
    lines.push('');
    lines.push(':open to chat in selected session');
    return lines;
  }

  if (view === 'tasks') {
    if (snapshot.tasks.length === 0) lines.push('(no tasks)');
    snapshot.tasks.forEach((t, i) => {
      const mark = i === selectedIndex ? '>' : ' ';
      lines.push(`${mark} [${t.kind}] ${t.status}  ${truncate(t.detail, colW - 20)}`);
      lines.push(`  ${truncate(t.id, colW - 2)}`);
    });
    return lines;
  }

  if (view === 'processes') {
    if (snapshot.processes.length === 0) lines.push('(no background processes)');
    snapshot.processes.forEach((p, i) => {
      const mark = i === selectedIndex ? '>' : ' ';
      lines.push(`${mark} ${p.status} pid=${p.pid} uptime=${p.uptime}s`);
      lines.push(`  ${truncate(p.command, colW - 2)}`);
      lines.push(`  ${truncate(p.sessionId, colW - 2)}`);
    });
    lines.push('');
    lines.push(':kill to stop selected process');
    return lines;
  }

  if (view === 'tools') {
    lines.push(`Tools (${snapshot.tools.length})  j/k scroll`);
    snapshot.tools.forEach((t, i) => {
      const mark = i === selectedIndex ? '>' : ' ';
      const flag = t.dangerous ? '!' : ' ';
      lines.push(`${mark}${flag} ${t.name}`);
    });
    return lines;
  }

  if (view === 'logs') {
    if (logs.length === 0) lines.push('(empty)');
    return logs.map((l) => truncate(l, colW));
  }

  lines.push('Chat with Carina (Enter to send, /help for slash commands)');
  for (const line of chatLines.slice(-40)) {
    for (const wrapped of line.split('\n')) {
      lines.push(truncate(wrapped, colW));
    }
  }
  return lines;
}

export function maxSelectable(view: TuiView, snapshot: TuiSnapshot, logs: string[]): number {
  switch (view) {
    case 'sessions': return Math.max(0, snapshot.sessions.length - 1);
    case 'tasks': return Math.max(0, snapshot.tasks.length - 1);
    case 'processes': return Math.max(0, snapshot.processes.length - 1);
    case 'tools': return Math.max(0, snapshot.tools.length - 1);
    case 'logs': return Math.max(0, logs.length - 1);
    default: return 0;
  }
}

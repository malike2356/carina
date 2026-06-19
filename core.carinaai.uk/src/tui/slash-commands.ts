import { handleGatewayCommandAsync } from '../gateway/commands.js';
import type { TuiView } from './layout.js';

export interface TuiSlashContext {
  sessionId: string;
  lastUserMessage: string;
  resetSession: () => string;
  abortTurn: () => void;
  switchView: (view: TuiView) => void;
}

export interface TuiSlashResult {
  handled: boolean;
  reply?: string;
  quit?: boolean;
  retryMessage?: string;
  newSessionId?: string;
}

const TUI_HELP = [
  'Operator TUI commands',
  '/help            show commands',
  '/new, /reset     start a fresh chat session',
  '/stop, Esc       interrupt the current turn (while busy)',
  '/retry           resend the last user message',
  '/tasks           open scheduled tasks tab',
  '/model, /provider switch LLM',
  '/memories        list episodic memories',
  '/usage --month   token usage summary',
  ':tab chat        switch tab (sessions|tasks|processes|tools|logs|chat)',
  ':pause|:resume|:run  manage selected cron job on Tasks tab',
  ':q               quit',
];

export function formatTuiHelp(): string {
  return TUI_HELP.join('\n');
}

export async function handleTuiSlashCommand(
  input: string,
  ctx: TuiSlashContext,
): Promise<TuiSlashResult> {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return { handled: false };
  }

  const lower = trimmed.toLowerCase();

  if (lower === '/help' || lower === '/commands') {
    return { handled: true, reply: formatTuiHelp() };
  }

  if (lower === '/new' || lower === '/reset') {
    const sessionId = ctx.resetSession();
    return {
      handled: true,
      reply: `Started new session ${sessionId}`,
      newSessionId: sessionId,
    };
  }

  if (lower === '/stop') {
    ctx.abortTurn();
    return { handled: true, reply: 'Stopping current turn...' };
  }

  if (lower === '/retry') {
    if (!ctx.lastUserMessage.trim()) {
      return { handled: true, reply: 'Nothing to retry yet.' };
    }
    return { handled: true, retryMessage: ctx.lastUserMessage };
  }

  if (lower === '/tasks' || lower === '/cron') {
    ctx.switchView('tasks');
    return { handled: true, reply: 'Opened Tasks tab (cron, taskflows, subagents).' };
  }

  const gateway = await handleGatewayCommandAsync(trimmed, {
    sessionId: ctx.sessionId,
    channel: 'cli',
  });
  if (gateway.handled) {
    if (gateway.action === 'exit') {
      return { handled: true, reply: gateway.reply, quit: true };
    }
    return { handled: true, reply: gateway.reply };
  }

  return { handled: false };
}

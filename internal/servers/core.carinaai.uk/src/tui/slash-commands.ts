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
  ':security        show unified security dashboard summary',
  ':pentest         run penetration test summary',
  ':redteam         show red team report summary',
  ':forensics       list recent forensic incidents',
  ':compliance      show compliance status',
  ':secrets         show secrets rotation status',
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

  if (lower === '/security' || lower === ':security') {
    const { buildSecurityDashboardData, formatDashboardTui } = await import('../security/dashboard/index.js');
    const data = await buildSecurityDashboardData();
    return { handled: true, reply: formatDashboardTui(data) };
  }

  if (lower === ':pentest' || lower === '/pentest') {
    const { loadScenarios } = await import('../security/penetration/loader.js');
    const scenarios = loadScenarios();
    return {
      handled: true,
      reply: `Pen test arsenal: ${scenarios.length} scenarios loaded. Run: carina security pentest`,
    };
  }

  if (lower === ':redteam' || lower === '/redteam' || lower === '/red-team') {
    const { buildLatestReport, formatRedTeamReport } = await import('../security/red-team/index.js');
    const report = await buildLatestReport();
    return { handled: true, reply: formatRedTeamReport(report) };
  }

  if (lower === ':forensics' || lower === '/forensics') {
    const { forensicsEngine } = await import('../security/forensics/engine.js');
    const incidents = await forensicsEngine.listIncidents(5);
    if (incidents.length === 0) {
      return { handled: true, reply: 'No forensic incidents recorded.' };
    }
    const lines = incidents.map(
      (row) => `${row.id.slice(0, 8)} [${row.severity}] ${row.title} (${row.status})`,
    );
    return { handled: true, reply: ['Recent forensic incidents:', ...lines].join('\n') };
  }

  if (lower === ':compliance' || lower === '/compliance') {
    const { buildComplianceDashboardFromCache, formatComplianceDashboard } = await import('../security/compliance/index.js');
    const dashboard = await buildComplianceDashboardFromCache();
    return { handled: true, reply: formatComplianceDashboard(dashboard) };
  }

  if (lower === ':secrets' || lower === '/secrets') {
    const { buildSecretsStatusReport, formatSecretsStatus } = await import('../security/secrets/index.js');
    const report = await buildSecretsStatusReport();
    return { handled: true, reply: formatSecretsStatus(report) };
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

import chalk from 'chalk';
import { getRouter } from '../../gateway/router.js';
import { getActiveAgentDefinition } from '../../workspaces/agent-registry.js';
import { initMemoryBackend } from '../../memory/backends/index.js';
import { getSessionHistory } from '../../memory/store.js';
import type { Role } from '../../types/index.js';

function parseLimit(args: string[]): number {
  const limitIdx = args.indexOf('--limit');
  if (limitIdx >= 0) {
    const parsed = Number(args[limitIdx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 500);
  }
  return 20;
}

function sessionArg(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--limit') {
      i += 1;
      continue;
    }
    if (arg && !arg.startsWith('--')) return arg;
  }
  return undefined;
}

function formatRole(role: Role): string {
  return role === 'assistant' ? 'Carina' : 'You';
}

async function fetchRemoteHistory(
  baseUrl: string,
  sessionId: string,
  limit: number,
): Promise<Array<{ role: string; content: string; createdAt: string }>> {
  const params = new URLSearchParams({ limit: String(limit) });
  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = process.env.CARINA_API_KEY ?? process.env.API_CHANNEL_API_KEY;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const url = `${baseUrl.replace(/\/+$/, '')}/api/chat/history/${encodeURIComponent(sessionId)}?${params}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`History fetch ${res.status}: ${body || res.statusText}`);
  }
  const data = await res.json() as { messages?: Array<{ role: string; content: string; createdAt: string }> };
  return data.messages ?? [];
}

export async function runHistoryCommand(args: string[]): Promise<void> {
  const limit = parseLimit(args);
  const gatewayUrl = process.env.CARINA_GATEWAY_URL ?? process.env.CARINA_WEB_URL;

  let sessionId = sessionArg(args);
  if (!sessionId && gatewayUrl) {
    sessionId = process.env.CARINA_SESSION_ID ?? 'cli-default';
  }
  if (!sessionId) {
    initMemoryBackend();
    const agent = getActiveAgentDefinition();
    const router = getRouter();
    sessionId = await router.getSession(agent.id, 'cli', 'local');
  }

  const rows = gatewayUrl
    ? await fetchRemoteHistory(gatewayUrl, sessionId, limit)
    : (await getSessionHistory(sessionId, limit)).map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));

  if (rows.length === 0) {
    console.log(chalk.gray('\nNo messages in this session.\n'));
    return;
  }

  console.log(chalk.bold(`\nLast ${rows.length} message(s) [${sessionId.slice(0, 12)}]\n`));
  for (const row of rows) {
    const label = row.role === 'assistant' ? 'Carina' : formatRole(row.role as Role);
    const color = row.role === 'assistant' ? chalk.green : chalk.cyan;
    const stamp = row.createdAt ? chalk.gray(` (${row.createdAt})`) : '';
    console.log(color(`${label}${stamp}: ${row.content}`));
  }
  console.log('');
}

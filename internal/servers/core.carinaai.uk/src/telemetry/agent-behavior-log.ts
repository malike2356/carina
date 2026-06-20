import fs from 'fs/promises';
import path from 'path';
import { globalCarinaHome } from '../config/paths.js';

export type AgentBehaviorEvent = {
  ts: string;
  sessionId: string;
  platform: string;
  action: string;
  detail?: string;
  meta?: Record<string, unknown>;
};

function logPath(): string {
  const home = process.env.CARINA_HOME ?? globalCarinaHome();
  return path.join(home, 'data', 'logs', 'agent-behavior.jsonl');
}

export function agentBehaviorLogEnabled(): boolean {
  return process.env.CARINA_AGENT_BEHAVIOR_LOG !== 'false';
}

export async function recordAgentBehavior(event: Omit<AgentBehaviorEvent, 'ts'>): Promise<void> {
  if (!agentBehaviorLogEnabled()) return;
  const line: AgentBehaviorEvent = { ...event, ts: new Date().toISOString() };
  try {
    const file = logPath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, `${JSON.stringify(line)}\n`, 'utf8');
  } catch {
    // non-blocking
  }
}

export async function readAgentBehaviorTail(limit = 50): Promise<AgentBehaviorEvent[]> {
  const file = logPath();
  let raw = '';
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return [];
  }
  const rows: AgentBehaviorEvent[] = [];
  for (const line of raw.trim().split('\n').filter(Boolean).slice(-limit)) {
    try {
      rows.push(JSON.parse(line) as AgentBehaviorEvent);
    } catch {
      // skip
    }
  }
  return rows.reverse();
}

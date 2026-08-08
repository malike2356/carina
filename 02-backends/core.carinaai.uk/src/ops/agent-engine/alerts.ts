/** OPS agent-engine alerts (health failures, kill, rollback). */

import { appendAgentEngineLog, readAgentEngineState, updateHealthFailures } from './store.js';

async function sendTelegram(text: string): Promise<boolean> {
  const token = (process.env.OPS_TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  const chatId = (process.env.OPS_TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID ?? '').trim();
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3500) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendScoutAlert(title: string, body: string, severity = 'warning'): Promise<boolean> {
  const base = (process.env.SCOUT_API_URL ?? process.env.SCOUT_ENGINE_URL ?? '').replace(/\/$/, '');
  const key = (process.env.SCOUT_API_KEY ?? '').trim();
  if (!base || !key) return false;
  try {
    const res = await fetch(`${base}/api/admin/alert-test`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify({ title, body, severity, channel: 'telegram' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fireAgentEngineAlert(reason: string, details?: Record<string, unknown>): Promise<void> {
  const text = `[Carina OPS Agent Engine] ${reason}${details ? ` ${JSON.stringify(details)}` : ''}`;
  appendAgentEngineLog({
    timestamp: new Date().toISOString(),
    level: 'WARN',
    message: text,
    source: 'alerts',
  });
  const tg = await sendTelegram(text);
  if (!tg) await sendScoutAlert('Agent Engine alert', text, 'warning');
  updateHealthFailures(readAgentEngineState().health_failures, new Date().toISOString());
}

export async function noteHealthResult(healthy: boolean): Promise<void> {
  const state = readAgentEngineState();
  if (healthy) {
    if (state.health_failures > 0) updateHealthFailures(0);
    return;
  }
  const failures = state.health_failures + 1;
  updateHealthFailures(failures);
  if (failures >= 3) {
    await fireAgentEngineAlert('Keprix health check failed 3 times in a row', {
      failures,
      last_error: state.logs[0]?.message,
    });
    updateHealthFailures(0, new Date().toISOString());
  }
}

export async function noteKillSwitchActivated(workspaceId: string, actor: string): Promise<void> {
  await fireAgentEngineAlert('Kill switch activated', { workspaceId, actor });
}

export async function noteEmergencyRollback(actor: string): Promise<void> {
  await fireAgentEngineAlert('Emergency rollback: all workspaces switched to Carina Native', { actor });
}

export async function noteHighMemory(percent: number): Promise<void> {
  if (percent < 80) return;
  await fireAgentEngineAlert('Keprix memory usage exceeds 80%', { percent });
}

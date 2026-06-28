import { pool } from '../../memory/db.js';

const bindingStore = new Map<string, { agentId: string; channelName: string }>();

export function resetChannelAgentBindingsForTests(): void {
  bindingStore.clear();
}

export async function resolveChannelAgentBinding(channelId: string): Promise<string | null> {
  const cached = bindingStore.get(channelId);
  if (cached) return cached.agentId;

  try {
    const result = await pool.query(
      'SELECT agent_id FROM channel_agent_bindings WHERE channel_id = $1 LIMIT 1',
      [channelId],
    );
    const agentId = result.rows[0]?.agent_id ? String(result.rows[0].agent_id) : null;
    if (agentId) {
      bindingStore.set(channelId, { agentId, channelName: channelId });
      return agentId;
    }
  } catch {
    // table may be unavailable
  }
  return null;
}

export async function bindChannelAgent(
  channelId: string,
  channelName: string,
  agentId: string,
): Promise<void> {
  bindingStore.set(channelId, { agentId, channelName });
  try {
    await pool.query(
      `INSERT INTO channel_agent_bindings (channel_id, channel_name, agent_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (channel_id) DO UPDATE SET
         channel_name = EXCLUDED.channel_name,
         agent_id = EXCLUDED.agent_id`,
      [channelId, channelName, agentId],
    );
  } catch {
    // in-memory fallback
  }
}

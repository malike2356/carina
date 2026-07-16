export interface StandingOrder {
  id: string;
  agentId: string;
  directive: string;
  priority: number;
  enabled: boolean;
  source: 'user' | 'system' | 'heartbeat' | 'plugin';
  metadata?: {
    channel?: string;
    expiresAt?: number;
    tags?: string[];
  };
  createdAt: number;
  updatedAt: number;
}

export const STANDING_ORDERS_MIGRATION = `
CREATE TABLE IF NOT EXISTS standing_orders (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL DEFAULT '*',
  directive TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'user',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_standing_orders_agent ON standing_orders(agent_id, enabled);
`;

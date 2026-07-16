import { randomUUID } from 'node:crypto';
import { isDatabaseConfigured } from '../config/database-url.js';
import { pool } from '../memory/db.js';
import type { StandingOrder } from './standing-orders-types.js';

export { STANDING_ORDERS_MIGRATION } from './standing-orders-types.js';

type Row = {
  id: string;
  agent_id: string;
  directive: string;
  priority: number;
  enabled: boolean;
  source: StandingOrder['source'];
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function rowToOrder(row: Row): StandingOrder {
  return {
    id: row.id,
    agentId: row.agent_id,
    directive: row.directive,
    priority: row.priority,
    enabled: row.enabled,
    source: row.source,
    metadata: (row.metadata ?? {}) as StandingOrder['metadata'],
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export class StandingOrdersStore {
  private cache = new Map<string, StandingOrder[]>();

  async add(order: Omit<StandingOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<StandingOrder> {
    const now = Date.now();
    const so: StandingOrder = { id: randomUUID(), ...order, createdAt: now, updatedAt: now };
    await pool.query(
      `INSERT INTO standing_orders (id, agent_id, directive, priority, enabled, source, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        so.id,
        so.agentId,
        so.directive,
        so.priority,
        so.enabled,
        so.source,
        JSON.stringify(so.metadata ?? {}),
        so.createdAt,
        so.updatedAt,
      ],
    );
    this.invalidateCache(so.agentId);
    return so;
  }

  async list(agentId: string): Promise<StandingOrder[]> {
    const cached = this.cache.get(agentId);
    if (cached) return cached;
    const { rows } = await pool.query<Row>(
      `SELECT * FROM standing_orders
       WHERE enabled = TRUE AND (agent_id = $1 OR agent_id = '*')
       ORDER BY priority DESC, created_at ASC`,
      [agentId],
    );
    const now = Date.now();
    const orders = rows
      .map(rowToOrder)
      .filter((order) => !order.metadata?.expiresAt || order.metadata.expiresAt >= now);
    this.cache.set(agentId, orders);
    return orders;
  }

  async get(id: string): Promise<StandingOrder | null> {
    const { rows } = await pool.query<Row>('SELECT * FROM standing_orders WHERE id = $1', [id]);
    return rows[0] ? rowToOrder(rows[0]) : null;
  }

  async remove(id: string): Promise<boolean> {
    const order = await this.get(id);
    const { rowCount } = await pool.query('DELETE FROM standing_orders WHERE id = $1', [id]);
    if (order) this.invalidateCache(order.agentId);
    return (rowCount ?? 0) > 0;
  }

  async update(id: string, patch: Partial<StandingOrder>): Promise<StandingOrder | null> {
    const order = await this.get(id);
    if (!order) return null;
    const updated: StandingOrder = {
      ...order,
      ...patch,
      metadata: patch.metadata ?? order.metadata,
      updatedAt: Date.now(),
    };
    await pool.query(
      `UPDATE standing_orders
       SET directive = $2, priority = $3, enabled = $4, metadata = $5, updated_at = $6
       WHERE id = $1`,
      [
        id,
        updated.directive,
        updated.priority,
        updated.enabled,
        JSON.stringify(updated.metadata ?? {}),
        updated.updatedAt,
      ],
    );
    this.invalidateCache(updated.agentId);
    return updated;
  }

  async cleanupExpired(): Promise<number> {
    const { rows } = await pool.query<Row>(
      `SELECT * FROM standing_orders WHERE metadata->>'expiresAt' IS NOT NULL`,
    );
    const now = Date.now();
    let removed = 0;
    for (const row of rows) {
      const order = rowToOrder(row);
      if (order.metadata?.expiresAt && order.metadata.expiresAt < now) {
        if (await this.remove(order.id)) removed += 1;
      }
    }
    return removed;
  }

  private invalidateCache(agentId: string): void {
    this.cache.delete(agentId);
    this.cache.delete('*');
  }
}

let store: StandingOrdersStore | null = null;

export function getStandingOrdersStore(): StandingOrdersStore {
  store ??= new StandingOrdersStore();
  return store;
}

export function standingOrdersEnabled(): boolean {
  if (process.env.CARINA_STANDING_ORDERS_ENABLED === 'false') return false;
  return isDatabaseConfigured();
}

export async function buildStandingOrdersSection(agentId: string): Promise<string> {
  if (!standingOrdersEnabled()) return '';
  try {
    const orders = await getStandingOrdersStore().list(agentId);
    if (orders.length === 0) return '';
    const lines = ['', '## Standing Orders', '', 'The following directives are always in effect. Follow them strictly:', ''];
    for (const order of orders) {
      const source = order.source === 'user' ? '' : ` (${order.source})`;
      const expiry = order.metadata?.expiresAt
        ? ` [expires ${new Date(order.metadata.expiresAt).toISOString().split('T')[0]}]`
        : '';
      lines.push(`- ${order.directive}${source}${expiry}`);
    }
    lines.push('');
    return lines.join('\n');
  } catch {
    return '';
  }
}

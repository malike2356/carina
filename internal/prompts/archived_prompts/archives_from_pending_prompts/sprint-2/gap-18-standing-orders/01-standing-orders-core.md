# Gap 18 - Prompt 01: Standing Orders Core -- Data Model, Storage, System Prompt Injection

**Gap:** 18 Standing Orders & Persistent Directives
**Prompt number:** 01 of 02
**Name:** Data model, storage, system prompt injection
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** Nothing

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `agents/system-prompt.ts` -- system prompt assembly pipeline
2. `memory/backends/sqlite.ts` or `memory/backends/postgres.ts` -- memory storage
3. `agents/session-manager.ts` -- session creation (where system prompt is built)
4. OpenClaw `src/agents/standing-orders.ts` (reference)

---

## Context

Standing orders are persistent behavioral directives injected into every agent
turn. Unlike skills (procedural knowledge) or memory (facts), they express what
the agent SHOULD or MUST do. Examples:

- "Always respond in plain text, never markdown"
- "Never mention competitor names in code"
- "Read AGENTS.md before any code change"
- "Confirm before any filesystem write outside /tmp"

These survive session resets, daily cleanup, and channel switches.

---

## Goal

### Step 1: Data Model

Create `agents/standing-orders-types.ts`:

```typescript
export interface StandingOrder {
  id: string; // uuid v4
  agentId: string; // which agent this applies to ('*' for all)
  directive: string; // the order text (1-2000 chars)
  priority: number; // higher = listed first in prompt (default 0)
  enabled: boolean; // can be toggled off without deleting
  source: 'user' | 'system' | 'heartbeat' | 'plugin';
  metadata?: {
    channel?: string; // scope to specific channel
    expiresAt?: number; // auto-expire at timestamp
    tags?: string[]; // for filtering
  };
  createdAt: number; // Date.now()
  updatedAt: number;
}
```

### Step 2: Storage

Create `agents/standing-orders-store.ts`:

```typescript
import { randomUUID } from 'node:crypto';
import type { StandingOrder } from './standing-orders-types';

export class StandingOrdersStore {
  private db: Database; // SQLite or Postgres
  private cache: Map<string, StandingOrder[]> = new Map();

  constructor(db: Database) {
    this.db = db;
    this.ensureTable();
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS standing_orders (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL DEFAULT '*',
        directive TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL DEFAULT 'user',
        metadata TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_so_agent ON standing_orders(agent_id, enabled);
    `);
  }

  async add(order: Omit<StandingOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<StandingOrder> {
    const now = Date.now();
    const id = randomUUID();
    const so: StandingOrder = { id, ...order, createdAt: now, updatedAt: now };

    this.db.run(`
      INSERT INTO standing_orders (id, agent_id, directive, priority, enabled, source, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [so.id, so.agentId, so.directive, so.priority, so.enabled ? 1 : 0, so.source, JSON.stringify(so.metadata || {}), so.createdAt, so.updatedAt]);

    this.invalidateCache(so.agentId);
    return so;
  }

  async list(agentId: string): Promise<StandingOrder[]> {
    const cached = this.cache.get(agentId);
    if (cached) return cached;

    const rows = this.db.query(`
      SELECT * FROM standing_orders
      WHERE (agent_id = ? OR agent_id = '*') AND enabled = 1
      ORDER BY priority DESC, created_at ASC
    `, [agentId]).all();

    const orders = rows.map(this.rowToOrder);
    this.cache.set(agentId, orders);
    return orders;
  }

  async remove(id: string): Promise<boolean> {
    const order = this.get(id);
    const result = this.db.run('DELETE FROM standing_orders WHERE id = ?', [id]);
    if (order) this.invalidateCache(order.agentId);
    return result.changes > 0;
  }

  async update(id: string, patch: Partial<StandingOrder>): Promise<StandingOrder | null> {
    const order = this.get(id);
    if (!order) return null;
    const updated = { ...order, ...patch, updatedAt: Date.now() };
    this.db.run('UPDATE standing_orders SET directive=?, priority=?, enabled=?, metadata=? WHERE id=?',
      [updated.directive, updated.priority, updated.enabled ? 1 : 0, JSON.stringify(updated.metadata), id]);
    this.invalidateCache(updated.agentId);
    return updated;
  }

  private get(id: string): StandingOrder | null {
    const row = this.db.query('SELECT * FROM standing_orders WHERE id = ?', [id]).get();
    return row ? this.rowToOrder(row) : null;
  }

  private rowToOrder(row: any): StandingOrder {
    return {
      id: row.id,
      agentId: row.agent_id,
      directive: row.directive,
      priority: row.priority,
      enabled: row.enabled === 1,
      source: row.source,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private invalidateCache(agentId: string): void {
    this.cache.delete(agentId);
    this.cache.delete('*');
  }
}
```

### Step 3: System Prompt Injection

In `agents/system-prompt.ts`, add a "Standing Orders" section:

```typescript
// In system prompt assembly pipeline:
async function buildStandingOrdersSection(
  agentId: string,
  store: StandingOrdersStore,
): Promise<string> {
  const orders = await store.list(agentId);
  if (orders.length === 0) return '';

  const lines = ['', '## Standing Orders', ''];
  lines.push('The following directives are always in effect. Follow them strictly:');
  lines.push('');

  for (const order of orders) {
    const source = order.source === 'user' ? '' : ` (${order.source})`;
    const expiry = order.metadata?.expiresAt
      ? ` [expires ${new Date(order.metadata.expiresAt).toISOString().split('T')[0]}]`
      : '';
    lines.push(`- ${order.directive}${source}${expiry}`);
  }

  lines.push('');
  return lines.join('\n');
}

// Wire into system prompt at appropriate position (after skills, before tool list):
// const standingOrders = await buildStandingOrdersSection(agentId, this.soStore);
// if (standingOrders) sections.push(standingOrders);
```

### Step 4: Auto-Expiry Cleanup

Add a periodic cleanup (runs every 5 minutes via existing TaskScheduler):

```typescript
async cleanupExpiredOrders(store: StandingOrdersStore): Promise<number> {
  const now = Date.now();
  const allOrders = await store.list('*');
  let removed = 0;

  for (const order of allOrders) {
    if (order.metadata?.expiresAt && order.metadata.expiresAt < now) {
      await store.remove(order.id);
      removed++;
    }
  }

  return removed;
}
```

---

## Testing

```typescript
// tests/agents/standing-orders.test.ts
describe('StandingOrdersStore', () => {
  it('adds and lists orders');
  it('removes an order');
  it('updates an order');
  it('lists only enabled orders');
  it('returns agent-specific + global (*) orders');
  it('sorts by priority then creation date');
  it('builds system prompt section with orders');
  it('cleanup removes expired orders');
});
```

---

## Existing Carina code to integrate with

- `agents/system-prompt.ts` -- add standing orders section
- `memory/backends/` -- use existing DB connection
- `agents/scheduled-tasks.ts` -- register expiry cleanup on tick
- `config/schema.ts` -- `CARINA_STANDING_ORDERS_ENABLED` env flag
- `db/migrations/` -- new migration for `standing_orders` table

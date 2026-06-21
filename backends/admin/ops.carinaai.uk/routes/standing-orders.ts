import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { query, tableExists } from '../lib/db.js';

export const standingOrdersRouter = Router();

type OrderRow = {
  id: string;
  agent_id: string;
  directive: string;
  priority: number;
  enabled: boolean;
  source: string;
  created_at: string;
};

standingOrdersRouter.get('/', async (_req, res) => {
  try {
    const ready = await tableExists('standing_orders');
    const orders = ready
      ? (await query<OrderRow>(
        `SELECT id, agent_id, directive, priority, enabled, source, created_at
         FROM standing_orders ORDER BY priority DESC, created_at ASC LIMIT 200`,
      )).rows
      : [];
    res.render('standing-orders/index', { orders, ready });
  } catch (err) {
    res.status(500).render('error', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

standingOrdersRouter.post('/add', async (req, res) => {
  const directive = String(req.body.directive ?? '').trim();
  const agentId = String(req.body.agent_id ?? '*').trim() || '*';
  if (!directive) {
    res.redirect('/standing-orders');
    return;
  }
  const id = randomUUID();
  const now = Date.now();
  await query(
    `INSERT INTO standing_orders (id, agent_id, directive, priority, enabled, source, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, 0, TRUE, 'user', '{}'::jsonb, $4, $4)`,
    [id, agentId, directive, now],
  );
  res.redirect('/standing-orders');
});

standingOrdersRouter.post('/:id/toggle', async (req, res) => {
  await query(
    `UPDATE standing_orders SET enabled = NOT enabled, updated_at = $2 WHERE id = $1`,
    [req.params.id, Date.now()],
  );
  res.redirect('/standing-orders');
});

standingOrdersRouter.post('/:id/delete', async (req, res) => {
  await query('DELETE FROM standing_orders WHERE id = $1', [req.params.id]);
  res.redirect('/standing-orders');
});

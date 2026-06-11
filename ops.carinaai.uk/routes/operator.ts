import { Router } from 'express';
import { query } from '../lib/db.js';

export const operatorRouter = Router();

operatorRouter.get('/status', async (_req, res) => {
  try {
    const [skills, kanban] = await Promise.all([
      query<{ status: string; count: string }>(
        `SELECT COALESCE(status, 'active') AS status, COUNT(*)::text AS count
         FROM skill_documents
         GROUP BY COALESCE(status, 'active')`,
      ),
      query<{ column_name: string; count: string }>(
        `SELECT column_name, COUNT(*)::text AS count
         FROM kanban_cards
         GROUP BY column_name`,
      ),
    ]);

    const skillCounts: Record<string, number> = {};
    for (const row of skills.rows) {
      skillCounts[row.status] = Number(row.count);
    }

    const kanbanCounts: Record<string, number> = {};
    for (const row of kanban.rows) {
      kanbanCounts[row.column_name] = Number(row.count);
    }

    res.json({
      ok: true,
      generated_at: new Date().toISOString(),
      curator: {
        active: skillCounts.active ?? 0,
        archived: skillCounts.archived ?? 0,
        pruned: skillCounts.pruned ?? 0,
      },
      kanban: kanbanCounts,
      note: 'Read-only operator summary. Use carina curator / carina kanban / carina credentials on the host.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

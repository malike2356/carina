import { pool } from '../db.js';
import { PLAYBOOKS } from './playbook-registry.js';

export async function seedPlaybooks(): Promise<void> {
  for (const p of PLAYBOOKS) {
    await pool.query(
      `INSERT INTO action_playbooks (id, event_type, min_severity, title, summary, risk_note, category, actions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         risk_note = EXCLUDED.risk_note,
         category = EXCLUDED.category,
         actions = EXCLUDED.actions,
         updated_at = NOW()`,
      [p.id, p.eventType, p.minSeverity, p.title, p.summary, p.riskNote, p.category, JSON.stringify(p.actions)],
    );
  }
}

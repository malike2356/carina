import { Router } from 'express';
import { query } from '../lib/db.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (_req, res) => {
  try {
    const [
      memories,
      sessions,
      skills,
      topSkill,
      ragChunks,
      packs,
      unreadEmails,
      recentSessions,
      recentSkills,
    ] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM episodic_memories'),
      query<{ count: string }>(
        'SELECT COUNT(DISTINCT session_id)::text AS count FROM episodic_memories',
      ),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM skill_documents'),
      query<{ name: string; usage_count: number }>(
        `SELECT name, usage_count FROM skill_documents
         ORDER BY usage_count DESC NULLS LAST LIMIT 1`,
      ),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM rag_chunks'),
      query<{ pack: string }>('SELECT DISTINCT pack FROM rag_chunks ORDER BY pack'),
      query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM inbound_emails WHERE read = FALSE',
      ),
      query<{ session_id: string; message_count: string; last_seen: Date }>(
        `SELECT session_id,
                COUNT(*)::text AS message_count,
                MAX(created_at) AS last_seen
         FROM episodic_memories
         GROUP BY session_id
         ORDER BY last_seen DESC
         LIMIT 10`,
      ),
      query<{
        id: string;
        name: string;
        created_at: Date;
        usage_count: number;
      }>(
        `SELECT id, name, created_at, usage_count
         FROM skill_documents
         ORDER BY created_at DESC
         LIMIT 5`,
      ),
    ]);

    res.render('dashboard', {
      stats: {
        totalMemories: memories.rows[0]?.count ?? '0',
        sessions: sessions.rows[0]?.count ?? '0',
        skills: skills.rows[0]?.count ?? '0',
        topSkill: topSkill.rows[0] ?? null,
        ragChunks: ragChunks.rows[0]?.count ?? '0',
        packs: packs.rows.map((r) => r.pack),
        unreadEmails: unreadEmails.rows[0]?.count ?? '0',
      },
      recentSessions: recentSessions.rows,
      recentSkills: recentSkills.rows,
      carinaApiUrl: process.env.CARINA_API_URL ?? 'http://localhost:3000',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

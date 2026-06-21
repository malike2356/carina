import { Router } from 'express';
import { query, tableExists } from '../lib/db.js';
import { fetchTenantSummary, hostedTablesReady } from '../lib/tenants.js';
import { CARINA_BASE } from '../lib/carina.js';

export const dashboardRouter = Router();
const uiVersion = process.env.UI_VERSION ?? '20260620';

dashboardRouter.get('/', async (req, res) => {
  if (req.query.v !== uiVersion) {
    res.redirect('/?v=' + encodeURIComponent(uiVersion));
    return;
  }

  try {
    const hasMemories = await tableExists('episodic_memories');
    const memoryCounts = hasMemories
      ? await Promise.all([
          query<{ count: string }>('SELECT COUNT(*)::text AS count FROM episodic_memories'),
          query<{ count: string }>(
            'SELECT COUNT(DISTINCT session_id)::text AS count FROM episodic_memories',
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
        ])
      : null;

    const hasSkillTables = await tableExists('skill_documents');
    const skillCounts = hasSkillTables
      ? await Promise.all([
          query<{ count: string }>('SELECT COUNT(*)::text AS count FROM skill_documents'),
          query<{ name: string; usage_count: number }>(
            `SELECT name, usage_count FROM skill_documents
             ORDER BY usage_count DESC NULLS LAST LIMIT 1`,
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
        ])
      : null;

    const ragCounts = hasSkillTables && await tableExists('rag_chunks')
      ? await Promise.all([
          query<{ count: string }>('SELECT COUNT(*)::text AS count FROM rag_chunks'),
          query<{ pack: string }>('SELECT DISTINCT pack FROM rag_chunks ORDER BY pack'),
        ])
      : null;

    const unreadEmails = await tableExists('inbound_emails')
      ? await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM inbound_emails WHERE read = FALSE')
      : { rows: [{ count: '0' }] } as { rows: Array<{ count: string }> };

    const [
      memories,
      sessions,
      skills,
      topSkill,
      ragChunks,
      packs,
      recentSessions,
      recentSkills,
    ] = [
      memoryCounts?.[0] ?? { rows: [{ count: '0' }] },
      memoryCounts?.[1] ?? { rows: [{ count: '0' }] },
      skillCounts?.[0] ?? { rows: [{ count: '0' }] },
      skillCounts?.[1] ?? { rows: [] },
      ragCounts?.[0] ?? { rows: [{ count: '0' }] },
      ragCounts?.[1] ?? { rows: [] },
      memoryCounts?.[2] ?? { rows: [] },
      skillCounts?.[2] ?? { rows: [] },
    ];

    const tenantReady = await hostedTablesReady();
    const tenantSummary = tenantReady ? await fetchTenantSummary() : null;

    res.render('dashboard', {
      tenantSummary,
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
      carinaApiUrl: CARINA_BASE,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

import { pool } from '../memory/db.js';
import { getSkillByName } from './store.js';
import { listLearningEvents } from './learning-events.js';
import { getLastCuratorRunMs } from './curator.js';
import { restoreSkillVersion } from './skill-versions.js';
import { logSkillAction } from './skill-audit-log.js';
import { appendLearningEvent } from './learning-events.js';

export interface LearningLoopMetrics {
  generatedAt: string;
  eventsLast24h: number;
  correctionsLast24h: number;
  draftsPending: number;
  promotionsLast7d: number;
  lastCuratorRunAt: string | null;
  lastPreferenceLearnedAt: string | null;
  preferencesLearnedTotal: number;
  autoSkillEnabled: boolean;
  curatorEnabled: boolean;
}

export interface LearnedPreferenceRow {
  eventId: string;
  preference: string;
  action: 'added' | 'replaced';
  confidence?: number;
  learnedAt: string;
  sessionId?: string;
}

export interface PendingCorrectionRow {
  skillId: string;
  skillName: string;
  status: string;
  description: string;
  usageCount: number;
  successCount: number;
  failureCount: number;
  updatedAt: string;
  source: 'draft' | 'correction_event';
  eventId?: string;
}

export interface AcceptedImprovementRow {
  eventId: string;
  eventType: string;
  skillName: string;
  skillId?: string;
  version?: number;
  createdAt: string;
  summary?: Record<string, unknown>;
}

export async function getLearningLoopMetrics(tenantId = '__operator__'): Promise<LearningLoopMetrics> {
  const lastCuratorMs = await getLastCuratorRunMs();
  try {
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM learning_events
          WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours') AS events_24h,
         (SELECT COUNT(*)::int FROM learning_events
          WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
            AND event_type IN ('skill_conflict_resolved', 'preference_learned', 'preference_replaced')) AS corrections_24h,
         (SELECT COUNT(*)::int FROM skill_documents WHERE COALESCE(status, 'active') = 'draft') AS drafts_pending,
         (SELECT COUNT(*)::int FROM skill_audit_log
          WHERE action = 'promoted' AND created_at > NOW() - INTERVAL '7 days') AS promotions_7d,
         (SELECT MAX(created_at)::text FROM learning_events
          WHERE tenant_id = $1 AND event_type IN ('preference_learned', 'preference_replaced')) AS last_pref_at,
         (SELECT COUNT(*)::int FROM learning_events
          WHERE tenant_id = $1 AND event_type IN ('preference_learned', 'preference_replaced')) AS pref_total`,
      [tenantId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return {
      generatedAt: new Date().toISOString(),
      eventsLast24h: Number(row?.events_24h ?? 0),
      correctionsLast24h: Number(row?.corrections_24h ?? 0),
      draftsPending: Number(row?.drafts_pending ?? 0),
      promotionsLast7d: Number(row?.promotions_7d ?? 0),
      lastCuratorRunAt: lastCuratorMs > 0 ? new Date(lastCuratorMs).toISOString() : null,
      lastPreferenceLearnedAt: row?.last_pref_at ? String(row.last_pref_at) : null,
      preferencesLearnedTotal: Number(row?.pref_total ?? 0),
      autoSkillEnabled: process.env.CARINA_AUTO_SKILL !== 'false',
      curatorEnabled: process.env.CARINA_SKILL_CURATOR_ENABLED !== 'false',
    };
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      eventsLast24h: 0,
      correctionsLast24h: 0,
      draftsPending: 0,
      promotionsLast7d: 0,
      lastCuratorRunAt: lastCuratorMs > 0 ? new Date(lastCuratorMs).toISOString() : null,
      lastPreferenceLearnedAt: null,
      preferencesLearnedTotal: 0,
      autoSkillEnabled: process.env.CARINA_AUTO_SKILL !== 'false',
      curatorEnabled: process.env.CARINA_SKILL_CURATOR_ENABLED !== 'false',
    };
  }
}

export async function listPendingCorrections(
  tenantId = '__operator__',
  limit = 50,
): Promise<PendingCorrectionRow[]> {
  const cap = Math.min(100, Math.max(1, limit));
  const rows: PendingCorrectionRow[] = [];

  try {
    const drafts = await pool.query(
      `SELECT id, name, description, usage_count, success_count, failure_count, updated_at, status
       FROM skill_documents
       WHERE COALESCE(status, 'active') = 'draft'
       ORDER BY updated_at DESC
       LIMIT $1`,
      [cap],
    );
    for (const row of drafts.rows) {
      rows.push({
        skillId: String(row.id),
        skillName: String(row.name),
        status: String(row.status ?? 'draft'),
        description: String(row.description ?? ''),
        usageCount: Number(row.usage_count ?? 0),
        successCount: Number(row.success_count ?? 0),
        failureCount: Number(row.failure_count ?? 0),
        updatedAt: String(row.updated_at),
        source: 'draft',
      });
    }
  } catch {
    // continue with event-based rows
  }

  const events = await listLearningEvents({
    tenantId,
    limit: cap,
  });
  for (const event of events) {
    if (!event.skillName) continue;
    if (!['skill_conflict_resolved', 'skill_refined', 'preference_learned'].includes(event.eventType)) {
      continue;
    }
    if (rows.some((r) => r.skillName === event.skillName && r.source === 'correction_event')) continue;
    rows.push({
      skillId: event.skillId ?? '',
      skillName: event.skillName,
      status: 'correction',
      description: `Learning event: ${event.eventType}`,
      usageCount: 0,
      successCount: 0,
      failureCount: 0,
      updatedAt: event.createdAt,
      source: 'correction_event',
      eventId: event.id,
    });
  }

  return rows.slice(0, cap);
}

export async function listLearnedPreferences(
  tenantId = '__operator__',
  limit = 30,
): Promise<LearnedPreferenceRow[]> {
  const events = await listLearningEvents({ tenantId, limit: Math.min(200, limit * 3) });
  return events
    .filter((e) => e.eventType === 'preference_learned' || e.eventType === 'preference_replaced')
    .slice(0, Math.min(100, limit))
    .map((e) => {
      const summary = e.outputSummary ?? {};
      return {
        eventId: e.id,
        preference: String(summary.preference ?? ''),
        action: e.eventType === 'preference_replaced' ? 'replaced' as const : 'added' as const,
        confidence: summary.confidence == null ? undefined : Number(summary.confidence),
        learnedAt: e.createdAt,
        sessionId: e.sessionId,
      };
    })
    .filter((row) => row.preference.length > 0);
}

export async function listAcceptedImprovements(
  tenantId = '__operator__',
  limit = 50,
): Promise<AcceptedImprovementRow[]> {
  const events = await listLearningEvents({ tenantId, limit: Math.min(200, limit * 2) });
  return events
    .filter((e) => ['skill_created', 'skill_refined', 'skill_conflict_resolved'].includes(e.eventType))
    .slice(0, Math.min(100, limit))
    .map((e) => ({
      eventId: e.id,
      eventType: e.eventType,
      skillName: e.skillName ?? '(unknown)',
      skillId: e.skillId ?? undefined,
      version: e.version,
      createdAt: e.createdAt,
      summary: e.outputSummary,
    }));
}

export async function rollbackSkillByName(
  skillName: string,
  version: number,
  options: { tenantId?: string; reason?: string } = {},
): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
  const skill = await getSkillByName(skillName);
  if (!skill) {
    return { ok: false, message: `Skill not found: ${skillName}` };
  }

  const result = await restoreSkillVersion({
    skillId: skill.id,
    skillName: skill.name,
    version,
    reason: options.reason,
  });

  if (!result.restored) {
    return {
      ok: false,
      message: result.reason ?? 'rollback_failed',
      details: { skillName, version, fromVersion: result.fromVersion },
    };
  }

  await logSkillAction('rolled_back', skill.id, {
    targetVersion: version,
    fromVersion: result.fromVersion,
    toVersion: result.toVersion,
    reason: options.reason ?? 'operator rollback',
  });
  await appendLearningEvent({
    tenantId: options.tenantId ?? '__operator__',
    eventType: 'skill_rolled_back',
    skillId: skill.id,
    skillName: skill.name,
    version: result.toVersion,
    inputSummary: { rollbackToVersion: version },
    outputSummary: {
      fromVersion: result.fromVersion,
      toVersion: result.toVersion,
      reason: options.reason ?? 'operator rollback',
    },
  });

  return {
    ok: true,
    message: `Rolled back ${skillName} to version ${version} (new snapshot v${result.toVersion})`,
    details: {
      fromVersion: result.fromVersion,
      toVersion: result.toVersion,
      rollbackToVersion: version,
    },
  };
}

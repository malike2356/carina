import { pool } from '../memory/db.js';

export interface SkillVersionSnapshot {
  skillId: string;
  version: number;
  steps: string;
  trigger: string[];
  toolsUsed: string[];
  source: string;
  learningEventId?: string | null;
}

export async function getLatestSkillVersion(skillId: string): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT COALESCE(MAX(version), 0) AS version FROM skill_versions WHERE skill_id = $1`,
      [skillId],
    );
    return Number(result.rows[0]?.version ?? 0);
  } catch {
    return 0;
  }
}

export async function recordSkillVersion(
  snapshot: SkillVersionSnapshot,
): Promise<number | null> {
  try {
    const result = await pool.query(
      `INSERT INTO skill_versions
        (skill_id, version, steps, trigger_keywords, tools_used, source, learning_event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (skill_id, version) DO NOTHING
       RETURNING version`,
      [
        snapshot.skillId,
        snapshot.version,
        snapshot.steps,
        snapshot.trigger,
        snapshot.toolsUsed,
        snapshot.source,
        snapshot.learningEventId ?? null,
      ],
    );
    if (result.rows[0]) return Number(result.rows[0].version);
    return snapshot.version;
  } catch {
    return null;
  }
}

export async function getSkillVersionSnapshot(
  skillId: string,
  version: number,
): Promise<(SkillVersionSnapshot & { createdAt: string }) | null> {
  try {
    const result = await pool.query(
      `SELECT skill_id, version, steps, trigger_keywords, tools_used, source, learning_event_id, created_at
       FROM skill_versions
       WHERE skill_id = $1 AND version = $2
       LIMIT 1`,
      [skillId, version],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      skillId: String(row.skill_id),
      version: Number(row.version),
      steps: String(row.steps),
      trigger: (row.trigger_keywords as string[]) ?? [],
      toolsUsed: (row.tools_used as string[]) ?? [],
      source: String(row.source),
      learningEventId: row.learning_event_id ? String(row.learning_event_id) : null,
      createdAt: String(row.created_at),
    };
  } catch {
    return null;
  }
}

export interface RestoreSkillVersionResult {
  restored: boolean;
  skillId?: string;
  skillName?: string;
  fromVersion?: number;
  toVersion?: number;
  reason?: string;
}

export async function restoreSkillVersion(input: {
  skillId: string;
  skillName: string;
  version: number;
  reason?: string;
}): Promise<RestoreSkillVersionResult> {
  const snapshot = await getSkillVersionSnapshot(input.skillId, input.version);
  if (!snapshot) {
    return { restored: false, reason: 'version_not_found' };
  }

  const currentVersion = await getLatestSkillVersion(input.skillId);
  if (currentVersion === input.version) {
    return {
      restored: false,
      skillId: input.skillId,
      skillName: input.skillName,
      fromVersion: input.version,
      reason: 'already_at_version',
    };
  }

  try {
    await pool.query(
      `UPDATE skill_documents
       SET steps = $2, trigger_keywords = $3, tools_used = $4, updated_at = NOW()
       WHERE id = $1`,
      [input.skillId, snapshot.steps, snapshot.trigger, snapshot.toolsUsed],
    );
    const nextVersion = currentVersion + 1;
    await recordSkillVersion({
      skillId: input.skillId,
      version: nextVersion,
      steps: snapshot.steps,
      trigger: snapshot.trigger,
      toolsUsed: snapshot.toolsUsed,
      source: `rollback-to-v${input.version}`,
      learningEventId: snapshot.learningEventId,
    });
    return {
      restored: true,
      skillId: input.skillId,
      skillName: input.skillName,
      fromVersion: currentVersion,
      toVersion: nextVersion,
    };
  } catch {
    return { restored: false, reason: 'restore_failed' };
  }
}

export async function listSkillVersions(
  skillId: string,
  limit = 20,
): Promise<Array<SkillVersionSnapshot & { createdAt: string }>> {
  try {
    const result = await pool.query(
      `SELECT skill_id, version, steps, trigger_keywords, tools_used, source, learning_event_id, created_at
       FROM skill_versions
       WHERE skill_id = $1
       ORDER BY version DESC
       LIMIT $2`,
      [skillId, limit],
    );
    return result.rows.map((row) => ({
      skillId: String(row.skill_id),
      version: Number(row.version),
      steps: String(row.steps),
      trigger: (row.trigger_keywords as string[]) ?? [],
      toolsUsed: (row.tools_used as string[]) ?? [],
      source: String(row.source),
      learningEventId: row.learning_event_id ? String(row.learning_event_id) : null,
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}

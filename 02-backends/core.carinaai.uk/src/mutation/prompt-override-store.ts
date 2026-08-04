import { pool } from '../memory/db.js';
import { logSelfModEvent } from '../security/self-mod-logger.js';

export const SYSTEM_PROMPT_OVERRIDES_MIGRATION = `
CREATE TABLE IF NOT EXISTS system_prompt_overrides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL,
  prompt_key   TEXT NOT NULL DEFAULT 'context_overlay',
  version      INTEGER NOT NULL,
  content      TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   TEXT NOT NULL,
  rationale    TEXT,
  confidence   FLOAT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  UNIQUE (tenant_id, prompt_key, version)
);
CREATE INDEX IF NOT EXISTS idx_spo_tenant_key_active
  ON system_prompt_overrides(tenant_id, prompt_key, is_active);
`;

export interface PromptOverrideRecord {
  id: string;
  tenantId: string;
  promptKey: string;
  version: number;
  content: string;
  isActive: boolean;
  createdBy: string;
  rationale?: string;
  confidence?: number;
  createdAt: string;
  activatedAt?: string;
}

type DbRow = Record<string, unknown>;

function rowToRecord(r: DbRow): PromptOverrideRecord {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    promptKey: r.prompt_key as string,
    version: Number(r.version),
    content: r.content as string,
    isActive: Boolean(r.is_active),
    createdBy: r.created_by as string,
    rationale: r.rationale as string | undefined,
    confidence: r.confidence != null ? Number(r.confidence) : undefined,
    createdAt: r.created_at as string,
    activatedAt: r.activated_at as string | undefined,
  };
}

export class PromptOverrideStore {
  async getActiveOverlay(tenantId: string): Promise<string | null> {
    const result = await pool.query<DbRow>(
      `SELECT content FROM system_prompt_overrides
       WHERE tenant_id = $1 AND prompt_key = 'context_overlay' AND is_active = TRUE
       LIMIT 1`,
      [tenantId],
    );
    return (result.rows[0]?.content as string) ?? null;
  }

  async stageImprovement(opts: {
    tenantId: string;
    content: string;
    rationale: string;
    confidence: number;
    createdBy: string;
    autoApproveThreshold?: number;
  }): Promise<PromptOverrideRecord> {
    const threshold = opts.autoApproveThreshold
      ?? parseFloat(process.env.CARINA_MUTATION_PROMPT_AUTO_APPROVE_THRESHOLD ?? '0.90');

    const versionResult = await pool.query<{ max: string | number | null }>(
      `SELECT COALESCE(MAX(version), 0) AS max FROM system_prompt_overrides
       WHERE tenant_id = $1 AND prompt_key = 'context_overlay'`,
      [opts.tenantId],
    );
    const nextVersion = Number(versionResult.rows[0]?.max ?? 0) + 1;

    const shouldAutoApprove = opts.confidence >= threshold;

    const result = await pool.query<DbRow>(
      `INSERT INTO system_prompt_overrides
         (tenant_id, prompt_key, version, content, is_active, created_by, rationale, confidence,
          activated_at)
       VALUES ($1, 'context_overlay', $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        opts.tenantId,
        nextVersion,
        opts.content,
        shouldAutoApprove,
        opts.createdBy,
        opts.rationale,
        opts.confidence,
        shouldAutoApprove ? new Date().toISOString() : null,
      ],
    );

    const record = rowToRecord(result.rows[0]!);

    if (shouldAutoApprove) {
      await pool.query(
        `UPDATE system_prompt_overrides SET is_active = FALSE
         WHERE tenant_id = $1 AND prompt_key = 'context_overlay' AND id != $2`,
        [opts.tenantId, record.id],
      );
      void logSelfModEvent('PROMPT_OVERRIDE_AUTO_APPROVED', {
        tenant_id: opts.tenantId,
        version: nextVersion,
        confidence: opts.confidence,
      });
    } else {
      void logSelfModEvent('PROMPT_OVERRIDE_STAGED', {
        tenant_id: opts.tenantId,
        version: nextVersion,
        confidence: opts.confidence,
      });
    }

    return record;
  }

  async activate(id: string, activatedBy: string): Promise<PromptOverrideRecord> {
    const record = await pool.query<DbRow>(
      `SELECT * FROM system_prompt_overrides WHERE id = $1`,
      [id],
    );
    if (!record.rows[0]) throw new Error(`Prompt override ${id} not found`);
    const r = rowToRecord(record.rows[0]);

    await pool.query(
      `UPDATE system_prompt_overrides SET is_active = FALSE
       WHERE tenant_id = $1 AND prompt_key = $2 AND id != $3`,
      [r.tenantId, r.promptKey, id],
    );

    const updated = await pool.query<DbRow>(
      `UPDATE system_prompt_overrides
       SET is_active = TRUE, activated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );

    void logSelfModEvent('PROMPT_OVERRIDE_ACTIVATED', {
      tenant_id: r.tenantId,
      version: r.version,
      activated_by: activatedBy,
    });

    return rowToRecord(updated.rows[0]!);
  }

  async rollback(tenantId: string, rolledBackBy: string): Promise<PromptOverrideRecord | null> {
    const previous = await pool.query<DbRow>(
      `SELECT * FROM system_prompt_overrides
       WHERE tenant_id = $1 AND prompt_key = 'context_overlay'
         AND is_active = FALSE AND activated_at IS NOT NULL
       ORDER BY activated_at DESC LIMIT 1`,
      [tenantId],
    );
    if (!previous.rows[0]) return null;

    const restored = rowToRecord(previous.rows[0]);
    await this.activate(restored.id, rolledBackBy);

    void logSelfModEvent('PROMPT_OVERRIDE_ROLLED_BACK', {
      tenant_id: tenantId,
      restored_version: restored.version,
      rolled_back_by: rolledBackBy,
    });

    return restored;
  }

  async getHistory(tenantId: string, limit = 20): Promise<PromptOverrideRecord[]> {
    const result = await pool.query<DbRow>(
      `SELECT * FROM system_prompt_overrides
       WHERE tenant_id = $1 AND prompt_key = 'context_overlay'
       ORDER BY version DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(rowToRecord);
  }

  async listStaged(tenantId: string): Promise<PromptOverrideRecord[]> {
    const result = await pool.query<DbRow>(
      `SELECT * FROM system_prompt_overrides
       WHERE tenant_id = $1 AND is_active = FALSE AND activated_at IS NULL
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(rowToRecord);
  }
}

export const promptOverrideStore = new PromptOverrideStore();

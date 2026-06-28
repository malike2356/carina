import { pool } from '../../memory/db.js';
import crypto from 'crypto';

export const RUNTIME_TOOLS_MIGRATION = `
CREATE TABLE IF NOT EXISTS runtime_tools (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL,
  description         TEXT NOT NULL,
  category            TEXT NOT NULL DEFAULT 'custom',
  parameters_json     TEXT NOT NULL,
  source_code         TEXT NOT NULL,
  source_code_hash    TEXT NOT NULL,
  generation_prompt   TEXT,
  generated_by        TEXT NOT NULL DEFAULT 'carina',
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_used          TEXT,
  static_scan_passed  BOOLEAN NOT NULL DEFAULT FALSE,
  sandbox_test_passed BOOLEAN NOT NULL DEFAULT FALSE,
  sandbox_test_output TEXT,
  avg_duration_ms     INTEGER,
  times_used          INTEGER NOT NULL DEFAULT 0,
  last_used_at        TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'pending',
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  risk_level          TEXT NOT NULL DEFAULT 'low',
  sandbox_memory_mb   INTEGER NOT NULL DEFAULT 128,
  sandbox_timeout_ms  INTEGER NOT NULL DEFAULT 30000,
  fetch_allowed_domains TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runtime_tools_status ON runtime_tools(status);
CREATE INDEX IF NOT EXISTS idx_runtime_tools_category ON runtime_tools(category);
CREATE INDEX IF NOT EXISTS idx_runtime_tools_name ON runtime_tools(name);
`;

export interface RuntimeToolRecord {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  parametersJson: string;
  sourceCode: string;
  sourceCodeHash: string;
  generationPrompt?: string;
  generatedBy: string;
  generatedAt: string;
  modelUsed?: string;
  staticScanPassed: boolean;
  sandboxTestPassed: boolean;
  sandboxTestOutput?: string;
  avgDurationMs?: number;
  timesUsed: number;
  lastUsedAt?: string;
  status: 'pending' | 'active' | 'disabled' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  riskLevel: 'low' | 'medium' | 'high';
  sandboxMemoryMb: number;
  sandboxTimeoutMs: number;
  fetchAllowedDomains?: string;
  createdAt?: string;
  updatedAt?: string;
}

type DbRow = Record<string, unknown>;

function rowToRecord(row: DbRow): RuntimeToolRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    displayName: (row.display_name ?? row.displayName) as string,
    description: row.description as string,
    category: row.category as string,
    parametersJson: (row.parameters_json ?? row.parametersJson) as string,
    sourceCode: (row.source_code ?? row.sourceCode) as string,
    sourceCodeHash: (row.source_code_hash ?? row.sourceCodeHash) as string,
    generationPrompt: (row.generation_prompt ?? row.generationPrompt) as string | undefined,
    generatedBy: (row.generated_by ?? row.generatedBy) as string,
    generatedAt: (row.generated_at ?? row.generatedAt) as string,
    modelUsed: (row.model_used ?? row.modelUsed) as string | undefined,
    staticScanPassed: Boolean(row.static_scan_passed ?? row.staticScanPassed),
    sandboxTestPassed: Boolean(row.sandbox_test_passed ?? row.sandboxTestPassed),
    sandboxTestOutput: (row.sandbox_test_output ?? row.sandboxTestOutput) as string | undefined,
    avgDurationMs: (row.avg_duration_ms ?? row.avgDurationMs) as number | undefined,
    timesUsed: Number(row.times_used ?? row.timesUsed ?? 0),
    lastUsedAt: (row.last_used_at ?? row.lastUsedAt) as string | undefined,
    status: (row.status as RuntimeToolRecord['status']) ?? 'pending',
    approvedBy: (row.approved_by ?? row.approvedBy) as string | undefined,
    approvedAt: (row.approved_at ?? row.approvedAt) as string | undefined,
    riskLevel: ((row.risk_level ?? row.riskLevel) as RuntimeToolRecord['riskLevel']) ?? 'low',
    sandboxMemoryMb: Number(row.sandbox_memory_mb ?? row.sandboxMemoryMb ?? 128),
    sandboxTimeoutMs: Number(row.sandbox_timeout_ms ?? row.sandboxTimeoutMs ?? 30000),
    fetchAllowedDomains: (row.fetch_allowed_domains ?? row.fetchAllowedDomains) as string | undefined,
    createdAt: (row.created_at ?? row.createdAt) as string | undefined,
    updatedAt: (row.updated_at ?? row.updatedAt) as string | undefined,
  };
}

export class RuntimeToolStore {
  async save(tool: Omit<RuntimeToolRecord, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO runtime_tools (
         id, name, display_name, description, category, parameters_json, source_code,
         source_code_hash, generation_prompt, generated_by, model_used, static_scan_passed,
         sandbox_test_passed, sandbox_test_output, avg_duration_ms, times_used, last_used_at,
         status, risk_level, sandbox_memory_mb, sandbox_timeout_ms, fetch_allowed_domains
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),$17,$18,$19,$20,$21)`,
      [
        id, tool.name, tool.displayName, tool.description, tool.category,
        tool.parametersJson, tool.sourceCode, tool.sourceCodeHash,
        tool.generationPrompt ?? null, tool.generatedBy, tool.modelUsed ?? null,
        tool.staticScanPassed, tool.sandboxTestPassed, tool.sandboxTestOutput ?? null,
        tool.avgDurationMs ?? null, tool.timesUsed,
        tool.status, tool.riskLevel, tool.sandboxMemoryMb, tool.sandboxTimeoutMs,
        tool.fetchAllowedDomains ?? null,
      ],
    );
    return id;
  }

  async loadActive(): Promise<RuntimeToolRecord[]> {
    const result = await pool.query<DbRow>(
      `SELECT * FROM runtime_tools WHERE status = 'active' ORDER BY times_used DESC`,
    );
    return result.rows.map(rowToRecord);
  }

  async approve(id: string, approvedBy = 'operator'): Promise<void> {
    await pool.query(
      `UPDATE runtime_tools SET status = 'active', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [approvedBy, id],
    );
  }

  async disable(id: string): Promise<void> {
    await pool.query(
      `UPDATE runtime_tools SET status = 'disabled', updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async recordUse(name: string, durationMs: number): Promise<void> {
    await pool.query(
      `UPDATE runtime_tools SET
         times_used = times_used + 1,
         last_used_at = NOW(),
         avg_duration_ms = CASE WHEN avg_duration_ms IS NULL THEN $1 ELSE (avg_duration_ms + $1) / 2 END,
         updated_at = NOW()
       WHERE name = $2`,
      [durationMs, name],
    );
  }

  async findByCodeHash(hash: string): Promise<RuntimeToolRecord | null> {
    const result = await pool.query<DbRow>(
      `SELECT * FROM runtime_tools WHERE source_code_hash = $1 LIMIT 1`,
      [hash],
    );
    return result.rows[0] ? rowToRecord(result.rows[0]) : null;
  }

  async findByName(name: string): Promise<RuntimeToolRecord | null> {
    const result = await pool.query<DbRow>(
      `SELECT * FROM runtime_tools WHERE name = $1 LIMIT 1`,
      [name],
    );
    return result.rows[0] ? rowToRecord(result.rows[0]) : null;
  }

  async list(filter?: { status?: string; category?: string }): Promise<RuntimeToolRecord[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter?.status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(filter.status);
    }
    if (filter?.category) {
      conditions.push(`category = $${values.length + 1}`);
      values.push(filter.category);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query<DbRow>(`SELECT * FROM runtime_tools ${where} ORDER BY created_at DESC`, values);
    return result.rows.map(rowToRecord);
  }

  async stats(): Promise<{ total: number; active: number; pending: number; totalUses: number }> {
    const result = await pool.query<{ total: string; active: string; pending: string; total_uses: string }>(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'active') AS active,
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COALESCE(SUM(times_used), 0) AS total_uses
       FROM runtime_tools`,
    );
    const row = result.rows[0]!;
    return {
      total: +row.total,
      active: +row.active,
      pending: +row.pending,
      totalUses: +row.total_uses,
    };
  }
}

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type pg from 'pg';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import { alertDispatcher } from '../alerts/dispatcher.js';
import type { SecurityEvent } from '../alerts/types.js';

/**
 * Decoy credential categories from the honeypot spec (api_keys, passwords,
 * tokens, endpoints, databases). 'file' is a separate, non-decoy honeypot
 * type (planted credential files on disk) retained from the original design.
 */
export type DecoyCategory = 'api_key' | 'password' | 'token' | 'endpoint' | 'database';

export interface Honeypot {
  id: string;
  type: DecoyCategory | 'file';
  name: string;
  value: string;
  description: string | null;
  instanceId: string;
  triggered: boolean;
  triggeredAt: Date | null;
  triggerIp: string | null;
  triggerMetadata: Record<string, unknown>;
  retiredAt: Date | null;
  createdAt: Date;
}

interface HoneypotRow {
  id: string;
  type: DecoyCategory | 'file';
  name: string;
  value: string;
  description: string | null;
  instance_id: string;
  triggered: boolean;
  triggered_at: Date | null;
  trigger_ip: string | null;
  trigger_metadata: Record<string, unknown> | null;
  retired_at: Date | null;
  created_at: Date;
}

const HONEYPOT_PATHS = [
  '/tmp/.carina-backup.key',
  '/tmp/.env.backup',
  path.join(process.cwd(), 'data', '.api-keys.json'),
];

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ANTHROPIC_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOWER_ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Decoy credential templates per the spec's "Credential types generated"
 * table. Each category has multiple templates; one is picked at random on
 * each generation so values stay unpredictable across rotations.
 */
const DECOY_TEMPLATES: Record<DecoyCategory, string[]> = {
  api_key: ['sk-carina-decoy-{random_8}', 'carina_live_{random_12}'],
  password: ['Carina$ecure!{year}!Decoy', 'D3c0y_{random_6}_P@ss'],
  token: ['eyJ...{random_base64}...decoy', 'tkn_decoy_{random_16}'],
  endpoint: [
    'https://decoy-{random_4}.internal.carinaai.uk/v1/',
    'https://api.carinaai.uk/decoy/{random_8}/',
  ],
  database: ['postgres://decoy:decoy_{random_6}@{random_4}-db.internal:5432/decoy'],
};

const DECOY_CATEGORIES: DecoyCategory[] = ['api_key', 'password', 'token', 'endpoint', 'database'];

function randomFromAlphabet(length: number, alphabet: string): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

function fillDecoyTemplate(template: string): string {
  return template
    .replace(/\{random_base64\}/g, () => randomFromAlphabet(16, ALPHANUM))
    .replace(/\{random_(\d+)\}/g, (_match, length: string) =>
      randomFromAlphabet(parseInt(length, 10), LOWER_ALNUM),
    )
    .replace(/\{year\}/g, () => String(new Date().getFullYear()));
}

function mapRow(row: HoneypotRow): Honeypot {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    value: row.value,
    description: row.description,
    instanceId: row.instance_id,
    triggered: row.triggered,
    triggeredAt: row.triggered_at ? new Date(row.triggered_at) : null,
    triggerIp: row.trigger_ip,
    triggerMetadata:
      row.trigger_metadata && typeof row.trigger_metadata === 'object'
        ? row.trigger_metadata
        : {},
    retiredAt: row.retired_at ? new Date(row.retired_at) : null,
    createdAt: new Date(row.created_at),
  };
}

export function serializeHoneypot(honeypot: Honeypot): Record<string, unknown> {
  return {
    id: honeypot.id,
    type: honeypot.type,
    name: honeypot.name,
    value: honeypot.value,
    description: honeypot.description,
    instanceId: honeypot.instanceId,
    triggered: honeypot.triggered,
    triggeredAt: honeypot.triggeredAt?.toISOString() ?? null,
    triggerIp: honeypot.triggerIp,
    triggerMetadata: honeypot.triggerMetadata,
    retiredAt: honeypot.retiredAt?.toISOString() ?? null,
    createdAt: honeypot.createdAt.toISOString(),
  };
}

export class HoneypotManager {
  constructor(
    private readonly db: pg.Pool,
    private readonly dispatcher: { dispatch(event: SecurityEvent): Promise<void> } = alertDispatcher,
  ) {}

  async deployApiKeyHoneypot(
    instanceId: string,
    keyType: 'openai' | 'anthropic' | 'deepseek',
  ): Promise<Honeypot> {
    const value = this.generateFakeKey(keyType);
    const name = `honeypot-${keyType}-${crypto.randomUUID().slice(0, 8)}`;
    const description = `Fake ${keyType} API key deployed as honeypot for instance ${instanceId}`;

    const result = await this.db.query<HoneypotRow>(
      `INSERT INTO honeypots (type, name, value, description, instance_id)
       VALUES ('api_key', $1, $2, $3, $4)
       RETURNING *`,
      [name, value, description, instanceId],
    );

    const row = result.rows[0];
    if (!row) throw new Error('Failed to insert honeypot');
    return mapRow(row);
  }

  async deployFileHoneypots(instanceId: string): Promise<Honeypot[]> {
    const created: Honeypot[] = [];

    for (const targetPath of HONEYPOT_PATHS) {
      const absolutePath = path.resolve(targetPath);
      const content = this.buildFileContent(absolutePath);

      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content, 'utf8');

      const result = await this.db.query<HoneypotRow>(
        `INSERT INTO honeypots (type, name, value, description, instance_id)
         VALUES ('file', $1, $2, $3, $4)
         RETURNING *`,
        [
          path.basename(absolutePath),
          absolutePath,
          `Fake credential file honeypot at ${absolutePath}`,
          instanceId,
        ],
      );

      const row = result.rows[0];
      if (row) created.push(mapRow(row));
    }

    return created;
  }

  /**
   * Generates a decoy credential value for one of the five spec categories,
   * picking a random template and filling its placeholders.
   */
  generateDecoyValue(category: DecoyCategory): string {
    const templates = DECOY_TEMPLATES[category];
    const template = templates[crypto.randomInt(templates.length)]!;
    return fillDecoyTemplate(template);
  }

  /**
   * Deploys a single decoy honeypot of the given credential category for an
   * instance (the per-tenant scoping unit in this codebase - each Scout
   * instance belongs to exactly one customer/tenant).
   */
  async deployDecoyHoneypot(instanceId: string, category: DecoyCategory): Promise<Honeypot> {
    const value = this.generateDecoyValue(category);
    const name = `honeypot-${category}-${crypto.randomUUID().slice(0, 8)}`;
    const description = `Decoy ${category.replace('_', ' ')} deployed for instance ${instanceId}`;

    const result = await this.db.query<HoneypotRow>(
      `INSERT INTO honeypots (type, name, value, description, instance_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [category, name, value, description, instanceId],
    );

    const row = result.rows[0];
    if (!row) throw new Error('Failed to insert honeypot');
    return mapRow(row);
  }

  /**
   * Returns the instance's current active decoy set (one per category),
   * generating any category that does not yet have an active honeypot.
   * This is what gets formatted into the system-prompt injection block -
   * it must NOT mint fresh values on every call, only on rotation.
   */
  async getActiveSet(instanceId: string): Promise<Honeypot[]> {
    const result = await this.db.query<HoneypotRow>(
      `SELECT * FROM honeypots
       WHERE instance_id = $1
         AND type = ANY($2)
         AND retired_at IS NULL
       ORDER BY created_at DESC`,
      [instanceId, DECOY_CATEGORIES],
    );

    const active = result.rows.map(mapRow);
    const present = new Set(active.map((honeypot) => honeypot.type));

    for (const category of DECOY_CATEGORIES) {
      if (!present.has(category)) {
        active.push(await this.deployDecoyHoneypot(instanceId, category));
      }
    }

    return active;
  }

  /**
   * Rotates an instance's decoy honeypot set: retires the current active
   * decoys (they remain in the leak-detection scan window for 24 hours,
   * see scanForLeak/checkApiKey) and generates a fresh set covering all
   * five credential categories. Runs on a 60-minute schedule by default
   * (see deception/rotation-scheduler.ts).
   */
  async rotate(instanceId: string): Promise<Honeypot[]> {
    await this.db.query(
      `UPDATE honeypots
       SET retired_at = NOW()
       WHERE instance_id = $1
         AND type = ANY($2)
         AND retired_at IS NULL`,
      [instanceId, DECOY_CATEGORIES],
    );

    const fresh: Honeypot[] = [];
    for (const category of DECOY_CATEGORIES) {
      fresh.push(await this.deployDecoyHoneypot(instanceId, category));
    }
    return fresh;
  }

  /** Lists the currently-active (not retired) honeypots for an instance. */
  async listActive(instanceId: string): Promise<Honeypot[]> {
    const result = await this.db.query<HoneypotRow>(
      `SELECT * FROM honeypots
       WHERE instance_id = $1 AND retired_at IS NULL
       ORDER BY created_at DESC`,
      [instanceId],
    );
    return result.rows.map(mapRow);
  }

  /**
   * Scans agent output text for any honeypot value belonging to the
   * instance - active decoys, plus decoys retired within the last 24
   * hours (delayed-leak monitoring per the spec's rotation policy).
   * Each match triggers the honeypot and is returned so the caller can
   * fire a CRITICAL alert and block delivery to the user.
   */
  async scanForLeak(
    text: string,
    instanceId: string,
    meta: Record<string, unknown> = {},
  ): Promise<Honeypot[]> {
    if (!text) return [];

    const result = await this.db.query<HoneypotRow>(
      `SELECT * FROM honeypots
       WHERE instance_id = $1
         AND (retired_at IS NULL OR retired_at > NOW() - INTERVAL '24 hours')`,
      [instanceId],
    );

    const matches: Honeypot[] = [];
    for (const row of result.rows) {
      const honeypot = mapRow(row);
      if (honeypot.value && text.includes(honeypot.value)) {
        matches.push(honeypot);
        await this.triggerHoneypot(honeypot, meta);
      }
    }
    return matches;
  }

  async checkApiKey(key: string, meta: Record<string, unknown> = {}): Promise<boolean> {
    const result = await this.db.query<HoneypotRow>(
      `SELECT * FROM honeypots
       WHERE type = 'api_key' AND value = $1
         AND (retired_at IS NULL OR retired_at > NOW() - INTERVAL '24 hours')
       LIMIT 1`,
      [key],
    );

    const row = result.rows[0];
    if (!row) return false;

    await this.triggerHoneypot(mapRow(row), meta);
    return true;
  }

  async checkFilePath(filePath: string, meta: Record<string, unknown> = {}): Promise<boolean> {
    const resolved = path.resolve(filePath);
    const result = await this.db.query<HoneypotRow>(
      `SELECT * FROM honeypots
       WHERE type = 'file' AND value = $1
       LIMIT 1`,
      [resolved],
    );

    const row = result.rows[0];
    if (!row) return false;

    await this.triggerHoneypot(mapRow(row), meta);
    return true;
  }

  async listHoneypots(instanceId: string): Promise<Honeypot[]> {
    const result = await this.db.query<HoneypotRow>(
      `SELECT * FROM honeypots
       WHERE instance_id = $1
       ORDER BY created_at DESC`,
      [instanceId],
    );
    return result.rows.map(mapRow);
  }

  async listRecentHoneypots(instanceId?: string, limit = 200): Promise<Honeypot[]> {
    const capped = Math.min(Math.max(limit, 1), 200);
    if (instanceId?.trim()) {
      const result = await this.db.query<HoneypotRow>(
        `SELECT * FROM honeypots
         WHERE instance_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [instanceId.trim(), capped],
      );
      return result.rows.map(mapRow);
    }

    const result = await this.db.query<HoneypotRow>(
      `SELECT * FROM honeypots
       ORDER BY created_at DESC
       LIMIT $1`,
      [capped],
    );
    return result.rows.map(mapRow);
  }

  async getHoneypot(id: string): Promise<Honeypot | null> {
    const result = await this.db.query<HoneypotRow>(
      `SELECT * FROM honeypots WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  generateFakeKey(keyType: 'openai' | 'anthropic' | 'deepseek'): string {
    if (keyType === 'openai') {
      return `sk-lab-${randomFromAlphabet(48, ALPHANUM)}`;
    }
    if (keyType === 'anthropic') {
      return `sk-ant-api03-${randomFromAlphabet(95, ANTHROPIC_ALPHABET)}`;
    }
    return `sk-${crypto.randomBytes(16).toString('hex')}`;
  }

  private buildFileContent(filePath: string): string {
    if (filePath.endsWith('.key')) {
      const base64 = crypto.randomBytes(576).toString('base64');
      const lines: string[] = [];
      for (let i = 0; i < base64.length; i += 48) {
        lines.push(base64.slice(i, i + 48));
      }
      return `-----BEGIN RSA PRIVATE KEY-----\n${lines.join('\n')}\n-----END RSA PRIVATE KEY-----\n`;
    }

    const payload = {
      OPENAI_API_KEY: this.generateFakeKey('openai'),
      ANTHROPIC_API_KEY: this.generateFakeKey('anthropic'),
      DEEPSEEK_API_KEY: this.generateFakeKey('deepseek'),
    };
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  private async triggerHoneypot(
    honeypot: Honeypot,
    meta: Record<string, unknown>,
  ): Promise<void> {
    try {
      const triggerIp = typeof meta.ip === 'string' ? meta.ip : null;
      const updateResult = await this.db.query(
        `UPDATE honeypots
         SET triggered = TRUE,
             triggered_at = NOW(),
             trigger_ip = $1,
             trigger_metadata = $2
         WHERE id = $3
           AND triggered = FALSE`,
        [triggerIp, JSON.stringify(meta), honeypot.id],
      );

      if ((updateResult.rowCount ?? 0) === 0) return;

      const eventMetadata = {
        honeypotId: honeypot.id,
        honeypotName: honeypot.name,
        type: honeypot.type,
        ...meta,
      };

      const insertResult = await this.db.query(
        `INSERT INTO security_events
          (instance_id, event_type, severity, source, description, metadata, session_id, created_at)
         VALUES
          ($1, 'honeypot_triggered', 'breach', 'honeypot-manager', $2, $3, $4, NOW())
         RETURNING *`,
        [
          honeypot.instanceId,
          `Honeypot "${honeypot.name}" (${honeypot.type}) was accessed. Possible breach in progress.`,
          JSON.stringify(eventMetadata),
          typeof meta.sessionId === 'string' ? meta.sessionId : null,
        ],
      );

      const redis = getRedis();
      const insertedRow = insertResult.rows[0];
      if (redis && insertedRow) {
        try {
          await redis.publish(
            'scout:events',
            JSON.stringify({
              ...insertedRow,
              created_at: new Date(insertedRow.created_at).toISOString(),
            }),
          );
        } catch {
          // Non-fatal
        }
      }

      await this.dispatcher.dispatch({
        id: crypto.randomUUID(),
        instance_id: honeypot.instanceId,
        session_id: typeof meta.sessionId === 'string' ? meta.sessionId : 'system',
        event_type: 'honeypot_triggered',
        severity: 'breach',
        description: `Honeypot "${honeypot.name}" (${honeypot.type}) was accessed. Possible breach in progress.`,
        created_at: new Date(),
        acknowledged: false,
        acknowledged_by: null,
        acknowledged_at: null,
      });
    } catch (err) {
      console.error('[HoneypotManager] triggerHoneypot failed:', err);
    }
  }
}

export const honeypotManager = new HoneypotManager(pool);

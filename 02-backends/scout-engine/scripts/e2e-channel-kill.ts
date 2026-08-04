import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import { createInternalControlRouter } from '../src/api/internal/control.js';
import { telegramWebhookRouter } from '../src/api/webhooks/telegram.js';
import { getControlService } from '../src/messaging/control-defaults.js';
import { pool } from '../src/event-server/db.js';

type TelegramWebhookCall = {
  url: string;
  body: Record<string, unknown>;
};

type InstanceRow = {
  id: string;
  name: string;
  api_key: string;
  status: string;
  suspension_reason: string | null;
  last_heartbeat: Date | null;
  created_at: Date;
  updated_at: Date;
  organization_id: string | null;
};

type LinkRow = {
  id: string;
  organization_id: string;
  dashboard_user_id: string;
  channel: 'telegram' | 'whatsapp' | 'slack' | 'dashboard';
  channel_user_ref: string;
  chat_ref: string | null;
  role: 'owner' | 'operator';
  enabled: boolean;
  linked_at: Date;
  revoked_at: Date | null;
  confirmed_at: Date | null;
  control_scope: string;
  metadata: Record<string, unknown>;
};

type LinkCodeRow = {
  id: string;
  organization_id: string;
  dashboard_user_id: string;
  channel: 'telegram' | 'whatsapp' | 'slack';
  code_hash: string;
  role: 'owner' | 'operator';
  expires_at: Date;
  consumed_at: Date | null;
  consumed_by: string | null;
  consumed_chat_ref: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
};

type ControlEventRow = {
  id: string;
  organization_id: string;
  audit_code: string;
  action: string;
  target_type: string;
  target_id: string | null;
  channel: string | null;
  channel_user_ref: string | null;
  dashboard_user_id: string | null;
  reason: string | null;
  confirmed: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
};

type SecurityEventRow = {
  id: string;
  severity: string;
  source: string;
  event_type: string;
  description: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  session_id: string | null;
  instance_id: string | null;
  mitigated: boolean;
  created_at: Date;
};

type OrgControlSettingRow = {
  organization_id: string;
  panic_mode: boolean;
  updated_at: Date;
};

const state = {
  instances: new Map<string, InstanceRow>(),
  links: new Map<string, LinkRow>(),
  linkCodes: new Map<string, LinkCodeRow>(),
  controlEvents: [] as ControlEventRow[],
  securityEvents: [] as SecurityEventRow[],
  orgSettings: new Map<string, OrgControlSettingRow>(),
};

function randomSuffix(): string {
  return crypto.randomBytes(4).toString('hex');
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function makeRow<T>(row: T): T {
  return row;
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function asDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.trim()) return new Date(value);
  return fallback;
}

function upsertInstance(row: InstanceRow): void {
  state.instances.set(row.id, row);
}

function upsertLink(row: LinkRow): void {
  const conflictKey = `${row.organization_id}:${row.channel}:${row.channel_user_ref}`;
  for (const [key, existing] of state.links) {
    if (`${existing.organization_id}:${existing.channel}:${existing.channel_user_ref}` === conflictKey && existing.revoked_at === null) {
      state.links.delete(key);
    }
  }
  state.links.set(row.id, row);
}

function installInMemoryPool(): void {
  pool.query = (async (sql: string, params: unknown[] = []) => {
    const text = normalizeSql(sql);

    if (text.startsWith('insert into carina_instances')) {
      const [id, name, apiKey, status, suspensionReason, lastHeartbeat, updatedAt, createdAt] = params as [
        string,
        string,
        string,
        string,
        string | null,
        Date | string | null,
        Date | string | null,
        Date | string | null,
      ];
      const existing = state.instances.get(id);
      const row = makeRow<InstanceRow>({
        id,
        name,
        api_key: apiKey,
        status,
        suspension_reason: suspensionReason ?? null,
        last_heartbeat: lastHeartbeat ? asDate(lastHeartbeat) : null,
        updated_at: asDate(updatedAt),
        created_at: existing?.created_at ?? asDate(createdAt),
        organization_id: existing?.organization_id ?? id,
      });
      upsertInstance(row);
      return { rows: [row], rowCount: 1 };
    }

    if (
      text.includes('from channel_operator_links')
      && text.includes('where channel = $1')
      && text.includes('channel_user_ref = $2')
      && text.includes('enabled = true')
      && text.includes('revoked_at is null')
    ) {
      const [channel, channelUserRef] = params as [string, string];
      const row = [...state.links.values()]
        .filter((entry) => entry.channel === channel && entry.channel_user_ref === channelUserRef && entry.enabled && entry.revoked_at === null)
        .sort((a, b) => b.linked_at.getTime() - a.linked_at.getTime())[0];
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    if (text.startsWith('insert into channel_operator_links')) {
      const [organizationId, dashboardUserId, third, fourth, fifth, sixth, seventh] = params as Array<string | null>;
      const channel = text.includes("values ($1, $2, 'telegram'")
        ? 'telegram'
        : text.includes("values ($1, $2, 'whatsapp'")
          ? 'whatsapp'
          : text.includes("values ($1, $2, 'slack'")
            ? 'slack'
            : text.includes("values ($1, $2, $3")
              ? (third as LinkRow['channel'])
              : 'telegram';
      const channelUserRef = text.includes("values ($1, $2, 'telegram'")
        || text.includes("values ($1, $2, 'whatsapp'")
        || text.includes("values ($1, $2, 'slack'")
        ? (third as string)
        : (fourth as string);
      const chatRef = text.includes("values ($1, $2, 'telegram'")
        || text.includes("values ($1, $2, 'whatsapp'")
        || text.includes("values ($1, $2, 'slack'")
        ? (fourth as string | null)
        : (fifth as string | null);
      const role = text.includes("'owner'")
        ? 'owner'
        : text.includes("'operator'")
          ? 'operator'
          : (sixth as LinkRow['role']) ?? 'operator';
      const metadataRaw = text.includes("'{}'::jsonb")
        ? '{}'
        : (seventh ?? '{}');
      const row: LinkRow = {
        id: crypto.randomUUID(),
        organization_id: organizationId ?? '',
        dashboard_user_id: dashboardUserId ?? '',
        channel,
        channel_user_ref: channelUserRef,
        chat_ref: chatRef,
        role,
        enabled: true,
        linked_at: new Date(),
        revoked_at: null,
        confirmed_at: new Date(),
        control_scope: 'organization',
        metadata: JSON.parse(String(metadataRaw ?? '{}')) as Record<string, unknown>,
      };
      upsertLink(row);
      return { rows: [row], rowCount: 1 };
    }

    if (text.startsWith('select panic_mode from organization_control_settings where organization_id = $1')) {
      const [organizationId] = params as [string];
      const row = state.orgSettings.get(organizationId);
      return { rows: row ? [{ panic_mode: row.panic_mode }] : [], rowCount: row ? 1 : 0 };
    }

    if (text.startsWith('insert into organization_control_settings')) {
      const [organizationId, panicMode] = params as [string, boolean];
      const row = makeRow<OrgControlSettingRow>({
        organization_id: organizationId,
        panic_mode: panicMode,
        updated_at: new Date(),
      });
      state.orgSettings.set(organizationId, row);
      return { rows: [row], rowCount: 1 };
    }

    if (text.startsWith('insert into channel_link_codes')) {
      const [
        organizationId,
        dashboardUserId,
        channel,
        codeHash,
        role,
        expiresAt,
        metadataRaw,
      ] = params as [string, string, LinkCodeRow['channel'], string, LinkCodeRow['role'], string, string];
      const row: LinkCodeRow = {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        dashboard_user_id: dashboardUserId,
        channel,
        code_hash: codeHash,
        role,
        expires_at: new Date(expiresAt),
        consumed_at: null,
        consumed_by: null,
        consumed_chat_ref: null,
        metadata: JSON.parse(metadataRaw) as Record<string, unknown>,
        created_at: new Date(),
      };
      state.linkCodes.set(row.id, row);
      return { rows: [row], rowCount: 1 };
    }

    if (text.startsWith('select id, organization_id, dashboard_user_id, channel, code_hash, role, expires_at, consumed_at, consumed_by, consumed_chat_ref, metadata, created_at from channel_link_codes where code_hash = $1 and channel = $2 limit 1')) {
      const [codeHash, channel] = params as [string, LinkCodeRow['code_hash'], LinkCodeRow['channel']];
      const row = [...state.linkCodes.values()].find((entry) => entry.code_hash === codeHash && entry.channel === channel) ?? null;
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    if (text.startsWith('update channel_link_codes set consumed_at = now(), consumed_by = $2, consumed_chat_ref = $3 where id = $1')) {
      const [id, consumedBy, consumedChatRef] = params as [string, string, string | null];
      const row = state.linkCodes.get(id);
      if (row) {
        row.consumed_at = new Date();
        row.consumed_by = consumedBy;
        row.consumed_chat_ref = consumedChatRef;
      }
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    if (text.startsWith('update channel_operator_links set enabled = false, revoked_at = coalesce(revoked_at, now()) where organization_id = $1 and channel = $2 and enabled = true')) {
      const [organizationId, channel] = params as [string, LinkRow['channel']];
      let count = 0;
      for (const row of state.links.values()) {
        if (row.organization_id === organizationId && row.channel === channel && row.enabled) {
          row.enabled = false;
          row.revoked_at = row.revoked_at ?? new Date();
          count += 1;
        }
      }
      return { rows: [], rowCount: count };
    }

    if (text.startsWith('select id, status from carina_instances where id = $1 and coalesce(organization_id, id) = $2')) {
      const [id, organizationId] = params as [string, string];
      const row = state.instances.get(id);
      if (!row || (row.organization_id ?? row.id) !== organizationId) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [{ id: row.id, status: row.status }], rowCount: 1 };
    }

    if (text.startsWith('select status, suspension_reason from carina_instances where id = $1')) {
      const [id] = params as [string];
      const row = state.instances.get(id);
      return {
        rows: row ? [{ status: row.status, suspension_reason: row.suspension_reason }] : [],
        rowCount: row ? 1 : 0,
      };
    }

    if (text.startsWith('select status from carina_instances where id = $1')) {
      const [id] = params as [string];
      const row = state.instances.get(id);
      return { rows: row ? [{ status: row.status }] : [], rowCount: row ? 1 : 0 };
    }

    if (text.startsWith('update carina_instances set status = $1, suspension_reason = $2, updated_at = now() where id = $3 and coalesce(organization_id, id) = $4 returning id')) {
      const [status, suspensionReason, id, organizationId] = params as [string, string | null, string, string];
      const row = state.instances.get(id);
      if (!row || (row.organization_id ?? row.id) !== organizationId) {
        return { rows: [], rowCount: 0 };
      }
      row.status = status;
      row.suspension_reason = suspensionReason ?? null;
      row.updated_at = new Date();
      return { rows: [{ id: row.id }], rowCount: 1 };
    }

    if (text.startsWith('update carina_instances set status = $1, suspension_reason = $2, updated_at = now() where coalesce(organization_id, id) = $3 returning id')) {
      const [status, suspensionReason, organizationId] = params as [string, string | null, string];
      let count = 0;
      for (const row of state.instances.values()) {
        if ((row.organization_id ?? row.id) === organizationId) {
          row.status = status;
          row.suspension_reason = suspensionReason ?? null;
          row.updated_at = new Date();
          count += 1;
        }
      }
      return { rows: count ? [{ id: organizationId }] : [], rowCount: count };
    }

    if (text.startsWith('select status, count(*)::int as count from carina_instances where coalesce(organization_id, id) = $1 group by status')) {
      const [organizationId] = params as [string];
      const counts = new Map<string, number>();
      for (const row of state.instances.values()) {
        if ((row.organization_id ?? row.id) === organizationId) {
          counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
        }
      }
      return {
        rows: [...counts.entries()].map(([status, count]) => ({ status, count: String(count) })),
        rowCount: counts.size,
      };
    }

    if (text.startsWith('select count(*)::int as count from channel_operator_links where organization_id = $1 and enabled = true')) {
      const [organizationId] = params as [string];
      const count = [...state.links.values()].filter((row) => row.organization_id === organizationId && row.enabled).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }

    if (text.startsWith('insert into channel_control_events')) {
      const [
        organizationId,
        auditCode,
        action,
        targetType,
        targetId,
        channel,
        channelUserRef,
        dashboardUserId,
        reason,
        confirmed,
        metadataRaw,
      ] = params as [string, string, string, string, string | null, string | null, string | null, string | null, string | null, boolean, string];
      const row: ControlEventRow = {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        audit_code: auditCode,
        action,
        target_type: targetType,
        target_id: targetId,
        channel,
        channel_user_ref: channelUserRef,
        dashboard_user_id: dashboardUserId,
        reason,
        confirmed,
        metadata: JSON.parse(metadataRaw) as Record<string, unknown>,
        created_at: new Date(),
      };
      state.controlEvents.push(row);
      return { rows: [row], rowCount: 1 };
    }

    if (text.startsWith('insert into security_events')) {
      const [severity, eventType, description, metadataRaw, instanceId] = params as [string, string, string, string, string | null];
      const row: SecurityEventRow = {
        id: crypto.randomUUID(),
        severity,
        source: 'scout-engine',
        event_type: eventType,
        description,
        metadata: JSON.parse(metadataRaw) as Record<string, unknown>,
        ip_address: null,
        session_id: null,
        instance_id: instanceId,
        mitigated: false,
        created_at: new Date(),
      };
      state.securityEvents.push(row);
      return { rows: [row], rowCount: 1 };
    }

    if (text.startsWith('select count(*)::text as count from channel_control_events where organization_id = $1')) {
      const [organizationId] = params as [string];
      const count = state.controlEvents.filter((row) => row.organization_id === organizationId).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }

    if (
      text.includes('from channel_control_events')
      && text.includes('created_at >= $2::date')
      && text.includes('created_at < ($2::date + interval \'1 day\')')
    ) {
      const [organizationId, day] = params as [string, string];
      const dayStart = new Date(`${day}T00:00:00.000Z`).getTime();
      const nextDay = new Date(`${day}T00:00:00.000Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const count = state.controlEvents.filter((row) => {
        if (row.organization_id !== organizationId) return false;
        const created = row.created_at.getTime();
        return created >= dayStart && created < nextDay.getTime();
      }).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }

    if (text.startsWith('delete from channel_operator_links where organization_id = $1')) {
      const [organizationId] = params as [string];
      let count = 0;
      for (const [key, row] of state.links) {
        if (row.organization_id === organizationId) {
          state.links.delete(key);
          count += 1;
        }
      }
      return { rows: [], rowCount: count };
    }

    if (text.startsWith('delete from channel_control_events where organization_id = $1')) {
      const [organizationId] = params as [string];
      const before = state.controlEvents.length;
      state.controlEvents = state.controlEvents.filter((row) => row.organization_id !== organizationId);
      return { rows: [], rowCount: before - state.controlEvents.length };
    }

    if (text.startsWith("delete from security_events where metadata->>'organization_id' = $1")) {
      const [organizationId] = params as [string];
      const before = state.securityEvents.length;
      state.securityEvents = state.securityEvents.filter((row) => row.metadata.organization_id !== organizationId);
      return { rows: [], rowCount: before - state.securityEvents.length };
    }

    if (text.startsWith('delete from carina_instances where id = $1')) {
      const [id] = params as [string];
      const deleted = state.instances.delete(id);
      return { rows: [], rowCount: deleted ? 1 : 0 };
    }

    throw new Error(`Unsupported in-memory SQL: ${sql}`);
  }) as typeof pool.query;
}

function createTelegramPayload(chatId: string, userId: string, text: string): Record<string, unknown> {
  return {
    update_id: Number(Date.now() % 1000000),
    message: {
      message_id: 1,
      text,
      chat: { id: chatId, type: 'private' },
      from: {
        id: userId,
        username: 'scout-operator',
        first_name: 'Scout',
      },
    },
  };
}

async function withServer<T>(app: express.Express, run: (port: number) => Promise<T>): Promise<T> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  server.unref();

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected an ephemeral port');
  }

  try {
    return await run(address.port);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      (server as typeof server & { closeIdleConnections?: () => void; closeAllConnections?: () => void }).closeIdleConnections?.();
      (server as typeof server & { closeAllConnections?: () => void }).closeAllConnections?.();
    });
  }
}

async function main(): Promise<void> {
  process.env.TELEGRAM_WEBHOOK_SECRET = 'e2e-telegram-secret';
  process.env.TELEGRAM_BOT_TOKEN = 'e2e-telegram-token';
  process.env.SCOUT_INTERNAL_CONTROL_KEY = 'e2e-internal-key';
  process.env.SCOUT_OPERATOR_PLAN = 'enterprise';

  const outboundCalls: TelegramWebhookCall[] = [];
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('api.telegram.org')) {
      const rawBody = typeof init?.body === 'string' ? init.body : init?.body ? String(init.body) : '{}';
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      outboundCalls.push({ url, body });
      return jsonResponse({ ok: true, result: { message_id: outboundCalls.length } });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const organizationId = `scout-e2e-${randomSuffix()}`;
  const dashboardUserId = `dashboard-${randomSuffix()}`;
  const channelUserRef = `telegram-${randomSuffix()}`;
  const chatRef = `chat-${randomSuffix()}`;
  const instanceId = `instance-${randomSuffix()}`;
  installInMemoryPool();

  await pool.query(
    `INSERT INTO carina_instances (id, name, api_key, status, suspension_reason, last_heartbeat, updated_at, created_at)
     VALUES ($1, $2, $3, 'active', NULL, NOW(), NOW(), NOW())
     ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name,
         api_key = EXCLUDED.api_key,
         status = EXCLUDED.status,
         suspension_reason = EXCLUDED.suspension_reason,
         last_heartbeat = EXCLUDED.last_heartbeat,
         updated_at = EXCLUDED.updated_at`,
    [organizationId, 'Scout E2E Org', crypto.randomUUID()],
  );

  await pool.query(
    `INSERT INTO channel_operator_links (
       organization_id,
       dashboard_user_id,
       channel,
       channel_user_ref,
       chat_ref,
       role,
       enabled,
       linked_at,
       revoked_at,
       confirmed_at,
       control_scope,
       metadata
     )
     VALUES ($1, $2, 'telegram', $3, $4, 'owner', TRUE, NOW(), NULL, NOW(), 'organization', '{}'::jsonb)
     ON CONFLICT DO NOTHING`,
    [organizationId, dashboardUserId, channelUserRef, chatRef],
  );

  const app = express();
  app.use(express.json());
  app.use('/webhooks/telegram', telegramWebhookRouter);
  app.use('/api/internal/control', createInternalControlRouter(getControlService()));

  await withServer(app, async (port) => {
    const telegramUrl = `http://127.0.0.1:${port}/webhooks/telegram`;
    const internalUrl = `http://127.0.0.1:${port}/api/internal/control`;

    const killResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'e2e-telegram-secret',
        Connection: 'close',
      },
      body: JSON.stringify(createTelegramPayload(chatRef, channelUserRef, '/kill customer issue')),
    });
    assert.equal(killResponse.status, 200);

    const confirmCall = outboundCalls.find((entry) => {
      const markup = entry.body.reply_markup as { inline_keyboard?: Array<Array<{ callback_data?: string }>> } | undefined;
      return Boolean(markup?.inline_keyboard?.[0]?.[0]?.callback_data);
    });
    assert.ok(confirmCall);

    const callbackData = (confirmCall?.body.reply_markup as {
      inline_keyboard?: Array<Array<{ callback_data?: string }>>;
    }).inline_keyboard?.[0]?.[0]?.callback_data;
    assert.ok(callbackData?.startsWith('scout:confirm:'));

    const confirmResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'e2e-telegram-secret',
        Connection: 'close',
      },
      body: JSON.stringify({
        update_id: Number(Date.now() % 1000000) + 1,
        callback_query: {
          id: `callback-${randomSuffix()}`,
          data: callbackData,
          from: {
            id: channelUserRef,
            username: 'scout-operator',
            first_name: 'Scout',
          },
          message: {
            message_id: 1,
            chat: { id: chatRef, type: 'private' },
            from: {
              id: 'bot',
              username: 'scout-bot',
            },
          },
        },
      }),
    });
    assert.equal(confirmResponse.status, 200);

    const afterKill = await pool.query<{ status: string; suspension_reason: string | null }>(
      `SELECT status, suspension_reason
       FROM carina_instances
       WHERE id = $1`,
      [organizationId],
    );
    assert.equal(afterKill.rows[0]?.status, 'suspended');

    const auditAfterKill = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM channel_control_events
       WHERE organization_id = $1`,
      [organizationId],
    );
    assert.ok(Number.parseInt(auditAfterKill.rows[0]?.count ?? '0', 10) >= 1);

    const internalStatus = await fetch(`${internalUrl}/status?organization_id=${encodeURIComponent(organizationId)}`, {
      headers: {
        'X-Scout-Internal-Key': 'e2e-internal-key',
        Connection: 'close',
      },
    });
    assert.equal(internalStatus.status, 200);

    const resumeResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'e2e-telegram-secret',
        Connection: 'close',
      },
      body: JSON.stringify(createTelegramPayload(chatRef, channelUserRef, '/resume')),
    });
    assert.equal(resumeResponse.status, 200);

    const afterResume = await pool.query<{ status: string }>(
      `SELECT status
       FROM carina_instances
       WHERE id = $1`,
      [organizationId],
    );
    assert.equal(afterResume.rows[0]?.status, 'active');

    const resumeAudit = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM channel_control_events
       WHERE organization_id = $1`,
      [organizationId],
    );
    assert.ok(Number.parseInt(resumeAudit.rows[0]?.count ?? '0', 10) >= 2);
  });

  await pool.query(`DELETE FROM channel_operator_links WHERE organization_id = $1`, [organizationId]);
  await pool.query(`DELETE FROM channel_control_events WHERE organization_id = $1`, [organizationId]);
  await pool.query(`DELETE FROM security_events WHERE metadata->>'organization_id' = $1`, [organizationId]);
  await pool.query(`DELETE FROM carina_instances WHERE id = $1`, [organizationId]);

  console.log('[scout-e2e] channel kill flow passed');
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error('[scout-e2e] failed:', msg);
  process.exitCode = 1;
});

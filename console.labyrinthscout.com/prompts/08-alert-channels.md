# Prompt 08 - Alert Channels

Build the multi-channel alert dispatcher for Labyrinth Scout. When a security event is written to
the database, the dispatcher fans it out to configured channels (Telegram, Email via Resend, Slack)
in parallel, with deduplication via Redis to suppress alert storms.

**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7. No PHP.

**Repo root:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`

**Scout lives at:** `labyrinthscout/src/`

---

## Files to create

### 1. `labyrinthscout/src/alerts/types.ts`

Shared types used by all alert modules.

```typescript
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'breach';

export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
  breach: 4,
};

export interface SecurityEvent {
  id: string;
  instance_id: string;
  session_id: string;
  event_type: string;
  severity: AlertSeverity;
  description: string;
  created_at: Date;
}

export interface AlertChannel {
  id: string;
  channel_type: 'telegram' | 'email' | 'slack';
  severity_threshold: AlertSeverity;
  enabled: boolean;
  config: Record<string, string>;
}

export interface AlertAdapter {
  send(event: SecurityEvent, channel: AlertChannel): Promise<void>;
}
```

---

### 2. `labyrinthscout/src/alerts/telegram.ts`

Telegram adapter. Uses the Bot API directly via `fetch` - no third-party library.

```typescript
import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';

export class TelegramAdapter implements AlertAdapter {
  async send(event: SecurityEvent, channel: AlertChannel): Promise<void> {
    const token = process.env.SCOUT_TELEGRAM_BOT_TOKEN ?? channel.config.bot_token;
    const chatId = process.env.SCOUT_TELEGRAM_CHAT_ID ?? channel.config.chat_id;

    if (!token || !chatId) {
      throw new Error('Telegram adapter: missing bot_token or chat_id');
    }

    const text = this.formatMessage(event);
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram API error ${response.status}: ${body}`);
    }
  }

  private formatMessage(event: SecurityEvent): string {
    const time = event.created_at.toTimeString().slice(0, 8);
    const dashboardUrl = process.env.SCOUT_DASHBOARD_URL ?? 'http://localhost:4444';

    const isBreach = event.severity === 'breach';
    const severityIcon = isBreach ? 'BREACH' : event.severity === 'critical' ? 'CRITICAL' : event.severity.toUpperCase();
    const breachPrefix = isBreach ? '*BREACH DETECTED*\n\n' : '';

    // Truncate description to 300 chars to fit Telegram limits
    const description = event.description.length > 300
      ? event.description.slice(0, 297) + '...'
      : event.description;

    const lines = [
      `${breachPrefix}*LABYRINTH ${severityIcon} -- ${event.event_type}*`,
      `---`,
      `Instance: ${event.instance_id}`,
      `Time: ${time}`,
      `Description: ${description}`,
      `Session: ${event.session_id}`,
      `---`,
      `Dashboard: ${dashboardUrl}`,
    ];

    return lines.join('\n');
  }
}
```

Note: do not use em dashes in the formatted message text. Use `--` instead (already shown above).

---

### 3. `labyrinthscout/src/alerts/email.ts`

Email adapter via the Resend API. Uses `fetch` directly - no SDK.

```typescript
import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';

export class EmailAdapter implements AlertAdapter {
  async send(event: SecurityEvent, channel: AlertChannel): Promise<void> {
    const apiKey = process.env.SCOUT_RESEND_API_KEY ?? channel.config.api_key;
    const toAddress = channel.config.to_address;
    const fromAddress = process.env.SCOUT_ALERT_FROM_EMAIL ?? 'hello@carinaai.uk';

    if (!apiKey || !toAddress) {
      throw new Error('Email adapter: missing SCOUT_RESEND_API_KEY or to_address config');
    }

    const subject = `[LABYRINTH] ${event.severity.toUpperCase()}: ${event.event_type}`;
    const html = this.renderHtml(event);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddress, to: [toAddress], subject, html }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API error ${response.status}: ${body}`);
    }
  }

  private renderHtml(event: SecurityEvent): string {
    const dashboardUrl = process.env.SCOUT_DASHBOARD_URL ?? 'http://localhost:4444';
    const severityColor = {
      info: '#3b82f6',
      warning: '#f59e0b',
      critical: '#ef4444',
      breach: '#7c3aed',
    }[event.severity] ?? '#6b7280';

    // Dark navy theme matching the Scout dashboard
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { margin: 0; padding: 0; background: #0f172a; font-family: 'Courier New', monospace; color: #e2e8f0; }
  .wrapper { max-width: 600px; margin: 32px auto; background: #1e293b; border-radius: 8px; overflow: hidden; }
  .header { background: ${severityColor}; padding: 20px 24px; }
  .header h1 { margin: 0; font-size: 18px; color: #fff; letter-spacing: 1px; }
  .body { padding: 24px; }
  .field { margin-bottom: 12px; }
  .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
  .value { font-size: 14px; color: #e2e8f0; margin-top: 2px; word-break: break-all; }
  .footer { padding: 16px 24px; border-top: 1px solid #334155; }
  .footer a { color: ${severityColor}; text-decoration: none; font-size: 13px; }
</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>LABYRINTH SCOUT - ${event.severity.toUpperCase()}: ${event.event_type}</h1>
  </div>
  <div class="body">
    <div class="field"><div class="label">Instance</div><div class="value">${escapeHtml(event.instance_id)}</div></div>
    <div class="field"><div class="label">Time</div><div class="value">${event.created_at.toISOString()}</div></div>
    <div class="field"><div class="label">Session</div><div class="value">${escapeHtml(event.session_id)}</div></div>
    <div class="field"><div class="label">Description</div><div class="value">${escapeHtml(event.description)}</div></div>
  </div>
  <div class="footer"><a href="${dashboardUrl}">Open Labyrinth Scout Dashboard</a></div>
</div>
</body></html>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

---

### 4. `labyrinthscout/src/alerts/slack.ts`

Slack incoming webhook adapter using Block Kit.

```typescript
import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';

export class SlackAdapter implements AlertAdapter {
  async send(event: SecurityEvent, channel: AlertChannel): Promise<void> {
    const webhookUrl = process.env.SCOUT_SLACK_WEBHOOK_URL ?? channel.config.webhook_url;

    if (!webhookUrl) {
      throw new Error('Slack adapter: missing SCOUT_SLACK_WEBHOOK_URL or webhook_url config');
    }

    const color = { info: '#3b82f6', warning: '#f59e0b', critical: '#ef4444', breach: '#7c3aed' }[event.severity] ?? '#6b7280';
    const dashboardUrl = process.env.SCOUT_DASHBOARD_URL ?? 'http://localhost:4444';

    const body = {
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: `LABYRINTH ${event.severity.toUpperCase()}: ${event.event_type}` },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Instance*\n${event.instance_id}` },
                { type: 'mrkdwn', text: `*Time*\n${event.created_at.toISOString()}` },
                { type: 'mrkdwn', text: `*Session*\n${event.session_id}` },
                { type: 'mrkdwn', text: `*Severity*\n${event.severity}` },
              ],
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: `*Description*\n${event.description.slice(0, 500)}` },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Open Dashboard' },
                  url: dashboardUrl,
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook error ${response.status}`);
    }
  }
}
```

---

### 5. `labyrinthscout/src/alerts/dispatcher.ts`

Main dispatcher. Pulls active channels from DB, applies severity threshold, deduplicates via Redis,
dispatches in parallel.

```typescript
import { pool } from '../db/pool.js';
import { getRedis } from '../db/redis.js';
import { TelegramAdapter } from './telegram.js';
import { EmailAdapter } from './email.js';
import { SlackAdapter } from './slack.js';
import { SEVERITY_RANK } from './types.js';
import type { AlertAdapter, AlertChannel, AlertSeverity, SecurityEvent } from './types.js';

const ADAPTERS: Record<string, AlertAdapter> = {
  telegram: new TelegramAdapter(),
  email: new EmailAdapter(),
  slack: new SlackAdapter(),
};

const DEDUP_WINDOW_SECONDS = 300; // 5 minutes
const DEDUP_MAX_ALERTS = 3;

export const alertDispatcher = {
  async dispatch(event: SecurityEvent): Promise<void> {
    // Load enabled channels from DB
    let channels: AlertChannel[];
    try {
      const result = await pool.query<AlertChannel>(
        `SELECT id, channel_type, severity_threshold, enabled, config
         FROM alert_channels
         WHERE enabled = true`
      );
      channels = result.rows;
    } catch (err) {
      console.error('[AlertDispatcher] Failed to load channels from DB:', err);
      return;
    }

    if (channels.length === 0) return;

    const eventRank = SEVERITY_RANK[event.severity as AlertSeverity] ?? 0;

    const dispatches = channels
      .filter((ch) => SEVERITY_RANK[ch.severity_threshold] <= eventRank)
      .map((ch) => dispatchToChannel(event, ch));

    // Never block - use allSettled so one failure does not cancel others
    const results = await Promise.allSettled(dispatches);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const ch = channels[index];
        console.error(`[AlertDispatcher] Channel ${ch?.channel_type} (${ch?.id}) failed:`, result.reason);
      }
    });
  },
};

async function dispatchToChannel(event: SecurityEvent, channel: AlertChannel): Promise<void> {
  // Deduplication check via Redis
  const redis = getRedis();
  if (redis) {
    const key = `scout:alert-dedup:${event.instance_id}:${event.event_type}`;
    const count = await redis.incr(key);
    if (count === 1) {
      // First occurrence - set TTL
      await redis.expire(key, DEDUP_WINDOW_SECONDS);
    }
    if (count > DEDUP_MAX_ALERTS) {
      console.info(`[AlertDispatcher] Dedup suppressed: ${event.event_type} on ${event.instance_id} (count=${count})`);
      return;
    }
  }

  const adapter = ADAPTERS[channel.channel_type];
  if (!adapter) {
    console.warn(`[AlertDispatcher] No adapter found for channel type '${channel.channel_type}'`);
    return;
  }

  await adapter.send(event, channel);
}
```

---

### 6. `labyrinthscout/src/db/migrations.ts` (modify existing file)

Add the `alert_channels` table to the existing migrations function if it does not already exist:

```sql
CREATE TABLE IF NOT EXISTS alert_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type TEXT NOT NULL CHECK (channel_type IN ('telegram', 'email', 'slack')),
  severity_threshold TEXT NOT NULL CHECK (severity_threshold IN ('info', 'warning', 'critical', 'breach')) DEFAULT 'warning',
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 7. `labyrinthscout/src/api/events.ts` (modify existing file)

After inserting the event row to the DB, fire the dispatcher asynchronously:

```typescript
import { alertDispatcher } from '../alerts/dispatcher.js';

// After the INSERT and reading back the inserted row as `newEvent`:
// Fire and forget - do not await so the HTTP response is not delayed
void alertDispatcher.dispatch(newEvent).catch((err) =>
  console.error('[events] Alert dispatch error:', err)
);
```

---

## Environment variables (add to `labyrinthscout/.env.example`)

```
# Alert channels
SCOUT_TELEGRAM_BOT_TOKEN=
SCOUT_TELEGRAM_CHAT_ID=
SCOUT_RESEND_API_KEY=
SCOUT_ALERT_FROM_EMAIL=hello@carinaai.uk
SCOUT_SLACK_WEBHOOK_URL=
SCOUT_DASHBOARD_URL=http://localhost:4444
```

---

## Test cases

Write in `labyrinthscout/src/alerts/__tests__/dispatcher.test.ts` using Vitest. Stub all external
`fetch` calls and Redis with `vi.mock`.

```typescript
describe('AlertDispatcher', () => {
  it('dispatches critical event to channels with threshold <= critical', async () => {
    // Stub DB to return one telegram channel with threshold='warning'
    // Stub Telegram fetch to return 200
    // Call dispatch with severity='critical'
    // Assert fetch was called once
  });

  it('does not dispatch info event to channel with threshold=warning', async () => {
    // Stub DB to return channel with threshold='warning'
    // Call dispatch with severity='info'
    // Assert fetch was NOT called
  });

  it('dispatches to remaining channels when one adapter throws', async () => {
    // Stub DB to return [telegram, slack]
    // Stub telegram fetch to throw
    // Stub slack fetch to return 200
    // Call dispatch - assert slack was still called
  });

  it('suppresses 4th alert in 5-minute window via Redis dedup', async () => {
    // Stub Redis INCR to return 4
    // Assert adapter.send is not called
  });

  it('runs silently when no channels are configured', async () => {
    // Stub DB to return []
    // dispatch() should resolve without error
  });
});

describe('TelegramAdapter.formatMessage', () => {
  it('prepends breach prefix for breach severity events', ...);
  it('truncates description longer than 300 chars', ...);
});
```

---

## Acceptance criteria

- `alertDispatcher.dispatch(event)` is fire-and-forget: the caller does not need to await it
- A Telegram failure does not prevent Slack or Email from sending
- The 4th alert with the same `instance_id + event_type` within 5 minutes is suppressed
- `breach` severity events reach channels with any threshold (info, warning, critical, breach)
- `info` severity events only reach channels with `severity_threshold = 'info'`
- No channel configured = dispatcher exits silently with no error thrown
- The `alert_channels` DB table is created idempotently on Scout startup
- TypeScript strict mode: zero `any` types introduced

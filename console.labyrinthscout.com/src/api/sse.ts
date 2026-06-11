import { Router, type IRouter } from 'express';
import type { Response } from 'express';
import { createSubscriber } from '../redis.js';
import type { SecurityEventRow } from '../types.js';
import { fetchStats24h } from './status.js';
import { buildThreatMetrics } from '../dashboard/widgets/threat-metrics.js';

export const sseRouter: IRouter = Router();

const clients = new Set<Response>();

export function getSseSubscriberCount(): number {
  return clients.size;
}

function writeSse(res: Response, eventName: string, data: unknown): void {
  res.write(`event: ${eventName}\n`);
  res.write('data: ' + JSON.stringify(data) + '\n\n');
}

export function broadcastEvent(event: SecurityEventRow): void {
  const msg = 'data: ' + JSON.stringify({ type: 'event', data: event }) + '\n\n';
  for (const res of clients) {
    try {
      res.write(msg);
      writeSse(res, 'live_event', { type: 'live_event', data: event });
      if (/injection|blocked|breach|honeypot|egress|danger|kill|quarantine/.test(event.event_type)) {
        writeSse(res, 'audit_results', { type: 'audit_results', data: event });
      }
      if (event.event_type === 'kill_switch_activated' || event.event_type === 'kill_switch_resumed') {
        writeSse(res, 'kill_switch_status', { type: 'kill_switch_status', data: event });
      }
      if (event.event_type === 'heartbeat') {
        writeSse(res, 'agent_update', { type: 'agent_update', data: event });
      }
      if (event.event_type === 'tool_call' || event.event_type === 'session_metrics') {
        writeSse(res, 'token_update', { type: 'token_update', data: event });
      }
    } catch {
      clients.delete(res);
    }
  }
}

export function broadcastStats(stats: {
  critical: number;
  warning: number;
  info: number;
  breach: number;
}): void {
  const msg = 'data: ' + JSON.stringify({ type: 'stats', data: stats }) + '\n\n';
  for (const res of clients) {
    try {
      res.write(msg);
      writeSse(res, 'threat_update', {
        type: 'threat_update',
        data: buildThreatMetrics([], new Date()),
        stats,
      });
    } catch {
      clients.delete(res);
    }
  }
}

export async function refreshAndBroadcastStats(): Promise<void> {
  try {
    const stats = await fetchStats24h();
    broadcastStats(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout:sse] Stats refresh failed:', msg);
  }
}

sseRouter.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  clients.add(res);
  res.write('data: ' + JSON.stringify({ type: 'heartbeat' }) + '\n\n');
  writeSse(res, 'live_event', { type: 'heartbeat' });

  const keepAlive = setInterval(() => {
    try {
      res.write('data: ' + JSON.stringify({ type: 'heartbeat' }) + '\n\n');
      writeSse(res, 'live_event', { type: 'heartbeat' });
    } catch {
      clearInterval(keepAlive);
      clients.delete(res);
    }
  }, 30_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    clients.delete(res);
  });
});

export async function initSseSubscriber(): Promise<void> {
  try {
    const sub = createSubscriber();
    await sub.subscribe('scout:events');
    sub.on('message', (_channel, message) => {
      try {
        const event = JSON.parse(message) as SecurityEventRow;
        broadcastEvent(event);
        if (event.severity === 'critical' || event.severity === 'warning' || event.severity === 'breach') {
          void refreshAndBroadcastStats();
        }
      } catch {
        /* malformed message */
      }
    });
    console.log('[scout] SSE Redis subscriber active');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout] SSE subscriber unavailable:', msg);
  }
}

/**
 * Status page: outage simulation → incident → notify → resolve → HTML.
 */
import { describe, expect, it } from 'vitest';
import {
  StatusStore,
  runHealthCycle,
  notifyActiveUsers,
  notifySubscribers,
  NotificationLog,
  scheduleMaintenance,
  MaintenanceConflictError,
  MaintenanceLeadTimeError,
  autoNotifyBeforeMaintenance,
  buildStatusPageModel,
  renderStatusPageHtml,
  manualUpdateIncident,
  RECOVERY_MS,
} from './index.js';
import type { MonitoredEndpoint, PingFn } from './types.js';

const endpoints: MonitoredEndpoint[] = [
  { id: 'api', name: 'API', url: 'https://example.test/api/health' },
  { id: 'web', name: 'Web', url: 'https://example.test/' },
];

describe('status page and incident communication', () => {
  it('simulates outage, updates status page, emails, and timeline', async () => {
    const store = new StatusStore({ product: 'demo', endpoints });
    const log = new NotificationLog();
    const sent: Array<{ to: string[]; subject: string }> = [];
    const sender = async (args: { to: string[]; subject: string; body: string }) => {
      sent.push({ to: args.to, subject: args.subject });
    };

    let failApi = true;
    const pingFn: PingFn = async (ep) => {
      if (ep.id === 'api' && failApi) return { ok: false, error: 'timeout', statusCode: 0 };
      return { ok: true, statusCode: 200, latencyMs: 12 };
    };

    let created = null;
    for (let i = 0; i < 3; i++) {
      const cycle = await runHealthCycle(store, {
        pingFn,
        now: new Date(Date.UTC(2026, 7, 10, 12, i, 0)).toISOString(),
      });
      created = cycle.created;
    }
    expect(created).toBeTruthy();
    expect(created?.autoCreated).toBe(true);
    expect(created?.phase).toBe('investigating');
    expect(created?.updates.length).toBeGreaterThanOrEqual(1);

    await notifyActiveUsers(created!, ['active@example.com'], { sender, log, kind: 'detected' });
    await notifySubscribers(created!, ['sub@example.com'], { sender, log, kind: 'detected' });
    expect(sent.length).toBe(2);
    expect(log.records.length).toBe(2);

    const identified = manualUpdateIncident(
      store,
      created!.id,
      'identified',
      'Root cause: upstream dependency timeout.',
    );
    expect(identified?.phase).toBe('identified');
    expect(identified?.updates.at(-1)?.at).toBeTruthy();

    failApi = false;
    const t0 = Date.UTC(2026, 7, 10, 13, 0, 0);
    await runHealthCycle(store, { pingFn, now: new Date(t0).toISOString(), recoveryMs: RECOVERY_MS });
    const mid = await runHealthCycle(store, {
      pingFn,
      now: new Date(t0 + 2 * 60_000).toISOString(),
      recoveryMs: RECOVERY_MS,
    });
    expect(mid.resolved.length).toBe(0);
    const done = await runHealthCycle(store, {
      pingFn,
      now: new Date(t0 + RECOVERY_MS).toISOString(),
      recoveryMs: RECOVERY_MS,
    });
    expect(done.resolved.length).toBeGreaterThanOrEqual(1);
    expect(store.getIncident(created!.id)?.phase).toBe('resolved');

    const model = buildStatusPageModel(store);
    expect(model.uptime90d).toBeGreaterThan(0);
    const html = renderStatusPageHtml(model, {
      brand: 'Demo',
      canonicalUrl: 'https://status.example.com/',
    });
    expect(html).toContain('Demo status');
    expect(html).toContain('Outage detected');
    expect(html).toContain('separate from the application runtime');
    expect(html).toMatch(/90-day uptime/i);
  });

  it('blocks overlapping maintenance and enforces 48h lead time', async () => {
    const store = new StatusStore({ product: 'demo', endpoints });
    const now = '2026-08-10T00:00:00.000Z';
    const first = scheduleMaintenance(store, {
      title: 'DB upgrade',
      description: 'Primary database minor version bump.',
      affectedServices: ['api'],
      startsAt: '2026-08-13T02:00:00.000Z',
      endsAt: '2026-08-13T04:00:00.000Z',
      now,
    });
    expect(first.id).toBeTruthy();

    expect(() =>
      scheduleMaintenance(store, {
        title: 'Overlap',
        description: 'bad',
        affectedServices: ['web'],
        startsAt: '2026-08-13T03:00:00.000Z',
        endsAt: '2026-08-13T05:00:00.000Z',
        now,
      }),
    ).toThrow(MaintenanceConflictError);

    expect(() =>
      scheduleMaintenance(store, {
        title: 'Too soon',
        description: 'bad',
        affectedServices: ['api'],
        startsAt: '2026-08-10T12:00:00.000Z',
        endsAt: '2026-08-10T13:00:00.000Z',
        now,
      }),
    ).toThrow(MaintenanceLeadTimeError);

    const log = new NotificationLog();
    const sent: string[] = [];
    await autoNotifyBeforeMaintenance(store, ['ops@example.com'], {
      now: '2026-08-11T02:00:00.000Z', // 48h before 2026-08-13T02:00
      skewMs: 60_000,
      log,
      sender: async ({ subject }) => {
        sent.push(subject);
      },
    });
    expect(store.listMaintenance()[0].remindersSent).toContain('48h');
    expect(sent.some((s) => /48h/i.test(s))).toBe(true);
  });
});

/**
 * Multi-channel incident and maintenance notifications (injectable email).
 */
import { randomUUID } from 'node:crypto';
import type { EmailSender, Incident, MaintenanceWindow, NotificationRecord } from './types.js';

const templates = {
  incident_detected: (i: Incident) => ({
    subject: `[Status] Incident detected: ${i.title}`,
    body: `We detected an issue affecting ${i.affectedServices.join(', ')} at ${i.detectedAt}.\nPhase: ${i.phase}\nSeverity: ${i.severity}\n\nWe are investigating and will post updates on the status page.`,
  }),
  incident_update: (i: Incident) => {
    const last = i.updates[i.updates.length - 1];
    return {
      subject: `[Status] Update (${i.phase}): ${i.title}`,
      body: `Incident update at ${last?.at || new Date().toISOString()}.\nPhase: ${i.phase}\n\n${last?.message || ''}`,
    };
  },
  incident_resolved: (i: Incident) => ({
    subject: `[Status] Resolved: ${i.title}`,
    body: `The incident "${i.title}" was resolved at ${i.resolvedAt || new Date().toISOString()}.\nAffected: ${i.affectedServices.join(', ')}.`,
  }),
  scheduled_maintenance: (m: MaintenanceWindow) => ({
    subject: `[Status] Scheduled maintenance: ${m.title}`,
    body: `Maintenance window: ${m.startsAt} to ${m.endsAt}.\nAffected: ${m.affectedServices.join(', ')}.\n\n${m.description}`,
  }),
  maintenance_reminder: (m: MaintenanceWindow, when: string) => ({
    subject: `[Status] Maintenance in ${when}: ${m.title}`,
    body: `Reminder (${when}): maintenance starts at ${m.startsAt} (ends ${m.endsAt}).\nAffected: ${m.affectedServices.join(', ')}.\n\n${m.description}`,
  }),
} as const;

export class NotificationLog {
  readonly records: NotificationRecord[] = [];

  push(row: NotificationRecord): void {
    this.records.unshift(row);
  }
}

async function deliver(
  log: NotificationLog,
  sender: EmailSender | undefined,
  channel: NotificationRecord['channel'],
  template: string,
  recipients: string[],
  subject: string,
  body: string,
  refs?: { incidentId?: string; maintenanceId?: string },
): Promise<NotificationRecord> {
  if (sender && recipients.length > 0) {
    await sender({ to: recipients, subject, body, template });
  }
  const row: NotificationRecord = {
    id: randomUUID(),
    channel,
    template,
    incidentId: refs?.incidentId,
    maintenanceId: refs?.maintenanceId,
    recipients: [...recipients],
    subject,
    body,
    at: new Date().toISOString(),
  };
  log.push(row);
  return row;
}

export async function notifyActiveUsers(
  incident: Incident,
  activeUserEmails: string[],
  opts?: { sender?: EmailSender; log?: NotificationLog; kind?: 'detected' | 'update' | 'resolved' },
): Promise<NotificationRecord> {
  const log = opts?.log || new NotificationLog();
  const kind = opts?.kind || 'detected';
  const tpl =
    kind === 'resolved'
      ? templates.incident_resolved(incident)
      : kind === 'update'
        ? templates.incident_update(incident)
        : templates.incident_detected(incident);
  const templateName =
    kind === 'resolved' ? 'incident_resolved' : kind === 'update' ? 'incident_update' : 'incident_detected';
  return deliver(log, opts?.sender, 'email_active_users', templateName, activeUserEmails, tpl.subject, tpl.body, {
    incidentId: incident.id,
  });
}

export async function notifySubscribers(
  incident: Incident,
  subscriberEmails: string[],
  opts?: { sender?: EmailSender; log?: NotificationLog; kind?: 'detected' | 'update' | 'resolved' },
): Promise<NotificationRecord> {
  const log = opts?.log || new NotificationLog();
  const kind = opts?.kind || 'detected';
  const tpl =
    kind === 'resolved'
      ? templates.incident_resolved(incident)
      : kind === 'update'
        ? templates.incident_update(incident)
        : templates.incident_detected(incident);
  const templateName =
    kind === 'resolved' ? 'incident_resolved' : kind === 'update' ? 'incident_update' : 'incident_detected';
  return deliver(log, opts?.sender, 'email_subscribers', templateName, subscriberEmails, tpl.subject, tpl.body, {
    incidentId: incident.id,
  });
}

export async function postToSocialMedia(
  incident: Incident,
  opts?: {
    enabled?: boolean;
    poster?: (text: string) => Promise<void> | void;
    log?: NotificationLog;
  },
): Promise<NotificationRecord | null> {
  if (!opts?.enabled) return null;
  const log = opts.log || new NotificationLog();
  const text = `Status update: ${incident.title} (${incident.phase}). See the status page for details.`;
  if (opts.poster) await opts.poster(text);
  return deliver(log, undefined, 'social', 'incident_social', [], text, text, { incidentId: incident.id });
}

export async function sendMaintenanceReminder(
  window: MaintenanceWindow,
  when: '48h' | '24h' | '1h',
  recipients: string[],
  opts?: { sender?: EmailSender; log?: NotificationLog },
): Promise<NotificationRecord> {
  const log = opts?.log || new NotificationLog();
  const tpl = templates.maintenance_reminder(window, when);
  return deliver(
    log,
    opts?.sender,
    'maintenance_reminder',
    `maintenance_reminder_${when}`,
    recipients,
    tpl.subject,
    tpl.body,
    { maintenanceId: window.id },
  );
}

export { templates as notificationTemplates };

import fs from 'node:fs/promises';
import path from 'node:path';
import { appendSecurityAudit } from '../security-audit.js';
import { forensicsEngine } from '../forensics/engine.js';
import type { BreachNotification, ComplianceIncident } from './types.js';
import { breachDir } from './paths.js';

export async function resolveComplianceIncident(incidentId: string): Promise<ComplianceIncident | null> {
  const incident = await forensicsEngine.getIncident(incidentId);
  if (!incident) return null;
  return {
    id: incident.id,
    title: incident.title,
    severity: incident.severity,
    detectedAt: incident.detectedAt,
    involvesPersonalData: incident.classification?.includes('pii') ?? incident.severity !== 'low',
    affectsDataSubjects: incident.severity === 'critical' || incident.severity === 'high',
    sessionId: incident.sessionId,
  };
}

export async function generateBreachNotification(
  incident: ComplianceIncident,
): Promise<BreachNotification> {
  const hoursSinceDetection = (Date.now() - incident.detectedAt) / 3_600_000;
  const requiresSupervisoryNotification = incident.severity === 'high' || incident.severity === 'critical';
  const notificationBody = [
    'GDPR Article 33 breach notification draft',
    '',
    `Incident: ${incident.id}`,
    `Title: ${incident.title}`,
    `Severity: ${incident.severity}`,
    `Detected: ${new Date(incident.detectedAt).toISOString()}`,
    `Personal data involved: ${incident.involvesPersonalData ? 'yes' : 'no'}`,
    `Affected data subjects: ${incident.affectsDataSubjects ? 'yes' : 'unknown'}`,
    '',
    'Nature of breach: security incident recorded in Carina forensics pipeline.',
    'Likely consequences: review forensic timeline and containment status.',
    'Measures taken: automated IR playbook and audit logging.',
  ].join('\n');

  return {
    incidentId: incident.id,
    generatedAt: new Date().toISOString(),
    requiresSupervisoryNotification,
    hoursSinceDetection,
    severity: incident.severity,
    summary: `${incident.title} (${incident.severity})`,
    notificationBody,
    loggedToAuthority: false,
    dataSubjectsNotified: false,
  };
}

export async function logToSupervisoryAuthority(notification: BreachNotification): Promise<void> {
  await fs.mkdir(breachDir(), { recursive: true });
  const filePath = path.join(breachDir(), `${notification.incidentId}-authority-${Date.now()}.json`);
  await fs.writeFile(filePath, JSON.stringify(notification, null, 2), { mode: 0o600 });
  appendSecurityAudit({
    category: 'attestation',
    action: 'breach_authority_log',
    detail: `Breach notification logged for incident ${notification.incidentId}`,
    metadata: { incidentId: notification.incidentId },
  });
  notification.loggedToAuthority = true;
}

export async function notifyDataSubjects(
  incident: ComplianceIncident,
  notification: BreachNotification,
): Promise<void> {
  appendSecurityAudit({
    category: 'attestation',
    action: 'breach_subject_notify',
    detail: `Data subject notification queued for incident ${incident.id}`,
    metadata: {
      incidentId: incident.id,
      sessionId: incident.sessionId,
    },
  });
  notification.dataSubjectsNotified = true;
}

export async function handleBreachNotification(incidentId: string): Promise<BreachNotification | null> {
  const incident = await resolveComplianceIncident(incidentId);
  if (!incident) return null;
  if (!incident.involvesPersonalData) return null;

  const hoursSinceDetection = (Date.now() - incident.detectedAt) / 3_600_000;
  const requiresNotification = incident.severity === 'high' || incident.severity === 'critical';
  if (!requiresNotification || hoursSinceDetection >= 72) {
    const notification = await generateBreachNotification(incident);
    notification.requiresSupervisoryNotification = false;
    return notification;
  }

  const notification = await generateBreachNotification(incident);
  await logToSupervisoryAuthority(notification);
  if (incident.affectsDataSubjects) {
    await notifyDataSubjects(incident, notification);
  }
  return notification;
}

export function formatBreachNotification(notification: BreachNotification): string {
  return [
    `Breach notification for ${notification.incidentId}`,
    `Generated: ${notification.generatedAt}`,
    `Requires supervisory notification: ${notification.requiresSupervisoryNotification}`,
    `Hours since detection: ${notification.hoursSinceDetection.toFixed(1)}`,
    `Logged to authority: ${notification.loggedToAuthority}`,
    `Data subjects notified: ${notification.dataSubjectsNotified}`,
    '',
    notification.notificationBody,
  ].join('\n');
}

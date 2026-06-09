import type { SecurityEvent } from './types.js';

type TemplateFn = (event: SecurityEvent, dashboardUrl: string) => string;

const DASHBOARD = process.env.SCOUT_DASHBOARD_URL ?? 'http://localhost:4444';

interface TemplateSet {
  subject?: string;
  body: TemplateFn;
}

const templates: Record<string, TemplateSet> = {
  'telegram:critical': {
    body: (e) =>
      [
        `*LABYRINTH CRITICAL; ${e.event_type}*`,
        `---`,
        `Instance: ${e.instance_id}`,
        `Time: ${e.created_at.toISOString()}`,
        `Session: ${e.session_id}`,
        `---`,
        `${e.description}`,
        `---`,
        `Action required immediately.`,
        `Ref: ${e.id}`,
        `Dashboard: ${DASHBOARD}`,
      ].join('\n'),
  },
  'telegram:breach': {
    body: (e) =>
      [
        `*BREACH DETECTED*`,
        ``,
        `*LABYRINTH BREACH; ${e.event_type}*`,
        `---`,
        `Instance: ${e.instance_id}`,
        `Time: ${e.created_at.toISOString()}`,
        `Session: ${e.session_id}`,
        `---`,
        `${e.description}`,
        `---`,
        `IMMEDIATE ACTION REQUIRED. Treat as active intrusion.`,
        `Ref: ${e.id}`,
        `Dashboard: ${DASHBOARD}`,
      ].join('\n'),
  },
  'telegram:warning': {
    body: (e) =>
      [
        `*LABYRINTH WARNING; ${e.event_type}*`,
        `---`,
        `Instance: ${e.instance_id}`,
        `Time: ${e.created_at.toISOString()}`,
        `---`,
        `${e.description}`,
        `---`,
        `Ref: ${e.id}`,
        `Dashboard: ${DASHBOARD}`,
      ].join('\n'),
  },
  'telegram:info': {
    body: (e) =>
      [
        `LABYRINTH INFO; ${e.event_type}`,
        `---`,
        `Instance: ${e.instance_id}`,
        `Time: ${e.created_at.toISOString()}`,
        `---`,
        `${e.description}`,
        `---`,
        `Ref: ${e.id}`,
      ].join('\n'),
  },
  'email:critical': {
    subject: `[LABYRINTH CRITICAL] ${'{{event_type}}'}; ${'{{instance_id}}'}`,
    body: (e) =>
      [
        `CRITICAL ALERT: ${e.event_type}`,
        ``,
        `Instance: ${e.instance_id}`,
        `Time: ${e.created_at.toISOString()}`,
        `Session: ${e.session_id}`,
        `Severity: CRITICAL`,
        ``,
        `Description:`,
        `${e.description}`,
        ``,
        `This requires immediate attention.`,
        ``,
        `Ref: ${e.id}`,
        `Dashboard: ${DASHBOARD}`,
      ].join('\n'),
  },
  'email:breach': {
    subject: `[BREACH] ${'{{event_type}}'}; ${'{{instance_id}}'}`,
    body: (e) =>
      [
        `BREACH DETECTED: ${e.event_type}`,
        ``,
        `Instance: ${e.instance_id}`,
        `Time: ${e.created_at.toISOString()}`,
        `Session: ${e.session_id}`,
        `Severity: BREACH`,
        ``,
        `Description:`,
        `${e.description}`,
        ``,
        `TREAT AS ACTIVE INTRUSION. Immediate response required.`,
        ``,
        `Ref: ${e.id}`,
        `Dashboard: ${DASHBOARD}`,
      ].join('\n'),
  },
  'email:warning': {
    subject: `[LABYRINTH WARNING] ${'{{event_type}}'}; ${'{{instance_id}}'}`,
    body: (e) =>
      [
        `WARNING: ${e.event_type}`,
        ``,
        `Instance: ${e.instance_id}`,
        `Time: ${e.created_at.toISOString()}`,
        `Severity: WARNING`,
        ``,
        `Description: ${e.description}`,
        ``,
        `Ref: ${e.id}`,
        `Dashboard: ${DASHBOARD}`,
      ].join('\n'),
  },
  'email:info': {
    subject: `[LABYRINTH INFO] ${'{{event_type}}'}; ${'{{instance_id}}'}`,
    body: (e) =>
      [
        `INFO: ${e.event_type}`,
        ``,
        `Instance: ${e.instance_id}`,
        `Time: ${e.created_at.toISOString()}`,
        ``,
        `Description: ${e.description}`,
        ``,
        `Ref: ${e.id}`,
      ].join('\n'),
  },
  'sms:critical': {
    body: (e) =>
      `[LABYRINTH CRITICAL] ${e.event_type}; Instance: ${e.instance_id}; ${e.description.slice(0, 100)}; Ref: ${e.id}`,
  },
  'sms:breach': {
    body: (e) =>
      `[BREACH] ${e.event_type}; Instance: ${e.instance_id}; ${e.description.slice(0, 100)}; IMMEDIATE ACTION REQUIRED; Ref: ${e.id}`,
  },
  'sms:warning': {
    body: (e) =>
      `[LABYRINTH WARNING] ${e.event_type}; Instance: ${e.instance_id}; ${e.description.slice(0, 120)}; Ref: ${e.id}`,
  },
  'discord:critical': {
    body: (e) =>
      [
        `@here **LABYRINTH CRITICAL; ${e.event_type}**`,
        `> Instance: ${e.instance_id}`,
        `> Time: ${e.created_at.toISOString()}`,
        `> Session: ${e.session_id}`,
        `> ${e.description}`,
        ``,
        `Ref: ${e.id} | Dashboard: ${DASHBOARD}`,
      ].join('\n'),
  },
  'discord:breach': {
    body: (e) =>
      [
        `@everyone **BREACH DETECTED**`,
        `> **${e.event_type}**`,
        `> Instance: ${e.instance_id}`,
        `> Time: ${e.created_at.toISOString()}`,
        `> ${e.description}`,
        ``,
        `IMMEDIATE ACTION REQUIRED; treat as active intrusion.`,
        `Ref: ${e.id} | Dashboard: ${DASHBOARD}`,
      ].join('\n'),
  },
  'discord:warning': {
    body: (e) =>
      [
        `**LABYRINTH WARNING; ${e.event_type}**`,
        `> Instance: ${e.instance_id}`,
        `> Time: ${e.created_at.toISOString()}`,
        `> ${e.description}`,
        ``,
        `Ref: ${e.id} | Dashboard: ${DASHBOARD}`,
      ].join('\n'),
  },
  'discord:info': {
    body: (e) =>
      [
        `**LABYRINTH INFO; ${e.event_type}**`,
        `> Instance: ${e.instance_id}`,
        `> ${e.description}`,
        ``,
        `Ref: ${e.id}`,
      ].join('\n'),
  },
  'dashboard:critical': {
    body: (e) =>
      JSON.stringify({
        severity: 'critical',
        event_type: e.event_type,
        instance_id: e.instance_id,
        session_id: e.session_id,
        description: e.description,
        created_at: e.created_at.toISOString(),
        ref: e.id,
      }),
  },
  'dashboard:breach': {
    body: (e) =>
      JSON.stringify({
        severity: 'breach',
        event_type: e.event_type,
        instance_id: e.instance_id,
        session_id: e.session_id,
        description: e.description,
        created_at: e.created_at.toISOString(),
        ref: e.id,
      }),
  },
  'dashboard:warning': {
    body: (e) =>
      JSON.stringify({
        severity: 'warning',
        event_type: e.event_type,
        instance_id: e.instance_id,
        description: e.description,
        created_at: e.created_at.toISOString(),
        ref: e.id,
      }),
  },
  'dashboard:info': {
    body: (e) =>
      JSON.stringify({
        severity: 'info',
        event_type: e.event_type,
        instance_id: e.instance_id,
        description: e.description,
        created_at: e.created_at.toISOString(),
        ref: e.id,
      }),
  },
};

export function getTemplate(
  channel: string,
  severity: string,
): { subject?: string; body: TemplateFn } | null {
  return templates[`${channel}:${severity}`] ?? null;
}

export function formatAlert(
  channel: string,
  severity: string,
  event: SecurityEvent,
): string | null {
  const tpl = getTemplate(channel, severity);
  if (!tpl) return null;
  return tpl.body(event, DASHBOARD);
}

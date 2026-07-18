import { insertKnowledgeDocument, OPS_KNOWLEDGE_WRITE } from '../../workers/knowledge-base.js';
import { getBinding } from './store.js';
import { pushDocumentToDrive } from './sync-engine.js';
import type { OpsCategory } from './types.js';

async function createAndPush(opts: {
  workspaceId: string;
  workerId: string;
  category: OpsCategory;
  title: string;
  content: string;
}) {
  const binding = await getBinding(opts.workspaceId, opts.workerId);
  if (!binding?.rootFolderId) {
    throw new Error('Bootstrap Workspace Ops before capturing documents');
  }
  const doc = await insertKnowledgeDocument({
    workerId: opts.workerId,
    workspaceId: opts.workspaceId,
    title: opts.title,
    content: opts.content,
    ...OPS_KNOWLEDGE_WRITE,
  });
  await pushDocumentToDrive({
    binding,
    documentId: doc.id,
    category: opts.category,
  });
  return doc;
}

function bulletLines(items: string[], emptyFallback: string): string[] {
  return items.length ? items.map((n) => `- ${n}`) : [`- ${emptyFallback}`];
}

export function buildMinutesContent(opts: {
  date: string;
  title: string;
  bullets: string[];
}): { title: string; content: string } {
  const title = opts.title.trim() || `Minutes ${opts.date}`;
  const content = [
    'Minutes',
    `Date: ${opts.date}`,
    `Title: ${title}`,
    '',
    'Notes:',
    ...bulletLines(opts.bullets, '(add notes)'),
  ].join('\n');
  return { title, content };
}

export function buildAttendanceContent(opts: {
  meetingDate: string;
  sessionTitle?: string;
  venueOrSessionType?: string;
  present: string[];
  apologies: string[];
}): { title: string; content: string } {
  const sessionTitle = (opts.sessionTitle ?? '').trim();
  const venueOrSessionType = (opts.venueOrSessionType ?? '').trim();
  const title = sessionTitle
    ? `Attendance ${opts.meetingDate}: ${sessionTitle}`
    : `Attendance ${opts.meetingDate}`;
  const content = [
    'Attendance sheet',
    `Session date: ${opts.meetingDate}`,
    `Session name: ${sessionTitle || '(not recorded)'}`,
    `Venue / session type: ${venueOrSessionType || '(not recorded)'}`,
    '',
    'Present (verified only):',
    ...bulletLines(opts.present, '(none recorded)'),
    '',
    'Apologies:',
    ...bulletLines(opts.apologies, '(none recorded)'),
    '',
    'Rule: Aiva must not invent attendees. Only use names listed here.',
    'Month 1 use: save after each community session for funder evidence. Charts come later if needed.',
  ].join('\n');
  return { title, content };
}

export function buildNextMeetingContent(opts: {
  when: string;
  invitees: string[];
  agenda: string[];
}): { title: string; content: string } {
  const title = 'NEXT meeting';
  const content = [
    'Next meeting',
    `When: ${opts.when}`,
    '',
    'Invitees:',
    ...bulletLines(opts.invitees, '(add invitees)'),
    '',
    'Agenda:',
    ...(opts.agenda.length
      ? opts.agenda.map((item, i) => `${i + 1}. ${item}`)
      : ['1. (add agenda)']),
  ].join('\n');
  return { title, content };
}

export function buildFunderMonthContent(opts: {
  month: string;
  count?: number | null;
  bullets: string[];
  sessionsHeldCount?: number | null;
  postersComms?: string[];
  outcomesQuotes?: string[];
}): { title: string; content: string } {
  const title = `Monthly funder report ${opts.month}`;
  const countLine =
    opts.count == null || Number.isNaN(opts.count)
      ? 'People supported (count only if verified): (not recorded)'
      : `People supported (count only if verified): ${opts.count}`;
  const sessionsLine =
    opts.sessionsHeldCount == null || Number.isNaN(opts.sessionsHeldCount)
      ? 'Sessions held (count only if verified): (not recorded)'
      : `Sessions held (count only if verified): ${opts.sessionsHeldCount}`;
  const posters = (opts.postersComms ?? []).map((s) => s.trim()).filter(Boolean);
  const outcomes = (opts.outcomesQuotes ?? []).map((s) => s.trim()).filter(Boolean);
  const content = [
    'Monthly funder evidence pack',
    `Month: ${opts.month}`,
    sessionsLine,
    countLine,
    '',
    'Activity bullets:',
    ...bulletLines(opts.bullets, '(add activity bullets)'),
    '',
    'Posters / communications done (human-entered only):',
    ...bulletLines(posters, '(none recorded)'),
    '',
    'Outcomes / quotes (human-entered only):',
    ...bulletLines(outcomes, '(none recorded)'),
    '',
    'Draft status: draft',
    'Human approval required before send.',
    'Rule: Do not invent beneficiary numbers, session counts, or quotes.',
    'Month 1 use: one structured Drive document per month for funders. Charts come later if needed.',
  ].join('\n');
  return { title, content };
}

export async function captureMinutes(opts: {
  workspaceId: string;
  workerId: string;
  date: string;
  title: string;
  bullets: string[];
}) {
  const { title, content } = buildMinutesContent(opts);
  return createAndPush({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    category: 'minutes',
    title,
    content,
  });
}

export async function captureAttendance(opts: {
  workspaceId: string;
  workerId: string;
  meetingDate: string;
  sessionTitle?: string;
  venueOrSessionType?: string;
  present: string[];
  apologies: string[];
}) {
  const { title, content } = buildAttendanceContent(opts);
  return createAndPush({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    category: 'attendance',
    title,
    content,
  });
}

export async function captureNextMeeting(opts: {
  workspaceId: string;
  workerId: string;
  when: string;
  invitees: string[];
  agenda: string[];
}) {
  const { title, content } = buildNextMeetingContent(opts);
  return createAndPush({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    category: 'next-meeting',
    title,
    content,
  });
}

export async function captureFunderMonth(opts: {
  workspaceId: string;
  workerId: string;
  month: string;
  count?: number | null;
  bullets: string[];
  sessionsHeldCount?: number | null;
  postersComms?: string[];
  outcomesQuotes?: string[];
}) {
  const { title, content } = buildFunderMonthContent(opts);
  return createAndPush({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    category: 'funder-month',
    title,
    content,
  });
}

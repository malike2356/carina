import { insertKnowledgeDocument } from '../../workers/knowledge-base.js';
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
  });
  await pushDocumentToDrive({
    binding,
    documentId: doc.id,
    category: opts.category,
  });
  return doc;
}

export async function captureMinutes(opts: {
  workspaceId: string;
  workerId: string;
  date: string;
  title: string;
  bullets: string[];
}) {
  const title = opts.title.trim() || `Minutes ${opts.date}`;
  const content = [
    'Minutes',
    `Date: ${opts.date}`,
    `Title: ${title}`,
    '',
    'Notes:',
    ...opts.bullets.map((b) => `- ${b}`),
  ].join('\n');
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
  present: string[];
  apologies: string[];
}) {
  const title = `Attendance ${opts.meetingDate}`;
  const content = [
    'Attendance',
    `Meeting date: ${opts.meetingDate}`,
    '',
    'Present:',
    ...(opts.present.length ? opts.present.map((n) => `- ${n}`) : ['- (none recorded)']),
    '',
    'Apologies:',
    ...(opts.apologies.length ? opts.apologies.map((n) => `- ${n}`) : ['- (none recorded)']),
    '',
    'Rule: Aiva must not invent attendees. Only use names listed here.',
  ].join('\n');
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
  const title = 'NEXT meeting';
  const content = [
    'Next meeting',
    `When: ${opts.when}`,
    '',
    'Invitees:',
    ...(opts.invitees.length ? opts.invitees.map((n) => `- ${n}`) : ['- (add invitees)']),
    '',
    'Agenda:',
    ...(opts.agenda.length
      ? opts.agenda.map((item, i) => `${i + 1}. ${item}`)
      : ['1. (add agenda)']),
  ].join('\n');
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
}) {
  const title = `Funder month ${opts.month}`;
  const countLine =
    opts.count == null || Number.isNaN(opts.count)
      ? 'People supported (count only if verified): (not recorded)'
      : `People supported (count only if verified): ${opts.count}`;
  const content = [
    'Funder month update',
    `Month: ${opts.month}`,
    countLine,
    '',
    'Activity bullets:',
    ...(opts.bullets.length ? opts.bullets.map((b) => `- ${b}`) : ['- (add bullets)']),
    '',
    'Draft status: draft',
    'Rule: Do not invent beneficiary numbers. Human approval required before send.',
  ].join('\n');
  return createAndPush({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    category: 'funder-month',
    title,
    content,
  });
}

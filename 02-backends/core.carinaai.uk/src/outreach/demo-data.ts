/**
 * Identify and purge SOP / seeded demo outreach rows while leaving real data.
 * Markers: tag SOP_DEMO, *@sop-demo.test emails, "SOP Demo*" list/campaign names,
 * and Soft Wall drafts that mention SOP_DEMO / SOP Demo Soft Wall.
 */

import { listPendingApprovals } from '../ingestion/email/worker-approval-store.js';
import { rejectEmailApproval } from '../ingestion/email/email-draft-handler.js';
import { ensureOutreachStoreReady, loadOutreachStore, mutateOutreachStore } from './store.js';
import type { OutreachLead, OutreachStoreShape } from './types.js';

export const SOP_DEMO_TAG = 'SOP_DEMO';

const DEMO_EMAIL_RE = /@sop-demo\.test$/i;
const DEMO_TEXT_RE = /SOP_DEMO|sop-demo\.test/i;
const DEMO_LIST_NAME_RE = /SOP Demo/i;
const DEMO_APPROVAL_RE = /SOP Demo Soft Wall|SOP_DEMO/i;

export type DemoOutreachPreview = {
  leads: number;
  replyReviews: number;
  bookings: number;
  lists: number;
  campaigns: number;
  enrollments: number;
  deliveries: number;
  followUpTasks: number;
  softWallPending: number;
};

export type DemoOutreachPurgeResult = DemoOutreachPreview & {
  purged: true;
  softWallRejected: number;
};

function isDemoLead(lead: OutreachLead): boolean {
  if ((lead.tags || []).includes(SOP_DEMO_TAG)) return true;
  if (lead.email && DEMO_EMAIL_RE.test(lead.email)) return true;
  const blob = `${lead.notes || ''}${lead.email || ''}${lead.name || ''}`;
  return DEMO_TEXT_RE.test(blob);
}

function demoLeadIds(store: OutreachStoreShape, workspaceId: string): Set<string> {
  return new Set(
    store.leads.filter((l) => l.workspaceId === workspaceId && isDemoLead(l)).map((l) => l.id),
  );
}

function countDemoInStore(store: OutreachStoreShape, workspaceId: string): Omit<DemoOutreachPreview, 'softWallPending'> {
  const leadIds = demoLeadIds(store, workspaceId);
  return {
    leads: leadIds.size,
    replyReviews: store.replyReviews.filter(
      (r) =>
        r.workspaceId === workspaceId &&
        ((r.leadId != null && leadIds.has(r.leadId)) ||
          DEMO_TEXT_RE.test(`${r.bodyPreview || ''}${r.note || ''}${r.subject || ''}`)),
    ).length,
    bookings: store.bookings.filter(
      (b) =>
        b.workspaceId === workspaceId &&
        (leadIds.has(b.leadId) || DEMO_TEXT_RE.test(b.notes || '')),
    ).length,
    lists: (store.lists || []).filter(
      (list) => list.workspaceId === workspaceId && DEMO_LIST_NAME_RE.test(list.name || ''),
    ).length,
    campaigns: (store.campaigns || []).filter(
      (c) => c.workspaceId === workspaceId && DEMO_LIST_NAME_RE.test(c.name || ''),
    ).length,
    enrollments: (store.enrollments || []).filter(
      (e) => e.workspaceId === workspaceId && leadIds.has(e.leadId),
    ).length,
    deliveries: (store.deliveries || []).filter(
      (d) => d.workspaceId === workspaceId && leadIds.has(d.leadId),
    ).length,
    followUpTasks: (store.followUpTasks || []).filter(
      (t) => t.workspaceId === workspaceId && leadIds.has(t.leadId),
    ).length,
  };
}

async function countDemoSoftWallPending(workspaceId: string): Promise<number> {
  try {
    const pending = await listPendingApprovals(workspaceId, 200);
    return pending.filter((a) => DEMO_APPROVAL_RE.test(`${a.subject || ''}${a.draftBody || ''}`)).length;
  } catch {
    return 0;
  }
}

export async function previewDemoOutreachData(workspaceId: string): Promise<DemoOutreachPreview> {
  await ensureOutreachStoreReady();
  const counts = countDemoInStore(loadOutreachStore(), workspaceId);
  const softWallPending = await countDemoSoftWallPending(workspaceId);
  return { ...counts, softWallPending };
}

function purgeStoreDemoRows(workspaceId: string): Omit<DemoOutreachPreview, 'softWallPending'> {
  let removed: Omit<DemoOutreachPreview, 'softWallPending'> = {
    leads: 0,
    replyReviews: 0,
    bookings: 0,
    lists: 0,
    campaigns: 0,
    enrollments: 0,
    deliveries: 0,
    followUpTasks: 0,
  };

  mutateOutreachStore((s) => {
    const before = countDemoInStore(s, workspaceId);
    const leadIds = demoLeadIds(s, workspaceId);

    s.leads = s.leads.filter((l) => !leadIds.has(l.id));
    s.replyReviews = s.replyReviews.filter(
      (r) =>
        !(
          r.workspaceId === workspaceId &&
          ((r.leadId != null && leadIds.has(r.leadId)) ||
            DEMO_TEXT_RE.test(`${r.bodyPreview || ''}${r.note || ''}${r.subject || ''}`))
        ),
    );
    s.bookings = s.bookings.filter(
      (b) =>
        !(
          b.workspaceId === workspaceId &&
          (leadIds.has(b.leadId) || DEMO_TEXT_RE.test(b.notes || ''))
        ),
    );
    s.lists = (s.lists || []).filter(
      (list) => !(list.workspaceId === workspaceId && DEMO_LIST_NAME_RE.test(list.name || '')),
    );
    s.campaigns = (s.campaigns || []).filter(
      (c) => !(c.workspaceId === workspaceId && DEMO_LIST_NAME_RE.test(c.name || '')),
    );
    s.enrollments = (s.enrollments || []).filter(
      (e) => !(e.workspaceId === workspaceId && leadIds.has(e.leadId)),
    );
    s.deliveries = (s.deliveries || []).filter(
      (d) => !(d.workspaceId === workspaceId && leadIds.has(d.leadId)),
    );
    s.followUpTasks = (s.followUpTasks || []).filter(
      (t) => !(t.workspaceId === workspaceId && leadIds.has(t.leadId)),
    );

    removed = before;
  });

  return removed;
}

async function rejectDemoSoftWallApprovals(workspaceId: string): Promise<number> {
  let rejected = 0;
  try {
    const pending = await listPendingApprovals(workspaceId, 200);
    for (const a of pending) {
      if (!DEMO_APPROVAL_RE.test(`${a.subject || ''}${a.draftBody || ''}`)) continue;
      await rejectEmailApproval({
        workspaceId,
        approvalId: a.id,
        reviewedBy: 'demo_data_purge',
      });
      rejected += 1;
    }
  } catch {
    // Soft Wall store may be unavailable in unit tests / offline cores.
  }
  return rejected;
}

/** Remove SOP_DEMO-tagged and other demo markers; keep non-demo outreach rows. */
export async function purgeDemoOutreachData(workspaceId: string): Promise<DemoOutreachPurgeResult> {
  await ensureOutreachStoreReady();
  const softWallPending = await countDemoSoftWallPending(workspaceId);
  const removed = purgeStoreDemoRows(workspaceId);
  const softWallRejected = await rejectDemoSoftWallApprovals(workspaceId);
  return {
    ...removed,
    softWallPending,
    softWallRejected,
    purged: true,
  };
}

export function demoOutreachTotal(preview: DemoOutreachPreview): number {
  return (
    preview.leads +
    preview.replyReviews +
    preview.bookings +
    preview.lists +
    preview.campaigns +
    preview.enrollments +
    preview.deliveries +
    preview.followUpTasks +
    preview.softWallPending
  );
}

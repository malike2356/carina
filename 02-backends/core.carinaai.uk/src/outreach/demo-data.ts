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

export const DEMO_OUTREACH_CATEGORIES = [
  'leads',
  'lists',
  'campaigns',
  'enrollments',
  'deliveries',
  'replyReviews',
  'bookings',
  'followUpTasks',
  'softWallPending',
] as const;

export type DemoOutreachCategory = (typeof DEMO_OUTREACH_CATEGORIES)[number];

export type DemoOutreachPreview = Record<DemoOutreachCategory, number>;

export type DemoOutreachPurgeSelection = {
  /** When true (default), purge every demo category. */
  all?: boolean;
  /** Explicit category list. Ignored when all is true. */
  categories?: DemoOutreachCategory[];
};

export type DemoOutreachPurgeResult = DemoOutreachPreview & {
  purged: true;
  softWallRejected: number;
  selected: DemoOutreachCategory[];
};

function emptyPreview(): DemoOutreachPreview {
  return {
    leads: 0,
    replyReviews: 0,
    bookings: 0,
    lists: 0,
    campaigns: 0,
    enrollments: 0,
    deliveries: 0,
    followUpTasks: 0,
    softWallPending: 0,
  };
}

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

export function isDemoOutreachCategory(value: unknown): value is DemoOutreachCategory {
  return typeof value === 'string' && (DEMO_OUTREACH_CATEGORIES as readonly string[]).includes(value);
}

/** Resolve which categories to purge. Default is all categories. */
export function resolveDemoPurgeCategories(
  selection?: DemoOutreachPurgeSelection | null,
): DemoOutreachCategory[] {
  if (!selection || selection.all === true || selection.categories == null) {
    return [...DEMO_OUTREACH_CATEGORIES];
  }
  const unique = new Set<DemoOutreachCategory>();
  for (const item of selection.categories) {
    if (isDemoOutreachCategory(item)) unique.add(item);
  }
  return [...DEMO_OUTREACH_CATEGORIES].filter((key) => unique.has(key));
}

export async function previewDemoOutreachData(workspaceId: string): Promise<DemoOutreachPreview> {
  await ensureOutreachStoreReady();
  const counts = countDemoInStore(loadOutreachStore(), workspaceId);
  const softWallPending = await countDemoSoftWallPending(workspaceId);
  return { ...counts, softWallPending };
}

function purgeStoreDemoRows(
  workspaceId: string,
  categories: Set<DemoOutreachCategory>,
): Omit<DemoOutreachPreview, 'softWallPending'> {
  const removed: Omit<DemoOutreachPreview, 'softWallPending'> = {
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

    if (categories.has('replyReviews')) {
      s.replyReviews = s.replyReviews.filter(
        (r) =>
          !(
            r.workspaceId === workspaceId &&
            ((r.leadId != null && leadIds.has(r.leadId)) ||
              DEMO_TEXT_RE.test(`${r.bodyPreview || ''}${r.note || ''}${r.subject || ''}`))
          ),
      );
      removed.replyReviews = before.replyReviews;
    }
    if (categories.has('bookings')) {
      s.bookings = s.bookings.filter(
        (b) =>
          !(
            b.workspaceId === workspaceId &&
            (leadIds.has(b.leadId) || DEMO_TEXT_RE.test(b.notes || ''))
          ),
      );
      removed.bookings = before.bookings;
    }
    if (categories.has('lists')) {
      s.lists = (s.lists || []).filter(
        (list) => !(list.workspaceId === workspaceId && DEMO_LIST_NAME_RE.test(list.name || '')),
      );
      removed.lists = before.lists;
    }
    if (categories.has('campaigns')) {
      s.campaigns = (s.campaigns || []).filter(
        (c) => !(c.workspaceId === workspaceId && DEMO_LIST_NAME_RE.test(c.name || '')),
      );
      removed.campaigns = before.campaigns;
    }
    if (categories.has('enrollments')) {
      s.enrollments = (s.enrollments || []).filter(
        (e) => !(e.workspaceId === workspaceId && leadIds.has(e.leadId)),
      );
      removed.enrollments = before.enrollments;
    }
    if (categories.has('deliveries')) {
      s.deliveries = (s.deliveries || []).filter(
        (d) => !(d.workspaceId === workspaceId && leadIds.has(d.leadId)),
      );
      removed.deliveries = before.deliveries;
    }
    if (categories.has('followUpTasks')) {
      s.followUpTasks = (s.followUpTasks || []).filter(
        (t) => !(t.workspaceId === workspaceId && leadIds.has(t.leadId)),
      );
      removed.followUpTasks = before.followUpTasks;
    }
    // Leads last so lead-bound category filters still see demo lead ids above.
    if (categories.has('leads')) {
      s.leads = s.leads.filter((l) => !leadIds.has(l.id));
      removed.leads = before.leads;
    }
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
export async function purgeDemoOutreachData(
  workspaceId: string,
  selection?: DemoOutreachPurgeSelection | null,
): Promise<DemoOutreachPurgeResult> {
  const selected = resolveDemoPurgeCategories(selection);
  if (selected.length === 0) {
    throw new Error('Select at least one demo data category to purge');
  }
  const categorySet = new Set(selected);

  await ensureOutreachStoreReady();
  const softWallPending = categorySet.has('softWallPending')
    ? await countDemoSoftWallPending(workspaceId)
    : 0;
  const removed = purgeStoreDemoRows(workspaceId, categorySet);
  const softWallRejected = categorySet.has('softWallPending')
    ? await rejectDemoSoftWallApprovals(workspaceId)
    : 0;

  return {
    ...emptyPreview(),
    ...removed,
    softWallPending,
    softWallRejected,
    selected,
    purged: true,
  };
}

export function demoOutreachTotal(preview: DemoOutreachPreview): number {
  return DEMO_OUTREACH_CATEGORIES.reduce((sum, key) => sum + (preview[key] ?? 0), 0);
}

export function demoOutreachSelectedTotal(
  preview: DemoOutreachPreview,
  categories: DemoOutreachCategory[],
): number {
  return categories.reduce((sum, key) => sum + (preview[key] ?? 0), 0);
}

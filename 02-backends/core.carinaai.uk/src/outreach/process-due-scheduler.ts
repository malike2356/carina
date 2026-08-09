/**
 * Platform heartbeat: process due Soft Wall sequence sends, booking reminders, and follow-ups.
 */

import { Cron } from 'croner';
import { processDueFollowUps } from './follow-ups.js';
import { processDueReminders } from './reminders.js';
import { processDueSendsWithSoftWall } from './soft-wall-approvals.js';
import { processDueVicalReminders } from '../vical/reminders.js';
import { listOutreachWorkspaceIdsAsync } from './store.js';

let dueCron: Cron | null = null;

async function listOutreachWorkspaceIds(): Promise<string[]> {
  return listOutreachWorkspaceIdsAsync();
}

export async function sweepOutreachProcessDue(): Promise<{
  workspaces: number;
  deliveriesQueued: number;
  softWallBridged: number;
  reminders: number;
  followUps: number;
  vicalReminders: number;
}> {
  const workspaceIds = await listOutreachWorkspaceIds();
  let deliveriesQueued = 0;
  let softWallBridged = 0;
  let reminders = 0;
  let followUps = 0;
  let vicalReminders = 0;

  for (const workspaceId of workspaceIds) {
    try {
      const due = await processDueSendsWithSoftWall(workspaceId);
      deliveriesQueued += due.processed.length;
      softWallBridged += due.softWall.bridged;
    } catch (err) {
      console.warn(`[outreach-due] process-due failed for ${workspaceId}:`, err);
    }

    try {
      const rem = processDueReminders(workspaceId);
      reminders += rem.sent.length;
    } catch (err) {
      console.warn(`[outreach-due] reminders failed for ${workspaceId}:`, err);
    }

    try {
      const fu = await processDueFollowUps(workspaceId);
      followUps += fu.sent.length;
    } catch (err) {
      console.warn(`[outreach-due] follow-ups failed for ${workspaceId}:`, err);
    }

    try {
      const vical = processDueVicalReminders(workspaceId);
      vicalReminders += vical.sent;
    } catch (err) {
      console.warn(`[outreach-due] vical reminders failed for ${workspaceId}:`, err);
    }
  }

  return {
    workspaces: workspaceIds.length,
    deliveriesQueued,
    softWallBridged,
    reminders,
    followUps,
    vicalReminders,
  };
}

/** Every 5 minutes during service hours; Soft Wall only queues Approvals, never auto-sends cold mail. */
export function startOutreachProcessDueScheduler(): void {
  if (dueCron) return;
  dueCron = new Cron('*/5 * * * *', () => {
    void sweepOutreachProcessDue()
      .then((summary) => {
        if (
          summary.deliveriesQueued > 0
          || summary.softWallBridged > 0
          || summary.reminders > 0
          || summary.followUps > 0
          || summary.vicalReminders > 0
        ) {
          console.log(
            `[outreach-due] workspaces=${summary.workspaces} queued=${summary.deliveriesQueued} softWall=${summary.softWallBridged} reminders=${summary.reminders} followUps=${summary.followUps} vical=${summary.vicalReminders}`,
          );
        }
      })
      .catch((err) => {
        console.warn('[outreach-due] sweep failed:', err);
      });
  });
  setTimeout(() => {
    void sweepOutreachProcessDue().catch((err) => {
      console.warn('[outreach-due] initial sweep failed:', err);
    });
  }, 60_000);
}

export function stopOutreachProcessDueScheduler(): void {
  dueCron?.stop();
  dueCron = null;
}

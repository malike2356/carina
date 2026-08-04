import { getEmailConnection, listSenders } from '../ingestion/email/email-connection-store.js';
import { countSentToday } from './business-hours.js';
import { getLead, listCampaigns } from './leads.js';
import { listDeliveries } from './sequence-engine.js';
import type { OutreachCampaign } from './types.js';

function localDateParts(date: Date, timezone: string): { year: number; month: number; day: number; weekday: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(date);
    const year = Number(parts.find((part) => part.type === 'year')?.value ?? date.getUTCFullYear());
    const month = Number(parts.find((part) => part.type === 'month')?.value ?? date.getUTCMonth() + 1);
    const day = Number(parts.find((part) => part.type === 'day')?.value ?? date.getUTCDate());
    const weekdayLabel = parts.find((part) => part.type === 'weekday')?.value ?? '';
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return {
      year,
      month,
      day,
      weekday: weekdayMap[weekdayLabel] ?? date.getUTCDay(),
    };
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      weekday: date.getUTCDay(),
    };
  }
}

function localDateKey(date: Date, timezone: string): string {
  const parts = localDateParts(date, timezone);
  return `${parts.year.toString().padStart(4, '0')}-${parts.month.toString().padStart(2, '0')}-${parts.day
    .toString()
    .padStart(2, '0')}`;
}

function weekStartKey(now: Date, timezone: string): string {
  const parts = localDateParts(now, timezone);
  const start = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  start.setUTCDate(start.getUTCDate() - parts.weekday);
  return `${start.getUTCFullYear().toString().padStart(4, '0')}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
}

function isWithinWeek(date: Date, timezone: string, startKey: string): boolean {
  return localDateKey(date, timezone) >= startKey;
}

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function deliveriesForCampaign(workspaceId: string, campaignId: string) {
  return listDeliveries(workspaceId).filter((delivery) => {
    const lead = getLead(workspaceId, delivery.leadId);
    return lead?.campaignId === campaignId;
  });
}

export type OutreachCadenceCampaignSummary = {
  campaignId: string;
  name: string;
  active: boolean;
  dailyCap: number;
  weeklyTarget: number | null;
  requireApproval: boolean;
  warmupDays: number;
  fromEmail: string | null;
  connectedMailbox: string | null;
  senderMatches: boolean;
  sentToday: number;
  sentThisWeek: number;
  remainingToday: number;
  remainingToWeeklyTarget: number | null;
  warmupActive: boolean;
  ageDays: number;
};

export type OutreachCadenceSummary = {
  workspaceId: string;
  generatedAt: string;
  timezone: string;
  activeCampaigns: number;
  totalDailyCap: number;
  totalWeeklyTarget: number | null;
  sentToday: number;
  sentThisWeek: number;
  pendingApprovals: number;
  remainingToday: number;
  remainingToWeeklyTarget: number | null;
  campaigns: OutreachCadenceCampaignSummary[];
};

export async function getConnectedMailboxAddress(workerId: string): Promise<string | null> {
  const connection = await getEmailConnection(workerId);
  if (!connection) return null;
  const senders = await listSenders(connection.id);
  const sender = senders.find((row) => row.emailAddress.trim()) ?? null;
  return sender?.emailAddress.trim().toLowerCase() ?? null;
}

export async function validateCampaignFromMailbox(input: {
  workerId: string;
  campaign: OutreachCampaign;
}): Promise<{ ok: boolean; reason?: string; connectedMailbox?: string | null }> {
  const expected = input.campaign.cadence.fromEmail?.trim().toLowerCase();
  if (!expected) {
    return { ok: true, connectedMailbox: await getConnectedMailboxAddress(input.workerId) };
  }
  const connectedMailbox = await getConnectedMailboxAddress(input.workerId);
  if (!connectedMailbox) {
    return { ok: false, reason: 'No connected Gmail mailbox found', connectedMailbox: null };
  }
  if (normalizeAddress(expected) !== normalizeAddress(connectedMailbox)) {
    return {
      ok: false,
      reason: `Configured sender ${expected} does not match the connected mailbox ${connectedMailbox}`,
      connectedMailbox,
    };
  }
  return { ok: true, connectedMailbox };
}

export async function buildOutreachCadenceSummary(input: {
  workspaceId: string;
  workerId?: string;
  now?: Date;
}): Promise<OutreachCadenceSummary> {
  const now = input.now ?? new Date();
  const campaigns = listCampaigns(input.workspaceId).filter((campaign) => campaign.active);
  const deliveries = listDeliveries(input.workspaceId);

  const timezones = campaigns.map((campaign) => campaign.cadence.timezone).filter(Boolean);
  const timezone = timezones[0] ?? 'Europe/London';
  const weekKey = weekStartKey(now, timezone);

  const campaignSummaries: OutreachCadenceCampaignSummary[] = [];
  for (const campaign of campaigns) {
    const campaignDeliveries = deliveriesForCampaign(input.workspaceId, campaign.id);
    const sentToday = countSentToday(
      campaignDeliveries,
      now,
      campaign.cadence.timezone,
    );
    const sentThisWeek = campaignDeliveries.filter((delivery) => {
      if (!['sent', 'delivered', 'pending_approval'].includes(delivery.status)) return false;
      return isWithinWeek(new Date(delivery.updatedAt || delivery.createdAt), campaign.cadence.timezone, weekKey);
    }).length;
    const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(campaign.createdAt).getTime()) / (24 * 60 * 60 * 1000)));
    const warmupDays = Math.max(0, campaign.cadence.warmupDays ?? 14);
    const warmupActive = Boolean(campaign.cadence.requireApproval ?? true) || ageDays < warmupDays;
    const connectedMailbox = input.workerId ? await getConnectedMailboxAddress(input.workerId) : null;
    const senderMatches = campaign.cadence.fromEmail
      ? Boolean(connectedMailbox && normalizeAddress(campaign.cadence.fromEmail) === normalizeAddress(connectedMailbox))
      : true;
    const remainingToday = Math.max(0, campaign.cadence.dailyCap - sentToday);
    const weeklyTarget = campaign.cadence.weeklyTarget ?? null;
    const remainingToWeeklyTarget = weeklyTarget == null ? null : Math.max(0, weeklyTarget - sentThisWeek);

    campaignSummaries.push({
      campaignId: campaign.id,
      name: campaign.name,
      active: campaign.active,
      dailyCap: campaign.cadence.dailyCap,
      weeklyTarget,
      requireApproval: campaign.cadence.requireApproval ?? true,
      warmupDays,
      fromEmail: campaign.cadence.fromEmail ?? null,
      connectedMailbox,
      senderMatches,
      sentToday,
      sentThisWeek,
      remainingToday,
      remainingToWeeklyTarget,
      warmupActive,
      ageDays,
    });
  }

  const totalDailyCap = campaignSummaries.reduce((sum, item) => sum + item.dailyCap, 0);
  const totalWeeklyTarget = campaignSummaries.some((item) => item.weeklyTarget != null)
    ? campaignSummaries.reduce((sum, item) => sum + (item.weeklyTarget ?? 0), 0)
    : null;
  const sentToday = campaignSummaries.reduce((sum, item) => sum + item.sentToday, 0);
  const sentThisWeek = campaignSummaries.reduce((sum, item) => sum + item.sentThisWeek, 0);
  const pendingApprovals = deliveries.filter((delivery) => delivery.workspaceId === input.workspaceId && delivery.status === 'pending_approval').length;
  const remainingToday = Math.max(0, totalDailyCap - sentToday);
  const remainingToWeeklyTarget = totalWeeklyTarget == null ? null : Math.max(0, totalWeeklyTarget - sentThisWeek);

  return {
    workspaceId: input.workspaceId,
    generatedAt: now.toISOString(),
    timezone,
    activeCampaigns: campaignSummaries.length,
    totalDailyCap,
    totalWeeklyTarget,
    sentToday,
    sentThisWeek,
    pendingApprovals,
    remainingToday,
    remainingToWeeklyTarget,
    campaigns: campaignSummaries,
  };
}

import crypto from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../lib/property-channel-store.js';
import type { LeadRoutingDestination, YouTubeLead } from './types.js';
import type { LeadDetectionResult } from './types.js';

const LEADS_FILE = 'youtube-leads.json';
const POLL_STATE_FILE = 'youtube-comment-poll-state.json';

interface PollState {
  channelId: string;
  lastPolledAt: string;
  seenCommentIds: string[];
}

function emptyLeads(): YouTubeLead[] {
  return [];
}

function emptyPollStates(): PollState[] {
  return [];
}

export function getPollState(channelId: string): PollState | undefined {
  return loadJsonStore<PollState[]>(POLL_STATE_FILE, emptyPollStates).find((s) => s.channelId === channelId);
}

/** True once the configured poll interval has elapsed since the last poll. */
export function isDueForPoll(channelId: string, intervalMinutes: number, now: Date = new Date()): boolean {
  const state = getPollState(channelId);
  if (!state) return true;
  const elapsedMs = now.getTime() - new Date(state.lastPolledAt).getTime();
  return elapsedMs >= intervalMinutes * 60 * 1000;
}

export function filterUnseenCommentIds(channelId: string, commentIds: string[]): string[] {
  const state = getPollState(channelId);
  if (!state) return commentIds;
  const seen = new Set(state.seenCommentIds);
  return commentIds.filter((id) => !seen.has(id));
}

export function recordPoll(channelId: string, seenCommentIds: string[], now: Date = new Date()): void {
  const store = loadJsonStore<PollState[]>(POLL_STATE_FILE, emptyPollStates);
  const idx = store.findIndex((s) => s.channelId === channelId);
  const existingSeen = idx >= 0 ? store[idx]!.seenCommentIds : [];
  const merged = Array.from(new Set([...existingSeen, ...seenCommentIds])).slice(-2000);
  const state: PollState = { channelId, lastPolledAt: now.toISOString(), seenCommentIds: merged };
  if (idx >= 0) store[idx] = state;
  else store.push(state);
  saveJsonStore(POLL_STATE_FILE, store);
}

export function createLead(input: {
  workspaceId: string;
  channelId: string;
  commentId: string;
  videoId: string;
  authorDisplayName: string;
  text: string;
  detection: LeadDetectionResult;
  destination: LeadRoutingDestination;
}): YouTubeLead {
  const store = loadJsonStore<YouTubeLead[]>(LEADS_FILE, emptyLeads);
  const existing = store.find((l) => l.commentId === input.commentId && l.channelId === input.channelId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const lead: YouTubeLead = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    channelId: input.channelId,
    commentId: input.commentId,
    videoId: input.videoId,
    authorDisplayName: input.authorDisplayName,
    text: input.text,
    classification: input.detection.classification,
    signals: input.detection.signals,
    contactInfo: input.detection.contactInfo,
    destination: input.destination,
    status: input.destination === 'none' ? 'new' : 'routed',
    createdAt: now,
    updatedAt: now,
  };
  store.push(lead);
  saveJsonStore(LEADS_FILE, store);
  return lead;
}

export function listLeads(
  workspaceId: string,
  channelId: string,
  filter?: { classification?: YouTubeLead['classification'] },
): YouTubeLead[] {
  const leads = loadJsonStore<YouTubeLead[]>(LEADS_FILE, emptyLeads).filter(
    (l) => l.workspaceId === workspaceId && l.channelId === channelId,
  );
  if (filter?.classification) return leads.filter((l) => l.classification === filter.classification);
  return leads;
}

export function updateLeadStatus(id: string, status: YouTubeLead['status']): YouTubeLead | null {
  const store = loadJsonStore<YouTubeLead[]>(LEADS_FILE, emptyLeads);
  const idx = store.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  store[idx] = { ...store[idx]!, status, updatedAt: new Date().toISOString() };
  saveJsonStore(LEADS_FILE, store);
  return store[idx]!;
}

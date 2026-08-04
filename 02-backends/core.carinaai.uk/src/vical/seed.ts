import {
  createAvailabilityRule,
  createEventType,
  getOrCreatePublishProfile,
  listAvailabilityRules,
  listEventTypes,
} from './bookings.js';
import type { VcalEventType } from './types.js';

const DEFAULT_EVENING_WINDOWS = [
  { dayOfWeek: 1, startTime: '18:00', endTime: '20:30' },
  { dayOfWeek: 2, startTime: '18:00', endTime: '20:30' },
  { dayOfWeek: 3, startTime: '18:00', endTime: '20:30' },
  { dayOfWeek: 4, startTime: '18:00', endTime: '20:30' },
];

/** Ensure a Discovery call event type + evening windows exist for outreach cutover. */
export function ensureDiscoveryDefaults(input: {
  workspaceId: string;
  hostUserId: string;
  timezone?: string;
}): { eventType: VcalEventType; created: boolean } {
  const existing = listEventTypes(input.workspaceId).find((e) => e.slug === 'discovery-call');
  if (existing) {
    getOrCreatePublishProfile({ workspaceId: input.workspaceId, hostUserId: input.hostUserId });
    if (listAvailabilityRules(input.workspaceId, input.hostUserId).length === 0) {
      for (const window of DEFAULT_EVENING_WINDOWS) {
        createAvailabilityRule({
          workspaceId: input.workspaceId,
          hostUserId: input.hostUserId,
          dayOfWeek: window.dayOfWeek,
          startTime: window.startTime,
          endTime: window.endTime,
          timezone: input.timezone ?? 'Europe/London',
        });
      }
    }
    return { eventType: existing, created: false };
  }

  const eventType = createEventType({
    workspaceId: input.workspaceId,
    hostUserId: input.hostUserId,
    name: 'Discovery call',
    slug: 'discovery-call',
    durationMinutes: 30,
    bufferAfterMinutes: 10,
    minNoticeMinutes: 120,
    horizonDays: 14,
    locationMode: 'google_meet',
  });

  for (const window of DEFAULT_EVENING_WINDOWS) {
    createAvailabilityRule({
      workspaceId: input.workspaceId,
      hostUserId: input.hostUserId,
      dayOfWeek: window.dayOfWeek,
      startTime: window.startTime,
      endTime: window.endTime,
      timezone: input.timezone ?? 'Europe/London',
    });
  }

  getOrCreatePublishProfile({ workspaceId: input.workspaceId, hostUserId: input.hostUserId });
  return { eventType, created: true };
}

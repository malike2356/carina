import type { BookingConfig, BookingWindow } from '../outreach/types.js';
import {
  listAvailabilityRules,
  listBlackouts,
  listEventTypes,
  replaceAvailabilityRules,
  updateEventType,
} from './bookings.js';
import { ensureDiscoveryDefaults } from './seed.js';
import type { VcalEventType } from './types.js';

/** Map outreach BookingConfig windows onto viCal availability + discovery event type. */
export function syncConfigFromOutreach(
  workspaceId: string,
  hostUserId: string,
  config: BookingConfig,
): { eventType: VcalEventType; rules: ReturnType<typeof replaceAvailabilityRules> } {
  const { eventType } = ensureDiscoveryDefaults({
    workspaceId,
    hostUserId,
    timezone: config.timezone,
  });

  updateEventType(workspaceId, eventType.id, {
    durationMinutes: config.slotMinutes,
    bufferAfterMinutes: config.bufferMinutes,
    horizonDays: config.horizonDays,
    locationMode: config.meetingMode === 'zoom' ? 'zoom' : 'google_meet',
  });

  const rules = replaceAvailabilityRules(
    workspaceId,
    hostUserId,
    config.windows.map((w: BookingWindow) => ({
      dayOfWeek: w.dayOfWeek,
      startTime: w.start,
      endTime: w.end,
      timezone: config.timezone,
    })),
    config.timezone,
  );

  return { eventType, rules };
}

export function readConfigAsOutreach(workspaceId: string, hostUserId: string): BookingConfig | null {
  const eventType =
    listEventTypes(workspaceId, { activeOnly: true }).find((e) => e.slug === 'discovery-call') ??
    listEventTypes(workspaceId, { activeOnly: true })[0];
  if (!eventType) return null;
  const rules = listAvailabilityRules(workspaceId, hostUserId);
  const blackouts = listBlackouts(workspaceId);
  return {
    timezone: rules[0]?.timezone ?? 'Europe/London',
    slotMinutes: eventType.durationMinutes,
    bufferMinutes: eventType.bufferAfterMinutes,
    horizonDays: eventType.horizonDays,
    reminderOffsetsMinutes: [1440, 30],
    windows: rules.map((r) => ({ dayOfWeek: r.dayOfWeek, start: r.startTime, end: r.endTime })),
    blockedDates: blackouts.map((b) => b.startsOn),
    meetingMode: eventType.locationMode === 'zoom' ? 'zoom' : 'google_meet',
  };
}

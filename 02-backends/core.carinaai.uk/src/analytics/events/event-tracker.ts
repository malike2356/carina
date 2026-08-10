/**
 * Fire-and-forget product event instrumentation.
 * Register new feature event names in event-schema REGISTERED_FEATURES at build time.
 */

import {
  assertNoPiiInProperties,
  newEventId,
  type AnalyticsEvent,
  type FeatureAction,
  type RegisteredFeature,
} from './event-schema.js';
import { enqueueEvent } from './event-bus.js';

export type TrackEventInput = {
  workspaceId: string;
  userId: string;
  eventName: string;
  sessionId?: string;
  timestamp?: string;
  properties?: Record<string, unknown>;
};

export type TrackResult =
  | { ok: true; event: AnalyticsEvent; queued: true }
  | { ok: false; error: string };

export function trackEvent(input: TrackEventInput): TrackResult {
  if (!input.workspaceId?.trim() || !input.userId?.trim() || !input.eventName?.trim()) {
    return { ok: false, error: 'workspaceId, userId, and eventName are required' };
  }
  const cleaned = assertNoPiiInProperties(input.properties);
  if (!cleaned.ok) return { ok: false, error: cleaned.error };

  const event: AnalyticsEvent = {
    eventId: newEventId(),
    workspaceId: input.workspaceId.trim(),
    userId: input.userId.trim(),
    sessionId: input.sessionId?.trim() || undefined,
    eventName: input.eventName.trim(),
    timestamp: input.timestamp || new Date().toISOString(),
    properties: cleaned.properties,
  };
  enqueueEvent(event);
  return { ok: true, event, queued: true };
}

export function trackFeatureUse(
  workspaceId: string,
  userId: string,
  featureName: RegisteredFeature | string,
  action: FeatureAction,
  extras?: { sessionId?: string; properties?: Record<string, unknown> },
): TrackResult {
  return trackEvent({
    workspaceId,
    userId,
    eventName: 'feature_use',
    sessionId: extras?.sessionId,
    properties: {
      feature: featureName,
      action,
      ...(extras?.properties ?? {}),
    },
  });
}

export function trackPageView(
  workspaceId: string,
  userId: string,
  pathName: string,
  extras?: { sessionId?: string; properties?: Record<string, unknown> },
): TrackResult {
  return trackEvent({
    workspaceId,
    userId,
    eventName: 'page_view',
    sessionId: extras?.sessionId,
    properties: {
      path: pathName.slice(0, 300),
      ...(extras?.properties ?? {}),
    },
  });
}

export function trackApiCall(
  workspaceId: string,
  userId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  durationMs: number,
  extras?: { sessionId?: string; properties?: Record<string, unknown> },
): TrackResult {
  return trackEvent({
    workspaceId,
    userId,
    eventName: 'api_call',
    sessionId: extras?.sessionId,
    properties: {
      endpoint: endpoint.slice(0, 300),
      method: method.toUpperCase().slice(0, 16),
      statusCode,
      durationMs: Math.max(0, Math.round(durationMs)),
      ...(extras?.properties ?? {}),
    },
  });
}

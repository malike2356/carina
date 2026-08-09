/**
 * Provider-neutral conferencing adapter (Prompt 703).
 * Zoom is the first production adapter; static room URL is an explicitly labelled fallback.
 */

import type { ProviderResultStatus } from '../../customer-concierge/types.js';

export type ConferencingProviderId = 'zoom' | 'static_url' | 'none';

export type ConferenceCreateInput = {
  workspaceId: string;
  workerId: string;
  bookingId: string;
  topic: string;
  startsAt: string;
  durationMinutes: number;
  timezone?: string;
  guestEmail?: string;
  /** Same key as booking intent; adapter must return the same meeting on replay. */
  idempotencyKey: string;
  /** Optional labelled fallback when managed Zoom is unavailable. */
  staticRoomUrl?: string;
};

export type ConferenceUpdateInput = ConferenceCreateInput & {
  providerMeetingId: string;
};

export type ConferenceDeleteInput = {
  workspaceId: string;
  workerId: string;
  bookingId: string;
  providerMeetingId: string;
  idempotencyKey: string;
};

export type ConferenceArtifactSafe = {
  provider: ConferencingProviderId;
  providerMeetingId: string | null;
  joinUrl: string | null;
  /** Never expose to prompts, logs, analytics, or browser responses. */
  hostStartUrlPresent: boolean;
  passcodeRequired: boolean;
  waitingRoom: boolean;
  managed: boolean;
  fallbackLabel?: string;
};

export type ConferenceAdapterResult = {
  ok: boolean;
  status: ProviderResultStatus;
  artifact: ConferenceArtifactSafe;
  /** Encrypted / in-memory only; never serialize into public DTOs. */
  hostStartUrl?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  retryAfterMs?: number;
  duplicate?: boolean;
};

export interface ConferencingAdapter {
  readonly provider: ConferencingProviderId;
  createMeeting(input: ConferenceCreateInput): Promise<ConferenceAdapterResult>;
  updateMeeting(input: ConferenceUpdateInput): Promise<ConferenceAdapterResult>;
  deleteMeeting(input: ConferenceDeleteInput): Promise<ConferenceAdapterResult>;
}

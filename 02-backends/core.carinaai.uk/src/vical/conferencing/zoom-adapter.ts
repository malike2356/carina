/**
 * Production Zoom Meetings adapter (user-authorized OAuth).
 * Never weakens waiting room / passcode to manufacture success.
 * Host start_url is returned only on the private field; callers must not log it.
 */

import { getToolSession, upsertToolSession } from '../../workers/product-tools/sessions.js';
import {
  isZoomOAuthConfigured,
  refreshZoomAccessToken,
} from '../../workers/product-tools/zoom-oauth.js';
import type {
  ConferenceAdapterResult,
  ConferenceCreateInput,
  ConferenceDeleteInput,
  ConferenceUpdateInput,
  ConferencingAdapter,
} from './types.js';

export type ZoomHttpResponse = {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
};

export type ZoomFetch = (url: string, init?: RequestInit) => Promise<ZoomHttpResponse>;

export type ZoomTokenBundle = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string | null;
};

export type ZoomAdapterDeps = {
  fetchImpl?: ZoomFetch;
  getTokens?: (workspaceId: string, workerId: string) => Promise<ZoomTokenBundle | null>;
  saveTokens?: (workspaceId: string, workerId: string, tokens: ZoomTokenBundle) => Promise<void>;
  /** In-memory create cache keyed by idempotencyKey for hermetic tests and process replay. */
  meetingByIdempotency?: Map<string, ConferenceAdapterResult>;
};

export class ZoomConferencingError extends Error {
  constructor(
    message: string,
    readonly code: 'expired_token' | 'rate_limited' | 'not_configured' | 'api_error' | 'forbidden',
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ZoomConferencingError';
  }
}

async function defaultGetTokens(workspaceId: string, workerId: string): Promise<ZoomTokenBundle | null> {
  const session = await getToolSession(workspaceId, workerId, 'zoom');
  if (!session?.credentials?.access_token) return null;
  return {
    accessToken: session.credentials.access_token,
    refreshToken: session.credentials.refresh_token,
    expiresAt: session.expiresAt,
  };
}

async function defaultSaveTokens(
  workspaceId: string,
  workerId: string,
  tokens: ZoomTokenBundle,
): Promise<void> {
  await upsertToolSession({
    workspaceId,
    workerId,
    toolSlug: 'zoom',
    provider: 'zoom',
    credentials: {
      access_token: tokens.accessToken,
      ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
    },
    meta: { connectedVia: 'zoom-refresh', refreshedAt: new Date().toISOString() },
    expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
  });
}

function parseRetryAfterMs(res: ZoomHttpResponse): number | undefined {
  const raw = res.headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000);
  return undefined;
}

export class ZoomConferencingAdapter implements ConferencingAdapter {
  readonly provider = 'zoom' as const;
  private readonly fetchImpl: ZoomFetch;
  private readonly getTokens: NonNullable<ZoomAdapterDeps['getTokens']>;
  private readonly saveTokens: NonNullable<ZoomAdapterDeps['saveTokens']>;
  private readonly meetingByIdempotency: Map<string, ConferenceAdapterResult>;

  constructor(deps: ZoomAdapterDeps = {}) {
    this.fetchImpl = deps.fetchImpl ?? ((url, init) => fetch(url, init) as Promise<ZoomHttpResponse>);
    this.getTokens = deps.getTokens ?? defaultGetTokens;
    this.saveTokens = deps.saveTokens ?? defaultSaveTokens;
    this.meetingByIdempotency = deps.meetingByIdempotency ?? new Map();
  }

  async createMeeting(input: ConferenceCreateInput): Promise<ConferenceAdapterResult> {
    const existing = this.meetingByIdempotency.get(input.idempotencyKey);
    if (existing) {
      return { ...existing, duplicate: true, status: existing.ok ? 'duplicate' : existing.status };
    }

    try {
      const token = await this.resolveAccessToken(input.workspaceId, input.workerId);
      const body = {
        topic: input.topic.slice(0, 200),
        type: 2,
        start_time: input.startsAt,
        duration: Math.max(15, Math.min(480, input.durationMinutes)),
        timezone: input.timezone ?? 'UTC',
        // Preserve account defaults; do not disable waiting room / passcode.
        settings: {
          join_before_host: false,
          waiting_room: true,
          meeting_authentication: false,
        },
      };
      const res = await this.fetchImpl('https://api.zoom.us/v2/users/me/meetings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        throw new ZoomConferencingError('Zoom access token expired or revoked', 'expired_token');
      }
      if (res.status === 429) {
        throw new ZoomConferencingError('Zoom rate limited', 'rate_limited', parseRetryAfterMs(res));
      }
      if (!res.status || res.status >= 400) {
        const text = await res.text().catch(() => '');
        throw new ZoomConferencingError(
          text.slice(0, 200) || `Zoom create meeting failed (${res.status})`,
          'api_error',
        );
      }
      const data = (await res.json()) as {
        id?: number | string;
        join_url?: string;
        start_url?: string;
        password?: string;
        settings?: { waiting_room?: boolean };
      };
      const result: ConferenceAdapterResult = {
        ok: true,
        status: 'succeeded',
        artifact: {
          provider: 'zoom',
          providerMeetingId: data.id != null ? String(data.id) : null,
          joinUrl: data.join_url ?? null,
          hostStartUrlPresent: Boolean(data.start_url),
          passcodeRequired: Boolean(data.password),
          waitingRoom: data.settings?.waiting_room !== false,
          managed: true,
        },
        hostStartUrl: data.start_url ?? null,
      };
      this.meetingByIdempotency.set(input.idempotencyKey, result);
      return result;
    } catch (err) {
      return this.mapError(err);
    }
  }

  async updateMeeting(input: ConferenceUpdateInput): Promise<ConferenceAdapterResult> {
    try {
      const token = await this.resolveAccessToken(input.workspaceId, input.workerId);
      const res = await this.fetchImpl(
        `https://api.zoom.us/v2/meetings/${encodeURIComponent(input.providerMeetingId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': input.idempotencyKey,
          },
          body: JSON.stringify({
            topic: input.topic.slice(0, 200),
            start_time: input.startsAt,
            duration: Math.max(15, Math.min(480, input.durationMinutes)),
            timezone: input.timezone ?? 'UTC',
          }),
        },
      );
      if (res.status === 401) {
        throw new ZoomConferencingError('Zoom access token expired or revoked', 'expired_token');
      }
      if (res.status === 429) {
        throw new ZoomConferencingError('Zoom rate limited', 'rate_limited', parseRetryAfterMs(res));
      }
      if (res.status >= 400) {
        const text = await res.text().catch(() => '');
        throw new ZoomConferencingError(
          text.slice(0, 200) || `Zoom update meeting failed (${res.status})`,
          'api_error',
        );
      }
      // PATCH returns 204; re-fetch safe join fields.
      const getRes = await this.fetchImpl(
        `https://api.zoom.us/v2/meetings/${encodeURIComponent(input.providerMeetingId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = (await getRes.json().catch(() => ({}))) as {
        id?: number | string;
        join_url?: string;
        start_url?: string;
        password?: string;
        settings?: { waiting_room?: boolean };
      };
      const result: ConferenceAdapterResult = {
        ok: true,
        status: 'succeeded',
        artifact: {
          provider: 'zoom',
          providerMeetingId: String(data.id ?? input.providerMeetingId),
          joinUrl: data.join_url ?? null,
          hostStartUrlPresent: Boolean(data.start_url),
          passcodeRequired: Boolean(data.password),
          waitingRoom: data.settings?.waiting_room !== false,
          managed: true,
        },
        hostStartUrl: data.start_url ?? null,
      };
      this.meetingByIdempotency.set(input.idempotencyKey, result);
      return result;
    } catch (err) {
      return this.mapError(err);
    }
  }

  async deleteMeeting(input: ConferenceDeleteInput): Promise<ConferenceAdapterResult> {
    try {
      const token = await this.resolveAccessToken(input.workspaceId, input.workerId);
      const res = await this.fetchImpl(
        `https://api.zoom.us/v2/meetings/${encodeURIComponent(input.providerMeetingId)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': input.idempotencyKey,
          },
        },
      );
      if (res.status === 401) {
        throw new ZoomConferencingError('Zoom access token expired or revoked', 'expired_token');
      }
      if (res.status === 429) {
        throw new ZoomConferencingError('Zoom rate limited', 'rate_limited', parseRetryAfterMs(res));
      }
      // 204 or 404 both mean meeting is gone.
      if (res.status >= 400 && res.status !== 404) {
        const text = await res.text().catch(() => '');
        throw new ZoomConferencingError(
          text.slice(0, 200) || `Zoom delete meeting failed (${res.status})`,
          'api_error',
        );
      }
      this.meetingByIdempotency.delete(input.idempotencyKey);
      return {
        ok: true,
        status: 'succeeded',
        artifact: {
          provider: 'zoom',
          providerMeetingId: input.providerMeetingId,
          joinUrl: null,
          hostStartUrlPresent: false,
          passcodeRequired: false,
          waitingRoom: true,
          managed: true,
        },
      };
    } catch (err) {
      return this.mapError(err);
    }
  }

  private async resolveAccessToken(workspaceId: string, workerId: string): Promise<string> {
    const tokens = await this.getTokens(workspaceId, workerId);
    if (!tokens?.accessToken) {
      throw new ZoomConferencingError('Zoom is not connected for this worker', 'not_configured');
    }
    if (tokens.expiresAt) {
      const exp = Date.parse(tokens.expiresAt);
      if (Number.isFinite(exp) && exp < Date.now() + 60_000) {
        if (!tokens.refreshToken || !isZoomOAuthConfigured()) {
          throw new ZoomConferencingError('Zoom access token expired', 'expired_token');
        }
        const refreshed = await refreshZoomAccessToken(tokens.refreshToken);
        await this.saveTokens(workspaceId, workerId, {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
          expiresAt: refreshed.expiresIn
            ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
            : null,
        });
        return refreshed.accessToken;
      }
    }
    return tokens.accessToken;
  }

  private mapError(err: unknown): ConferenceAdapterResult {
    if (err instanceof ZoomConferencingError) {
      const status =
        err.code === 'rate_limited' || err.code === 'api_error'
          ? 'retryable'
          : err.code === 'not_configured'
            ? 'not_configured'
            : err.code === 'expired_token'
              ? 'action_required'
              : 'failed';
      return {
        ok: false,
        status,
        artifact: {
          provider: 'zoom',
          providerMeetingId: null,
          joinUrl: null,
          hostStartUrlPresent: false,
          passcodeRequired: false,
          waitingRoom: true,
          managed: true,
        },
        errorCode: err.code,
        errorMessage: err.message,
        retryAfterMs: err.retryAfterMs,
      };
    }
    return {
      ok: false,
      status: 'failed',
      artifact: {
        provider: 'zoom',
        providerMeetingId: null,
        joinUrl: null,
        hostStartUrlPresent: false,
        passcodeRequired: false,
        waitingRoom: true,
        managed: true,
      },
      errorCode: 'api_error',
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

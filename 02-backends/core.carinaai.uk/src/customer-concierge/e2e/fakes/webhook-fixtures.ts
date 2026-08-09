/**
 * Signed webhook fixtures for hermetic Customer Concierge tests (Prompt 706).
 */
import crypto from 'crypto';

export function signZoomWebhook(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const message = `v0:${timestamp}:${body}`;
  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return `v0=${digest}`;
}

export function zoomMeetingCreatedFixture(input: {
  meetingId: string;
  hostEmail?: string;
}): { body: string; headers: Record<string, string> } {
  const payload = {
    event: 'meeting.created',
    payload: {
      object: {
        id: input.meetingId,
        host_email: input.hostEmail ?? 'host@example.test',
        join_url: `https://zoom.us/j/${input.meetingId}`,
      },
    },
  };
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = 'zoom_webhook_secret_synth';
  return {
    body,
    headers: {
      'x-zm-request-timestamp': String(timestamp),
      'x-zm-signature': signZoomWebhook(body, secret, timestamp),
      'content-type': 'application/json',
    },
  };
}

export function forgedZoomWebhookFixture(meetingId: string): { body: string; headers: Record<string, string> } {
  const good = zoomMeetingCreatedFixture({ meetingId });
  return {
    body: good.body,
    headers: {
      ...good.headers,
      'x-zm-signature': 'v0=deadbeefforgedsignature0000000000000000000000000000000000000000',
    },
  };
}

export function googleCalendarWebhookHeaders(token: string): Record<string, string> {
  return {
    'x-goog-channel-token': token,
    'x-goog-resource-state': 'exists',
    'x-goog-message-number': '1',
  };
}

export function forgedGoogleCalendarWebhookHeaders(): Record<string, string> {
  return googleCalendarWebhookHeaders('wrong-token');
}

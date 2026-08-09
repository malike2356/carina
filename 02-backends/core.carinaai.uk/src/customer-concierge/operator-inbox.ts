/**
 * Operator inbox for external audience sessions (Prompt 705).
 */

import { pool } from '../memory/db.js';
import { listSupportCases } from './support-cases.js';
import { listBookings } from '../vical/bookings.js';
import { getConferenceArtifact } from '../vical/saga/ledger.js';
import { getCalendarProjection } from '../vical/calendar/projection-store.js';
import { bookingInvitationView } from '../vical/calendar/reconcile.js';

export type InboxConversationRow = {
  audienceSessionId: string;
  workspaceId: string;
  workerId: string;
  channel: string;
  status: string;
  sessionMode: string;
  identityId: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  crmContactId: string | null;
  origin: string | null;
  locale: string | null;
  lastActiveAt: string;
  createdAt: string;
  supportCaseId: string | null;
  supportCaseStatus: string | null;
  supportCasePriority: string | null;
  slaFirstResponseAt: string | null;
  slaResolutionAt: string | null;
  bookingId: string | null;
  bookingStatus: string | null;
  invitationDeliveryState: string | null;
  conferenceManaged: boolean | null;
  calendarEventId: string | null;
};

export type InboxConversationDetail = InboxConversationRow & {
  bookings: Array<Record<string, unknown>>;
  supportCases: Array<Record<string, unknown>>;
  conference: Record<string, unknown> | null;
  calendarProjection: Record<string, unknown> | null;
  links: {
    outreachBookings: string;
    vicalBookings: string;
    pipeline: string;
  };
};

export async function listOperatorInbox(input: {
  workspaceId: string;
  workerId: string;
  status?: string;
  limit?: number;
}): Promise<InboxConversationRow[]> {
  const limit = Math.max(1, Math.min(100, input.limit ?? 50));
  const result = await pool.query(
    `SELECT s.*, i.display_name, i.email, i.phone, i.crm_contact_id
     FROM audience_sessions s
     JOIN audience_identities i ON i.id = s.identity_id
     WHERE s.workspace_id = $1 AND s.worker_id = $2
       AND ($3::text IS NULL OR s.status = $3)
     ORDER BY s.last_active_at DESC
     LIMIT $4`,
    [input.workspaceId, input.workerId, input.status ?? null, limit],
  );

  const cases = await listSupportCases({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    limit: 200,
  }).catch(() => []);
  const bookings = listBookings(input.workspaceId);

  return result.rows.map((row) => {
    const sessionId = String(row.id);
    const identityId = String(row.identity_id);
    const email = row.email != null ? String(row.email).toLowerCase() : null;
    const openCase =
      cases.find((c) => c.audienceSessionId === sessionId && c.status !== 'closed' && c.status !== 'resolved')
      ?? cases.find((c) => c.audienceSessionId === sessionId)
      ?? null;
    const booking =
      (email
        ? bookings
            .filter((b) => b.guestEmail.toLowerCase() === email)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
        : undefined)
      ?? null;
    const conference = booking ? getConferenceArtifact(input.workspaceId, booking.id) : null;
    const projection = booking ? getCalendarProjection(input.workspaceId, booking.id) : null;
    return {
      audienceSessionId: sessionId,
      workspaceId: String(row.workspace_id),
      workerId: String(row.worker_id),
      channel: String(row.channel),
      status: String(row.status),
      sessionMode: String(row.session_mode),
      identityId,
      displayName: row.display_name != null ? String(row.display_name) : null,
      email,
      phone: row.phone != null ? String(row.phone) : null,
      crmContactId: row.crm_contact_id != null ? String(row.crm_contact_id) : null,
      origin: row.origin != null ? String(row.origin) : null,
      locale: row.locale != null ? String(row.locale) : null,
      lastActiveAt: new Date(String(row.last_active_at)).toISOString(),
      createdAt: new Date(String(row.created_at)).toISOString(),
      supportCaseId: openCase?.id ?? null,
      supportCaseStatus: openCase?.status ?? null,
      supportCasePriority: openCase?.priority ?? null,
      slaFirstResponseAt: openCase?.slaFirstResponseAt ?? null,
      slaResolutionAt: openCase?.slaResolutionAt ?? null,
      bookingId: booking?.id ?? null,
      bookingStatus: booking?.status ?? null,
      invitationDeliveryState: booking?.invitationDeliveryState ?? null,
      conferenceManaged: conference?.managed ?? null,
      calendarEventId: booking?.calendarEventId ?? projection?.providerEventId ?? null,
    };
  });
}

export async function getOperatorInboxDetail(input: {
  workspaceId: string;
  workerId: string;
  audienceSessionId: string;
}): Promise<InboxConversationDetail | null> {
  const rows = await listOperatorInbox({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    limit: 100,
  });
  const row = rows.find((r) => r.audienceSessionId === input.audienceSessionId);
  if (!row) return null;

  const cases = await listSupportCases({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    limit: 200,
  }).catch(() => []);
  const supportCases = cases
    .filter((c) => c.audienceSessionId === input.audienceSessionId)
    .map((c) => ({
      id: c.id,
      status: c.status,
      priority: c.priority,
      subject: c.subject,
      slaFirstResponseAt: c.slaFirstResponseAt,
      slaResolutionAt: c.slaResolutionAt,
      firstRespondedAt: c.firstRespondedAt,
      resolvedAt: c.resolvedAt,
    }));

  const bookings = listBookings(input.workspaceId)
    .filter((b) => row.email && b.guestEmail.toLowerCase() === row.email)
    .map((b) => ({
      id: b.id,
      status: b.status,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      meetingUrl: b.meetingUrl,
      calendarEventId: b.calendarEventId,
      orchestrationStatus: b.orchestrationStatus,
      ...bookingInvitationView(b),
      conference: getConferenceArtifact(input.workspaceId, b.id),
      calendarProjection: getCalendarProjection(input.workspaceId, b.id),
    }));

  const primaryBooking = bookings[0] ?? null;
  return {
    ...row,
    bookings,
    supportCases,
    conference: (primaryBooking?.conference as Record<string, unknown> | null) ?? null,
    calendarProjection: (primaryBooking?.calendarProjection as Record<string, unknown> | null) ?? null,
    links: {
      outreachBookings: '/aiva/outreach/bookings',
      vicalBookings: '/vical/bookings',
      pipeline: '/aiva/outreach/pipeline',
    },
  };
}

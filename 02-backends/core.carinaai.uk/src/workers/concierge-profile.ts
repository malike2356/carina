// Concierge profile store (Prompt 698). Configuration layer on existing workers.
import { randomUUID } from 'node:crypto';
import { pool } from '../memory/db.js';
import { getToolSession } from './product-tools/sessions.js';
import { listKnowledgeEntries } from './knowledge-base.js';

export type CalendarProvider = 'google' | 'microsoft' | 'caldav';
export type ConferencingProvider = 'zoom' | 'google_meet';
export type BookingPermission = 'off' | 'offer_only' | 'offer_and_book';

export interface ConciergeChannelConfig {
  web?: { enabled: boolean; originAllowlist?: string[] };
  telegram?: { enabled: boolean };
  whatsapp?: { enabled: boolean };
  email?: { enabled: boolean; address?: string };
  meetingTypes?: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    description?: string;
  }>;
}

export interface ConciergeBusinessHours {
  timezone: string;
  windows: Array<{ dayOfWeek: number; start: string; end: string }>;
}

export interface ConciergeProfile {
  id: string;
  workerId: string;
  workspaceId: string;
  published: boolean;
  publishedAt: string | null;
  personaName: string | null;
  greetingMessage: string | null;
  businessName: string | null;
  businessDescription: string | null;
  knowledgeSourceIds: string[];
  meetingTypeIds: string[];
  channelConfig: ConciergeChannelConfig;
  calendarProvider: CalendarProvider | null;
  calendarConnected: boolean;
  conferencingProvider: ConferencingProvider | null;
  conferencingConnected: boolean;
  businessHours: ConciergeBusinessHours | null;
  escalationEmail: string | null;
  tone: string | null;
  supportedLanguages: string[];
  responseBoundaries: string | null;
  contactCapturePolicy: Record<string, unknown>;
  bookingPermission: BookingPermission;
  slaPolicy: Record<string, unknown>;
  answerPolicy: Record<string, unknown>;
  escalationRules: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  status: 'done' | 'missing' | 'warning';
}

export interface ConciergeReadiness {
  ready: boolean;
  checks: ReadinessCheck[];
  blockers: string[];
  warnings: string[];
}

function mapRow(row: Record<string, unknown>): ConciergeProfile {
  const channelConfig =
    row.channel_config && typeof row.channel_config === 'object'
      ? (row.channel_config as ConciergeChannelConfig)
      : {};
  const businessHours =
    row.business_hours && typeof row.business_hours === 'object'
      ? (row.business_hours as ConciergeBusinessHours)
      : null;
  const asObject = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const bookingPermissionRaw = String(row.booking_permission ?? 'offer_and_book');
  const bookingPermission: BookingPermission =
    bookingPermissionRaw === 'off' || bookingPermissionRaw === 'offer_only'
      ? bookingPermissionRaw
      : 'offer_and_book';
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    published: Boolean(row.published),
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
    personaName: row.persona_name != null ? String(row.persona_name) : null,
    greetingMessage: row.greeting_message != null ? String(row.greeting_message) : null,
    businessName: row.business_name != null ? String(row.business_name) : null,
    businessDescription:
      row.business_description != null ? String(row.business_description) : null,
    knowledgeSourceIds: Array.isArray(row.knowledge_source_ids)
      ? row.knowledge_source_ids.map(String)
      : [],
    meetingTypeIds: Array.isArray(row.meeting_type_ids)
      ? row.meeting_type_ids.map(String)
      : [],
    channelConfig,
    calendarProvider: (row.calendar_provider as CalendarProvider | null) ?? null,
    calendarConnected: Boolean(row.calendar_connected),
    conferencingProvider: (row.conferencing_provider as ConferencingProvider | null) ?? null,
    conferencingConnected: Boolean(row.conferencing_connected),
    businessHours,
    escalationEmail: row.escalation_email != null ? String(row.escalation_email) : null,
    tone: row.tone != null ? String(row.tone) : null,
    supportedLanguages: Array.isArray(row.supported_languages)
      ? row.supported_languages.map(String)
      : [],
    responseBoundaries:
      row.response_boundaries != null ? String(row.response_boundaries) : null,
    contactCapturePolicy: asObject(row.contact_capture_policy),
    bookingPermission,
    slaPolicy: asObject(row.sla_policy),
    answerPolicy: asObject(row.answer_policy),
    escalationRules: asObject(row.escalation_rules),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function getConciergeProfile(
  workspaceId: string,
  workerId: string,
): Promise<ConciergeProfile | null> {
  const result = await pool.query(
    `SELECT * FROM concierge_profiles
     WHERE workspace_id = $1 AND worker_id = $2
     LIMIT 1`,
    [workspaceId, workerId],
  );
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function getPublishedConciergeProfile(
  workerId: string,
): Promise<ConciergeProfile | null> {
  const result = await pool.query(
    `SELECT * FROM concierge_profiles
     WHERE worker_id = $1 AND published = true
     LIMIT 1`,
    [workerId],
  );
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function upsertConciergeStep1(params: {
  workspaceId: string;
  workerId: string;
  personaName: string;
  greetingMessage: string;
  businessName: string;
  businessDescription: string;
  knowledgeSourceIds?: string[];
  escalationEmail: string;
}): Promise<ConciergeProfile> {
  const knowledgeSourceIds = params.knowledgeSourceIds ?? [];
  const result = await pool.query(
    `INSERT INTO concierge_profiles (
       worker_id, workspace_id, persona_name, greeting_message, business_name,
       business_description, knowledge_source_ids, escalation_email, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8,NOW())
     ON CONFLICT (worker_id) DO UPDATE SET
       persona_name = EXCLUDED.persona_name,
       greeting_message = EXCLUDED.greeting_message,
       business_name = EXCLUDED.business_name,
       business_description = EXCLUDED.business_description,
       knowledge_source_ids = EXCLUDED.knowledge_source_ids,
       escalation_email = EXCLUDED.escalation_email,
       updated_at = NOW()
     RETURNING *`,
    [
      params.workerId,
      params.workspaceId,
      params.personaName,
      params.greetingMessage,
      params.businessName,
      params.businessDescription,
      knowledgeSourceIds,
      params.escalationEmail,
    ],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function upsertConciergeStep2(params: {
  workspaceId: string;
  workerId: string;
  channels: ConciergeChannelConfig;
  businessHours: ConciergeBusinessHours;
  calendarProvider?: CalendarProvider | null;
  conferencingProvider?: ConferencingProvider | null;
  meetingTypes?: Array<{ name: string; durationMinutes: number; description?: string }>;
}): Promise<ConciergeProfile> {
  const existing = await getConciergeProfile(params.workspaceId, params.workerId);
  if (!existing) {
    throw Object.assign(new Error('Complete step 1 before step 2'), { status: 400 });
  }

  const meetingTypes = (params.meetingTypes ?? []).map((mt) => ({
    id: randomUUID(),
    name: mt.name,
    durationMinutes: mt.durationMinutes,
    description: mt.description,
  }));

  const channelConfig: ConciergeChannelConfig = {
    ...params.channels,
    meetingTypes,
  };

  const calendarConnected = await resolveCalendarConnected(
    params.workspaceId,
    params.workerId,
    params.calendarProvider ?? null,
  );
  const conferencingConnected = await resolveConferencingConnected(
    params.workspaceId,
    params.workerId,
    params.conferencingProvider ?? null,
  );

  const result = await pool.query(
    `UPDATE concierge_profiles SET
       channel_config = $3::jsonb,
       business_hours = $4::jsonb,
       calendar_provider = $5,
       calendar_connected = $6,
       conferencing_provider = $7,
       conferencing_connected = $8,
       meeting_type_ids = $9::text[],
       updated_at = NOW()
     WHERE workspace_id = $1 AND worker_id = $2
     RETURNING *`,
    [
      params.workspaceId,
      params.workerId,
      JSON.stringify(channelConfig),
      JSON.stringify(params.businessHours),
      params.calendarProvider ?? null,
      calendarConnected,
      params.conferencingProvider ?? null,
      conferencingConnected,
      meetingTypes.map((m) => m.id),
    ],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function upsertConciergePolicy(params: {
  workspaceId: string;
  workerId: string;
  tone?: string | null;
  supportedLanguages?: string[];
  responseBoundaries?: string | null;
  contactCapturePolicy?: Record<string, unknown>;
  bookingPermission?: BookingPermission;
  slaPolicy?: Record<string, unknown>;
  answerPolicy?: Record<string, unknown>;
  escalationRules?: Record<string, unknown>;
}): Promise<ConciergeProfile> {
  const existing = await getConciergeProfile(params.workspaceId, params.workerId);
  if (!existing) {
    throw Object.assign(new Error('Complete step 1 before saving policy'), { status: 400 });
  }

  const bookingPermission = params.bookingPermission ?? existing.bookingPermission;
  const result = await pool.query(
    `UPDATE concierge_profiles SET
       tone = COALESCE($3, tone),
       supported_languages = COALESCE($4::text[], supported_languages),
       response_boundaries = COALESCE($5, response_boundaries),
       contact_capture_policy = COALESCE($6::jsonb, contact_capture_policy),
       booking_permission = $7,
       sla_policy = COALESCE($8::jsonb, sla_policy),
       answer_policy = COALESCE($9::jsonb, answer_policy),
       escalation_rules = COALESCE($10::jsonb, escalation_rules),
       updated_at = NOW()
     WHERE workspace_id = $1 AND worker_id = $2
     RETURNING *`,
    [
      params.workspaceId,
      params.workerId,
      params.tone !== undefined ? params.tone : null,
      params.supportedLanguages ?? null,
      params.responseBoundaries !== undefined ? params.responseBoundaries : null,
      params.contactCapturePolicy != null
        ? JSON.stringify(params.contactCapturePolicy)
        : null,
      bookingPermission,
      params.slaPolicy != null ? JSON.stringify(params.slaPolicy) : null,
      params.answerPolicy != null ? JSON.stringify(params.answerPolicy) : null,
      params.escalationRules != null ? JSON.stringify(params.escalationRules) : null,
    ],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

async function resolveCalendarConnected(
  workspaceId: string,
  workerId: string,
  provider: CalendarProvider | null,
): Promise<boolean> {
  if (!provider) return false;
  if (provider === 'google') {
    const session = await getToolSession(workspaceId, workerId, 'google-calendar');
    return Boolean(session && Object.keys(session.credentials).length > 0);
  }
  if (provider === 'microsoft' || provider === 'caldav') {
    // Connection UI stores a tool session under the provider slug when connected.
    const session = await getToolSession(workspaceId, workerId, `calendar-${provider}`);
    return Boolean(session && Object.keys(session.credentials).length > 0);
  }
  return false;
}

async function resolveConferencingConnected(
  workspaceId: string,
  workerId: string,
  provider: ConferencingProvider | null,
): Promise<boolean> {
  if (!provider) return false;
  if (provider === 'google_meet') {
    const session = await getToolSession(workspaceId, workerId, 'google-calendar');
    return Boolean(session && Object.keys(session.credentials).length > 0);
  }
  if (provider === 'zoom') {
    const session = await getToolSession(workspaceId, workerId, 'zoom');
    return Boolean(session && Object.keys(session.credentials).length > 0);
  }
  return false;
}

export async function refreshConnectionFlags(
  workspaceId: string,
  workerId: string,
): Promise<ConciergeProfile | null> {
  const profile = await getConciergeProfile(workspaceId, workerId);
  if (!profile) return null;
  const calendarConnected = await resolveCalendarConnected(
    workspaceId,
    workerId,
    profile.calendarProvider,
  );
  const conferencingConnected = await resolveConferencingConnected(
    workspaceId,
    workerId,
    profile.conferencingProvider,
  );
  const result = await pool.query(
    `UPDATE concierge_profiles SET
       calendar_connected = $3,
       conferencing_connected = $4,
       updated_at = NOW()
     WHERE workspace_id = $1 AND worker_id = $2
     RETURNING *`,
    [workspaceId, workerId, calendarConnected, conferencingConnected],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function evaluateConciergeReadiness(
  workspaceId: string,
  workerId: string,
): Promise<ConciergeReadiness> {
  const profile = await refreshConnectionFlags(workspaceId, workerId);
  const checks: ReadinessCheck[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  const hasProfile = Boolean(
    profile?.personaName && profile.businessName && profile.greetingMessage && profile.escalationEmail,
  );
  checks.push({
    key: 'profile',
    label: 'Concierge profile',
    status: hasProfile ? 'done' : 'missing',
  });
  if (!hasProfile) blockers.push('profile');

  const channels = profile?.channelConfig ?? {};
  const channelEnabled = Boolean(
    channels.web?.enabled
      || channels.telegram?.enabled
      || channels.whatsapp?.enabled
      || channels.email?.enabled,
  );
  checks.push({
    key: 'channels',
    label: 'At least one channel',
    status: channelEnabled ? 'done' : 'missing',
  });
  if (!channelEnabled) blockers.push('channels');

  let knowledgeOk = false;
  if (profile && profile.knowledgeSourceIds.length > 0) {
    const entries = await listKnowledgeEntries(workerId);
    knowledgeOk = profile.knowledgeSourceIds.some((id) =>
      entries.some((e) => e.id === id && e.enabled && e.publishState === 'published'),
    );
  }
  checks.push({
    key: 'knowledge',
    label: 'Published knowledge source',
    status: knowledgeOk ? 'done' : 'warning',
  });
  if (!knowledgeOk) warnings.push('knowledge');

  const needsCalendar =
    Boolean(profile?.calendarProvider)
    || (profile?.channelConfig.meetingTypes?.length ?? 0) > 0;
  if (needsCalendar) {
    const calendarOk = Boolean(profile?.calendarConnected);
    checks.push({
      key: 'calendar',
      label: 'Calendar connected',
      status: calendarOk ? 'done' : 'missing',
    });
    if (!calendarOk) blockers.push('calendar');
  } else {
    checks.push({ key: 'calendar', label: 'Calendar connected', status: 'done' });
  }

  if (profile?.conferencingProvider) {
    const confOk = Boolean(profile.conferencingConnected);
    checks.push({
      key: 'conferencing',
      label:
        profile.conferencingProvider === 'zoom' ? 'Zoom connected' : 'Conferencing connected',
      status: confOk ? 'done' : 'missing',
    });
    if (!confOk) blockers.push('conferencing');
  } else {
    checks.push({ key: 'conferencing', label: 'Conferencing connected', status: 'done' });
  }

  return {
    ready: blockers.length === 0 && hasProfile && channelEnabled,
    checks,
    blockers,
    warnings,
  };
}

export async function publishConciergeProfile(
  workspaceId: string,
  workerId: string,
): Promise<ConciergeProfile> {
  const readiness = await evaluateConciergeReadiness(workspaceId, workerId);
  if (!readiness.ready) {
    throw Object.assign(new Error('Concierge is not ready to publish'), {
      status: 400,
      readiness,
    });
  }
  const result = await pool.query(
    `UPDATE concierge_profiles SET
       published = true,
       published_at = COALESCE(published_at, NOW()),
       updated_at = NOW()
     WHERE workspace_id = $1 AND worker_id = $2
     RETURNING *`,
    [workspaceId, workerId],
  );
  if (!result.rows[0]) {
    throw Object.assign(new Error('Concierge profile not found'), { status: 404 });
  }
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function unpublishConciergeProfile(
  workspaceId: string,
  workerId: string,
): Promise<ConciergeProfile> {
  const result = await pool.query(
    `UPDATE concierge_profiles SET
       published = false,
       updated_at = NOW()
     WHERE workspace_id = $1 AND worker_id = $2
     RETURNING *`,
    [workspaceId, workerId],
  );
  if (!result.rows[0]) {
    throw Object.assign(new Error('Concierge profile not found'), { status: 404 });
  }
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export function formatBusinessHours(hours: ConciergeBusinessHours | null): string {
  if (!hours?.windows?.length) return 'not configured';
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const parts = hours.windows.map(
    (w) => `${dayNames[w.dayOfWeek] ?? w.dayOfWeek} ${w.start}-${w.end}`,
  );
  return `${parts.join(', ')} (${hours.timezone})`;
}

export function buildConciergePersonaOverlay(profile: ConciergeProfile): string {
  const persona = profile.personaName?.trim() || 'Aiva';
  const business = profile.businessName?.trim() || 'the business';
  const description = profile.businessDescription?.trim() || '';
  const escalation = profile.escalationEmail?.trim() || 'the business owner';
  const tone = profile.tone?.trim() || 'helpful and professional';
  const languages =
    profile.supportedLanguages.length > 0
      ? profile.supportedLanguages.join(', ')
      : 'English';
  const boundaries =
    profile.responseBoundaries?.trim()
    || 'Do not invent policies, prices, legal advice, medical advice, or account access steps.';
  const booking =
    profile.bookingPermission === 'off'
      ? 'Do not offer or create bookings.'
      : profile.bookingPermission === 'offer_only'
        ? 'You may offer available slots but do not confirm bookings yourself.'
        : 'For meeting requests, use the booking tools to offer available slots and confirm when asked.';

  return `
You are ${persona}, representing ${business}.
${description}

Tone: ${tone}. Supported languages: ${languages}.

Grounded answer rules:
- Only answer from published knowledge sources (use concierge-knowledge-search when unsure).
- Cite or paraphrase approved sources. If confidence is low or there is no match, say you do not know and offer to escalate.
- Never invent facts, unpublished drafts, internal notes, or workspace data.
- Response boundaries: ${boundaries}
- Sensitive intents (refunds, legal, medical, account access, security incidents): do not invent answers; open a support case or request handoff.

Rules:
- Never share internal workspace information, private documents, or owner conversations.
- ${booking}
- For issues you cannot resolve, create a support case and offer escalation to ${escalation}.
- Your business hours are ${formatBusinessHours(profile.businessHours)}. Outside these hours, tell the visitor when you will be available.
`.trim();
}

export function publicWidgetEmbed(workerId: string): { publicUrl: string; embedSnippet: string } {
  const publicUrl = `https://app.carinaai.uk/aiva/workers/${encodeURIComponent(workerId)}/chat-preview`;
  const embedSnippet = `<script src="https://core.carinaai.uk/widget.js" data-aiva-id="${workerId}"></script>`;
  return { publicUrl, embedSnippet };
}

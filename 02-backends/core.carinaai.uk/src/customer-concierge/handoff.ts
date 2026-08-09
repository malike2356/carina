/**
 * AI to human handoff for Customer Concierge (Prompt 702).
 * Preserves channel continuity; visitor session stays open while status is handed_off.
 */
import { pool } from '../memory/db.js';
import { appendSecurityAudit } from '../security/security-audit.js';
import { createSupportCase, type SupportCasePriority, type SupportCaseRecord } from './support-cases.js';

export interface HandoffResult {
  audienceSessionId: string;
  status: 'handed_off' | 'active';
  supportCase: SupportCaseRecord | null;
  operatorUserId: string | null;
}

export async function requestHandoff(input: {
  workspaceId: string;
  workerId: string;
  audienceSessionId: string;
  reason: string;
  conciergeProfileId?: string | null;
  identityId?: string | null;
  contactId?: string | null;
  channel?: string;
  conversationSummary?: string | null;
  priority?: SupportCasePriority;
  openCase?: boolean;
}): Promise<HandoffResult> {
  const reason = input.reason.trim() || 'Visitor requested a human';
  let supportCase: SupportCaseRecord | null = null;

  if (input.openCase !== false) {
    supportCase = await createSupportCase({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      conciergeProfileId: input.conciergeProfileId,
      audienceSessionId: input.audienceSessionId,
      identityId: input.identityId,
      contactId: input.contactId,
      channel: input.channel ?? 'web',
      subject: reason.slice(0, 200),
      conversationSummary: input.conversationSummary ?? reason,
      priority: input.priority ?? 'normal',
      actorType: 'ai',
      metadata: { kind: 'handoff_request' },
    });
  }

  const result = await pool.query(
    `UPDATE audience_sessions SET
       status = 'handed_off',
       handed_off_at = NOW(),
       active_support_case_id = COALESCE($2, active_support_case_id),
       conversation_summary = COALESCE($3, conversation_summary),
       updated_at = NOW()
     WHERE id = $1 AND workspace_id = $4
     RETURNING id, status, operator_user_id, active_support_case_id`,
    [
      input.audienceSessionId,
      supportCase?.id ?? null,
      input.conversationSummary ?? reason,
      input.workspaceId,
    ],
  );

  if (!result.rows[0]) {
    throw Object.assign(new Error('Audience session not found'), { status: 404 });
  }

  appendSecurityAudit({
    category: 'auth',
    action: 'concierge_handoff_requested',
    detail: 'Audience session handed off to human operator',
    metadata: {
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      audienceSessionId: input.audienceSessionId,
      caseId: supportCase?.id ?? null,
      reason,
    },
  });

  try {
    const { appendConciergeEvent } = await import('./events.js');
    appendConciergeEvent({
      eventType: 'handoff.requested',
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      actorType: 'system',
      payload: {
        audienceSessionId: input.audienceSessionId,
        caseId: supportCase?.id ?? null,
        channel: input.channel ?? 'web',
        summary: 'Handoff requested; originating channel retained',
      },
    });
  } catch {
    // best-effort
  }

  return {
    audienceSessionId: input.audienceSessionId,
    status: 'handed_off',
    supportCase,
    operatorUserId: result.rows[0].operator_user_id != null
      ? String(result.rows[0].operator_user_id)
      : null,
  };
}

export async function operatorTakeover(input: {
  workspaceId: string;
  audienceSessionId: string;
  operatorUserId: string;
  caseId?: string | null;
}): Promise<HandoffResult> {
  const operatorUserId = input.operatorUserId.trim();
  if (!operatorUserId) {
    throw Object.assign(new Error('operatorUserId is required'), { status: 400 });
  }

  const result = await pool.query(
    `UPDATE audience_sessions SET
       status = 'handed_off',
       handed_off_at = COALESCE(handed_off_at, NOW()),
       operator_user_id = $3,
       active_support_case_id = COALESCE($4, active_support_case_id),
       updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2
     RETURNING id, status, operator_user_id, active_support_case_id`,
    [
      input.audienceSessionId,
      input.workspaceId,
      operatorUserId,
      input.caseId ?? null,
    ],
  );

  if (!result.rows[0]) {
    throw Object.assign(new Error('Audience session not found'), { status: 404 });
  }

  if (input.caseId) {
    await pool.query(
      `UPDATE concierge_support_cases SET
         assignee_user_id = $3,
         status = CASE WHEN status = 'open' THEN 'pending_operator' ELSE status END,
         updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2`,
      [input.caseId, input.workspaceId, operatorUserId],
    );
    await pool.query(
      `INSERT INTO concierge_support_case_events (
         case_id, workspace_id, event_type, actor_type, actor_id, detail
       ) VALUES ($1,$2,'operator_takeover','operator',$3,'Operator took over the conversation')`,
      [input.caseId, input.workspaceId, operatorUserId],
    );
  }

  appendSecurityAudit({
    category: 'auth',
    action: 'concierge_operator_takeover',
    detail: 'Operator took over audience session',
    metadata: {
      workspaceId: input.workspaceId,
      audienceSessionId: input.audienceSessionId,
      operatorUserId,
      caseId: input.caseId ?? null,
    },
  });

  return {
    audienceSessionId: input.audienceSessionId,
    status: 'handed_off',
    supportCase: null,
    operatorUserId,
  };
}

export async function releaseToAiva(input: {
  workspaceId: string;
  audienceSessionId: string;
  operatorUserId?: string | null;
  caseId?: string | null;
  note?: string | null;
}): Promise<HandoffResult> {
  const result = await pool.query(
    `UPDATE audience_sessions SET
       status = 'active',
       operator_user_id = NULL,
       updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2
     RETURNING id, status, operator_user_id, active_support_case_id`,
    [input.audienceSessionId, input.workspaceId],
  );

  if (!result.rows[0]) {
    throw Object.assign(new Error('Audience session not found'), { status: 404 });
  }

  const caseId =
    input.caseId
    ?? (result.rows[0].active_support_case_id != null
      ? String(result.rows[0].active_support_case_id)
      : null);

  if (caseId) {
    await pool.query(
      `INSERT INTO concierge_support_case_events (
         case_id, workspace_id, event_type, actor_type, actor_id, detail
       ) VALUES ($1,$2,'released_to_aiva','operator',$3,$4)`,
      [
        caseId,
        input.workspaceId,
        input.operatorUserId ?? null,
        input.note?.trim() || 'Released back to Aiva',
      ],
    );
  }

  appendSecurityAudit({
    category: 'auth',
    action: 'concierge_release_to_aiva',
    detail: 'Audience session released back to Aiva',
    metadata: {
      workspaceId: input.workspaceId,
      audienceSessionId: input.audienceSessionId,
      caseId,
      operatorUserId: input.operatorUserId ?? null,
    },
  });

  return {
    audienceSessionId: input.audienceSessionId,
    status: 'active',
    supportCase: null,
    operatorUserId: null,
  };
}

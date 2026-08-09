/**
 * Narrow visitor identity upsert for Customer Concierge (Prompt 701).
 * Does not list CRM records or mutate workspace contacts broadly.
 */
import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import {
  convertAudienceIdentityToKnown,
  getAudienceSessionByWidgetToken,
} from '../customer-concierge/audience-session.js';
import { pool } from '../memory/db.js';

export function createAudienceContactUpsertTool(sessionId: string): Tool {
  return {
    name: 'audience-contact-upsert',
    description:
      'Save or update the current visitor email/name on this audience session. '
      + 'Use when the visitor shares contact details. Does not list or search CRM.',
    parameters: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Visitor email address' },
        displayName: { type: 'string', description: 'Optional display name' },
      },
      required: ['email'],
    },
    execute: async (args: Record<string, unknown>) => {
      const ctx = getWorkerSessionContext(sessionId);
      if (!ctx?.audiencePrincipal || !ctx.audienceSessionId) {
        return { success: false, error: 'Audience session required' };
      }
      const email = String(args.email ?? '').trim();
      const displayName = args.displayName != null ? String(args.displayName).trim() : null;
      if (!email.includes('@')) {
        return { success: false, error: 'Valid email is required' };
      }

      const sessionRow = await pool.query(
        `SELECT identity_id, widget_session_token FROM audience_sessions
         WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
        [ctx.audienceSessionId, ctx.worker.workspaceId],
      );
      if (!sessionRow.rows[0]) {
        return { success: false, error: 'Audience session not found' };
      }
      const identityId = String(sessionRow.rows[0].identity_id);
      const identity = await convertAudienceIdentityToKnown({
        workspaceId: ctx.worker.workspaceId,
        identityId,
        email,
        displayName,
      });

      // Preserve one conversation: keep widget contact_id and audience session linked.
      const token = sessionRow.rows[0].widget_session_token
        ? String(sessionRow.rows[0].widget_session_token)
        : null;
      if (token) {
        await getAudienceSessionByWidgetToken(token).catch(() => null);
      }

      return {
        success: true,
        identityId: identity.id,
        email: identity.email,
        displayName: identity.displayName,
        note: 'Visitor identity updated; conversation history is unchanged.',
      };
    },
  };
}

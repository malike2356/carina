/**
 * Deny-by-default Customer Concierge tool policy (Prompt 701).
 * Authorization is enforced at tool execution, not only in prompts.
 */
export const CUSTOMER_CONCIERGE_ALLOWED_TOOLS: ReadonlySet<string> = new Set([
  // Clarification / safe utilities
  'clarify',
  'list_live_capabilities',

  // Meeting types + availability + booking lifecycle (viCal)
  'vical-event-types-list',
  'vical-slots-offer',
  'vical-booking-create',
  'vical-booking-get',
  'vical-booking-cancel',
  'vical-booking-reschedule',

  // Outreach booking aliases that call the same engine (read/confirm only)
  'outreach-booking-offer-slots',
  'outreach-booking-confirm',
  'outreach-booking-cancel',
  'outreach-booking-reschedule',

  // Narrow visitor identity upsert (Prompt 701)
  'audience-contact-upsert',

  // Support / handoff placeholders for Prompt 702 (allowed ahead of implementation)
  'support-case-create',
  'handoff-request',
  'concierge-support-case-create',
  'concierge-handoff-request',
]);

/** Explicit high-risk denials (defense in depth; deny-by-default already blocks these). */
export const CUSTOMER_CONCIERGE_BLOCKED_TOOLS: ReadonlySet<string> = new Set([
  'shell-exec',
  'process',
  'file-write',
  'file-delete',
  'file-read',
  'http-request',
  'memory',
  'session-search',
  'worker-memory',
  'worker-conversation-search',
  'cronjob',
  'worker-automation',
  'agent-sync',
  'github-agent-sync',
  'send-message',
  'gmail-send',
  'workspace-worker-update',
  'workspace-worker-pause',
  'workspace-approval-approve',
  'workspace-schedule-create',
  'workspace-document-create',
  'vical-booking-config-update',
  'outreach-booking-config-update',
  'outreach-leads-list',
  'outreach-leads-search',
  'propreneur-self-configure',
]);

export function isCustomerConciergeToolAllowed(toolName: string): boolean {
  const name = toolName.trim();
  if (!name) return false;
  if (CUSTOMER_CONCIERGE_BLOCKED_TOOLS.has(name)) return false;
  if (CUSTOMER_CONCIERGE_ALLOWED_TOOLS.has(name)) return true;
  // Prefix denials for workspace / admin / billing surfaces
  if (
    name.startsWith('workspace-')
    || name.startsWith('propreneur')
    || name.startsWith('billing')
    || name.startsWith('vault')
    || name.startsWith('shell')
    || name.startsWith('admin')
  ) {
    return false;
  }
  return false;
}

/**
 * Lightweight structural validators for Customer Concierge v1 fixtures (Prompt 700).
 * Prefer zod where shapes are reused at runtime; fixtures also assert mandatory tenant/actor fields.
 */
import { z } from 'zod';
import {
  CUSTOMER_CONCIERGE_CONTRACT_VERSION,
  type ConciergeEventEnvelope,
  type ConciergeReadinessReport,
  type ProviderCommand,
  type ProviderResult,
  type StateTransition,
} from './types.js';

const actorType = z.enum(['audience', 'operator', 'system', 'provider']);

export const eventEnvelopeSchema = z.object({
  contractVersion: z.literal(CUSTOMER_CONCIERGE_CONTRACT_VERSION),
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  occurredAt: z.string().min(1),
  workspaceId: z.string().min(1),
  conciergeId: z.string().min(1),
  correlationId: z.string().min(1),
  causationId: z.string().min(1),
  actorType,
  actorId: z.string().nullable().optional(),
  payload: z.record(z.string(), z.unknown()),
});

export const providerCommandSchema = z.object({
  contractVersion: z.literal(CUSTOMER_CONCIERGE_CONTRACT_VERSION),
  commandId: z.string().min(1),
  provider: z.enum(['google_calendar', 'microsoft_calendar', 'zoom', 'email', 'sms']),
  action: z.string().min(1),
  workspaceId: z.string().min(1),
  conciergeId: z.string().nullable().optional(),
  actorType,
  idempotencyKey: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const providerResultSchema = z.object({
  contractVersion: z.literal(CUSTOMER_CONCIERGE_CONTRACT_VERSION),
  commandId: z.string().min(1),
  provider: z.enum(['google_calendar', 'microsoft_calendar', 'zoom', 'email', 'sms']),
  workspaceId: z.string().min(1),
  actorType,
  ok: z.boolean(),
  status: z.enum([
    'succeeded',
    'failed',
    'retryable',
    'action_required',
    'not_configured',
    'duplicate',
  ]),
  providerResourceId: z.string().nullable().optional(),
  joinUrl: z.string().nullable().optional(),
  deliveryState: z
    .enum(['pending', 'sent', 'delivered', 'accepted', 'declined', 'failed', 'unknown'])
    .nullable()
    .optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});

export const stateTransitionSchema = z.object({
  contractVersion: z.literal(CUSTOMER_CONCIERGE_CONTRACT_VERSION),
  machine: z.enum(['booking', 'delivery', 'support_case', 'audience_session']),
  from: z.string().min(1),
  to: z.string().min(1),
  workspaceId: z.string().min(1),
  actorType,
  entityId: z.string().optional(),
  reason: z.string().nullable().optional(),
});

const featureStatusSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
  status: z.enum(['ready', 'not_configured', 'disconnected', 'error', 'disabled']),
  detail: z.string().nullable().optional(),
});

export const readinessReportSchema = z.object({
  contractVersion: z.literal(CUSTOMER_CONCIERGE_CONTRACT_VERSION),
  workspaceId: z.string().min(1),
  conciergeId: z.string().nullable(),
  ready: z.boolean(),
  features: z.object({
    publicConcierge: featureStatusSchema,
    zoom: featureStatusSchema,
    googleCalendar: featureStatusSchema,
    microsoftCalendar: featureStatusSchema,
    emailDelivery: featureStatusSchema,
    inboundWebhookReconciliation: featureStatusSchema,
  }),
  blockers: z.array(z.string()),
});

export const domainWrapperSchema = z.object({
  objectType: z.enum(['audience_identity', 'audience_session', 'booking', 'support_case']),
  object: z
    .object({
      workspaceId: z.string().min(1),
      actorType: actorType,
    })
    .passthrough(),
});

export function parseEventEnvelope(input: unknown): ConciergeEventEnvelope {
  return eventEnvelopeSchema.parse(input) as ConciergeEventEnvelope;
}

export function parseProviderCommand(input: unknown): ProviderCommand {
  return providerCommandSchema.parse(input) as ProviderCommand;
}

export function parseProviderResult(input: unknown): ProviderResult {
  return providerResultSchema.parse(input) as ProviderResult;
}

export function parseStateTransition(input: unknown): StateTransition {
  return stateTransitionSchema.parse(input) as StateTransition;
}

export function parseReadinessReport(input: unknown): ConciergeReadinessReport {
  return readinessReportSchema.parse(input) as ConciergeReadinessReport;
}

export function assertMandatoryTenantAndActor(value: {
  workspaceId?: unknown;
  actorType?: unknown;
}): void {
  if (typeof value.workspaceId !== 'string' || !value.workspaceId.trim()) {
    throw new Error('workspaceId (tenant id) is mandatory');
  }
  if (typeof value.actorType !== 'string' || !value.actorType.trim()) {
    throw new Error('actorType is mandatory');
  }
}

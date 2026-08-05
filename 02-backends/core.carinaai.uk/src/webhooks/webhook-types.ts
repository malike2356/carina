export const WEBHOOK_EVENTS = [
  'process.complete',
  'process.failure',
  'process.watch',
  'cron.complete',
  'kanban.move',
  'agent.turn.complete',
  'delegation.complete',
  'vical.booking.created',
  'vical.booking.confirmed',
  'vical.booking.cancelled',
  'vical.booking.rescheduled',
  'vical.booking.outcome',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

export interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string | null;
  active: boolean;
  name: string | null;
  description: string | null;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  disabledAt: Date | null;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string | null;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  httpStatus: number | null;
  attemptCount: number;
  maxAttempts: number;
  errorMessage: string | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  deliveredAt: Date | null;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

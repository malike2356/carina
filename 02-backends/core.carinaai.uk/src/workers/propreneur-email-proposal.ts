import type { Worker } from '../types/index.js';
import { resolvePropreneurBinding } from './worker-bridge-store.js';
import { isPropreneurBridgeEnabled, isPropreneurBridgeWritesEnabled } from './aiva-feature-flags.js';
import { getPortfolio, proposeFinancialLog } from '../bridges/propreneur-bridge.js';
import type { PropreneurWebhookPayload } from './propreneur-event-webhook.js';

function normalizeAddress(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function matchPropertyId(
  portfolio: Awaited<ReturnType<typeof getPortfolio>>,
  extracted: Record<string, unknown>,
): number | null {
  const directId = Number(extracted.property_id ?? 0);
  if (Number.isFinite(directId) && directId > 0) {
    return directId;
  }

  const address = normalizeAddress(extracted.address ?? extracted.address_line1);
  if (!address) return null;

  const match = portfolio.properties.find((p) => {
    const line = normalizeAddress(p.address_line1);
    return line !== '' && (line.includes(address) || address.includes(line));
  });

  return match?.id ?? null;
}

/**
 * Optional Phase 2 path: email_processed webhook may create a financial proposal (not a direct write).
 */
export async function maybeCreateProposalFromEmailEvent(
  worker: Worker,
  payload: PropreneurWebhookPayload,
): Promise<{ proposal_id?: number; skipped?: string } | null> {
  if (!isPropreneurBridgeEnabled() || !isPropreneurBridgeWritesEnabled()) {
    return { skipped: 'bridge_writes_disabled' };
  }

  if (payload.event !== 'email_processed') {
    return null;
  }

  const binding = resolvePropreneurBinding(worker);
  if (!binding) {
    return { skipped: 'worker_not_bound' };
  }

  const data = payload.data ?? {};
  const classification = String(data.classification ?? '');
  if (classification !== 'rent_statement') {
    return { skipped: 'classification_not_supported' };
  }

  const extracted = data.extracted_data;
  if (!extracted || typeof extracted !== 'object') {
    return { skipped: 'no_extracted_data' };
  }

  const record = extracted as Record<string, unknown>;
  const amount = Number(record.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { skipped: 'no_amount' };
  }

  const portfolio = await getPortfolio(binding);
  const propertyId = matchPropertyId(portfolio, record);
  if (propertyId === null) {
    return { skipped: 'property_not_matched' };
  }

  const reviewNotes = [
    'Auto-proposal from Propreneur email_processed webhook.',
    record.address || record.address_line1 ? `Address hint: ${String(record.address ?? record.address_line1)}` : null,
    'Low-confidence extractions require human approval.',
  ]
    .filter(Boolean)
    .join(' ');

  const idempotencyKey = `email-log-${String(data.log_id ?? payload.occurredAt ?? Date.now())}`;

  const result = await proposeFinancialLog(
    binding,
    {
      property_id: propertyId,
      amount,
      paid_date: record.date ? String(record.date) : undefined,
      notes: `From email: ${String(data.subject ?? 'rent statement')}`,
      review_notes: reviewNotes,
    },
    { sourceWorkerRef: worker.id, idempotencyKey },
  );

  return { proposal_id: result.proposal_id };
}

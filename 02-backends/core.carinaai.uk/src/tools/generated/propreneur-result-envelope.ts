/* Generated Propreneur result envelope (prompt 637). Do not hand-edit. */
export const PROPRENEUR_RESULT_ENVELOPE_SCHEMA = "propreneur_result_envelope.v1" as const;
export const PROPRENEUR_RESULT_ENVELOPE_VERSION = "1.0.0" as const;

export type PropreneurExecutionStatus =
  | 'planned'
  | 'awaiting_approval'
  | 'accepted'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'not_configured';

export type PropreneurResultEnvelope = {
  success: boolean;
  data: unknown;
  error: { code: string; message: string; retryable?: boolean } | null;
  status: PropreneurExecutionStatus;
  correlation_id: string;
  idempotency?: { key?: string; state?: string } | null;
  approval?: { state?: string; approval_id?: string; digest?: string } | null;
  audit_reference?: string | null;
  retry?: { safe?: boolean; guidance?: string } | null;
};

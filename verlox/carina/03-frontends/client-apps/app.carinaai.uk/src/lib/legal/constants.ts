export const LEGAL_DOCUMENT_TYPES = [
  'terms_of_service',
  'privacy_policy',
  'dpa',
  'msa',
  'refund_policy',
  'acceptable_use',
] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentType, string> = {
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  dpa: 'Data Processing Agreement',
  msa: 'Master Service Agreement',
  refund_policy: 'Refund and Cancellation Policy',
  acceptable_use: 'Acceptable Use Policy',
};

export const LEGAL_MARKDOWN_FILES: Record<LegalDocumentType, string> = {
  terms_of_service: 'terms-of-service.md',
  privacy_policy: 'privacy-policy.md',
  dpa: 'data-processing-agreement.md',
  msa: 'master-service-agreement.md',
  refund_policy: 'refund-policy.md',
  acceptable_use: 'acceptable-use-policy.md',
};

export const LEGAL_PUBLIC_SLUGS: Record<LegalDocumentType, string> = {
  terms_of_service: 'terms',
  privacy_policy: 'privacy',
  dpa: 'dpa',
  msa: 'msa',
  refund_policy: 'refunds',
  acceptable_use: 'acceptable-use',
};

export const LEGAL_SLUG_TO_TYPE: Record<string, LegalDocumentType> = {
  terms: 'terms_of_service',
  privacy: 'privacy_policy',
  dpa: 'dpa',
  msa: 'msa',
  refunds: 'refund_policy',
  'acceptable-use': 'acceptable_use',
};

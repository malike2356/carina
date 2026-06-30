export const LEGAL_DOCUMENT_TYPES = [
  'terms_of_service',
  'privacy_policy',
  'dpa',
] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentType, string> = {
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  dpa: 'Data Processing Agreement',
};

export const LEGAL_MARKDOWN_FILES: Record<LegalDocumentType, string> = {
  terms_of_service: 'TERMS_OF_SERVICE.md',
  privacy_policy: 'PRIVACY_POLICY.md',
  dpa: 'DATA_PROCESSING_AGREEMENT.md',
};

export const LEGAL_PUBLIC_SLUGS: Record<LegalDocumentType, string> = {
  terms_of_service: 'terms',
  privacy_policy: 'privacy',
  dpa: 'dpa',
};

export const LEGAL_SLUG_TO_TYPE: Record<string, LegalDocumentType> = {
  terms: 'terms_of_service',
  privacy: 'privacy_policy',
  dpa: 'dpa',
};

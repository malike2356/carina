import type { PolicyPackId } from '../security/policy-packs.js';

export type IndustryTemplateId =
  | 'uk-property'
  | 'legal-uk'
  | 'finance-uk'
  | 'healthcare-uk';

export interface IndustryEventMapping {
  scout_event_type: string;
  regulatory_category: string;
  regulation: string;
  article: string;
  retention_days: number;
  report_threshold: number;
  requires_human_review: boolean;
}

export interface IndustryTemplate {
  id: IndustryTemplateId;
  label: string;
  sector: string;
  regulations: string[];
  base_pack: PolicyPackId;
  event_mappings: IndustryEventMapping[];
  additional_blocked_tools: string[];
  required_audit_fields: string[];
  logging_retention_days: number;
  human_review_required_for: string[];
}

const ukPropertyTemplate: IndustryTemplate = {
  id: 'uk-property',
  label: 'UK Property & Estate Agency',
  sector: 'Property',
  regulations: [
    'Money Laundering Regulations 2017',
    'Estate Agents Act 1979',
    'RICS Professional Standards',
    'UK GDPR / Data Protection Act 2018',
    'Consumer Protection from Unfair Trading Regulations 2008',
  ],
  base_pack: 'regulated',
  event_mappings: [
    {
      scout_event_type: 'data_access',
      regulatory_category: 'Client identity verification',
      regulation: 'Money Laundering Regulations 2017',
      article: 'Regulation 19 - Customer due diligence',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'file_write',
      regulatory_category: 'Document creation or amendment',
      regulation: 'RICS Professional Standards',
      article: 'RICS Rules of Conduct - Record keeping',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'email_send',
      regulatory_category: 'Client communication',
      regulation: 'Consumer Protection from Unfair Trading Regulations 2008',
      article: 'Regulation 6 - Misleading actions',
      retention_days: 1825,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'http_request',
      regulatory_category: 'Third-party data transfer',
      regulation: 'UK GDPR',
      article: 'Article 44 - Transfers to third countries',
      retention_days: 365,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'policy_violation',
      regulatory_category: 'Potential AML flag',
      regulation: 'Money Laundering Regulations 2017',
      article: 'Regulation 21 - Ongoing monitoring',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: true,
    },
  ],
  additional_blocked_tools: ['shell-exec', 'terminal', 'system-command'],
  required_audit_fields: ['client_id', 'property_ref', 'agent_id'],
  logging_retention_days: 2555,
  human_review_required_for: ['email-send', 'file-delete', 'data-export'],
};

const legalUkTemplate: IndustryTemplate = {
  id: 'legal-uk',
  label: 'UK Legal Services',
  sector: 'Legal',
  regulations: [
    'Solicitors Regulation Authority (SRA) Standards and Regulations 2019',
    'Legal Services Act 2007',
    'Money Laundering Regulations 2017',
    'UK GDPR / Data Protection Act 2018',
    'Legal Aid, Sentencing and Punishment of Offenders Act 2012',
  ],
  base_pack: 'regulated',
  event_mappings: [
    {
      scout_event_type: 'data_access',
      regulatory_category: 'Client file access',
      regulation: 'SRA Standards and Regulations 2019',
      article: 'SRA Code of Conduct 6.3 - Confidentiality',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'file_read',
      regulatory_category: 'Privileged document access',
      regulation: 'Legal Services Act 2007',
      article: 'Section 190 - Legal professional privilege',
      retention_days: 3650,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'email_send',
      regulatory_category: 'Client communication - privilege risk',
      regulation: 'SRA Standards and Regulations 2019',
      article: 'SRA Code of Conduct 6.4 - Confidentiality duties',
      retention_days: 3650,
      report_threshold: 0,
      requires_human_review: true,
    },
    {
      scout_event_type: 'data_export',
      regulatory_category: 'Client data export',
      regulation: 'UK GDPR',
      article: 'Article 17 - Right to erasure',
      retention_days: 3650,
      report_threshold: 0,
      requires_human_review: true,
    },
    {
      scout_event_type: 'policy_violation',
      regulatory_category: 'SRA breach indicator',
      regulation: 'SRA Standards and Regulations 2019',
      article: 'SRA Principles - Principle 7 (trust)',
      retention_days: 3650,
      report_threshold: 0,
      requires_human_review: true,
    },
  ],
  additional_blocked_tools: ['shell-exec', 'terminal', 'system-command', 'database-direct'],
  required_audit_fields: ['matter_ref', 'client_id', 'fee_earner_id'],
  logging_retention_days: 3650,
  human_review_required_for: ['email-send', 'file-delete', 'data-export', 'http-request'],
};

const financeUkTemplate: IndustryTemplate = {
  id: 'finance-uk',
  label: 'UK Financial Services',
  sector: 'Finance',
  regulations: [
    'Financial Services and Markets Act 2000 (FSMA)',
    'FCA Consumer Duty (PS22/9)',
    'MiFID II / UK MiFIR',
    'Senior Managers and Certification Regime (SMCR)',
    'Money Laundering Regulations 2017',
    'UK GDPR / Data Protection Act 2018',
  ],
  base_pack: 'restrict',
  event_mappings: [
    {
      scout_event_type: 'tool_call',
      regulatory_category: 'Automated decision affecting customer',
      regulation: 'FCA Consumer Duty (PS22/9)',
      article: 'Outcome 4 - Consumer support',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'data_access',
      regulatory_category: 'Customer data processing',
      regulation: 'FCA Consumer Duty (PS22/9)',
      article: 'Outcome 2 - Products and services',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'http_request',
      regulatory_category: 'Third-party API call (outsourcing)',
      regulation: 'FSMA 2000 s.137A / FCA SYSC 8',
      article: 'SYSC 8.1.1 - Outsourcing requirements',
      retention_days: 2555,
      report_threshold: 10,
      requires_human_review: false,
    },
    {
      scout_event_type: 'email_send',
      regulatory_category: 'Financial promotion or advice',
      regulation: 'FSMA 2000 s.21 - Financial promotion',
      article: 'Section 21 - Restrictions on financial promotion',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: true,
    },
    {
      scout_event_type: 'policy_violation',
      regulatory_category: 'SMCR accountability trigger',
      regulation: 'Senior Managers and Certification Regime',
      article: 'SYSC 26 - Management responsibilities map',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: true,
    },
    {
      scout_event_type: 'anomaly',
      regulatory_category: 'Market abuse indicator',
      regulation: 'Market Abuse Regulation (UK MAR)',
      article: 'Article 16 - Suspicious transaction reporting',
      retention_days: 2555,
      report_threshold: 1,
      requires_human_review: true,
    },
  ],
  additional_blocked_tools: ['shell-exec', 'terminal', 'system-command', 'database-direct', 'file-delete'],
  required_audit_fields: ['customer_id', 'firm_ref', 'senior_manager_id'],
  logging_retention_days: 2555,
  human_review_required_for: ['email-send', 'data-export', 'payment-initiate', 'advice-generate'],
};

const healthcareUkTemplate: IndustryTemplate = {
  id: 'healthcare-uk',
  label: 'UK Health & Social Care',
  sector: 'Healthcare',
  regulations: [
    'NHS Data Security and Protection Toolkit (DSPT)',
    'Caldicott Principles (National Data Guardian)',
    'Care Quality Commission (CQC) Standards',
    'UK GDPR / Data Protection Act 2018',
    'Health and Social Care (Safety and Quality) Act 2015',
  ],
  base_pack: 'regulated',
  event_mappings: [
    {
      scout_event_type: 'data_access',
      regulatory_category: 'Patient data access',
      regulation: 'Caldicott Principles',
      article: 'Principle 1 - Justify the purpose',
      retention_days: 2920,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'file_read',
      regulatory_category: 'Medical record access',
      regulation: 'NHS DSPT - Standard 9',
      article: 'NHS DSPT Data Security Standard 9.1',
      retention_days: 2920,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'data_export',
      regulatory_category: 'Patient data transfer',
      regulation: 'UK GDPR / NHS DSPT',
      article: 'UK GDPR Article 44 + NHS DSPT Standard 7',
      retention_days: 2920,
      report_threshold: 0,
      requires_human_review: true,
    },
    {
      scout_event_type: 'policy_violation',
      regulatory_category: 'CQC notification trigger',
      regulation: 'Care Quality Commission (Registration) Regulations 2009',
      article: 'Regulation 18 - Notification of other incidents',
      retention_days: 2920,
      report_threshold: 0,
      requires_human_review: true,
    },
  ],
  additional_blocked_tools: ['shell-exec', 'terminal', 'database-direct'],
  required_audit_fields: ['patient_id_hash', 'clinician_id', 'care_setting'],
  logging_retention_days: 2920,
  human_review_required_for: ['data-export', 'email-send', 'file-delete'],
};

export const INDUSTRY_TEMPLATES: Record<IndustryTemplateId, IndustryTemplate> = {
  'uk-property': ukPropertyTemplate,
  'legal-uk': legalUkTemplate,
  'finance-uk': financeUkTemplate,
  'healthcare-uk': healthcareUkTemplate,
};

const VALID_TEMPLATE_IDS = new Set<string>(Object.keys(INDUSTRY_TEMPLATES));

export function isIndustryTemplateId(id: string): id is IndustryTemplateId {
  return VALID_TEMPLATE_IDS.has(id);
}

export function getIndustryTemplate(id: IndustryTemplateId): IndustryTemplate {
  return INDUSTRY_TEMPLATES[id];
}

export function listIndustryTemplates(): IndustryTemplate[] {
  return Object.values(INDUSTRY_TEMPLATES);
}

export function scoutEventTypeForEvaluation(toolName?: string, actionType?: string): string {
  if (toolName) {
    const normalized = toolName.replace(/-/g, '_');
    if (normalized === 'email_send' || toolName === 'email-send') return 'email_send';
    if (normalized === 'file_write' || toolName === 'file-write') return 'file_write';
    if (normalized === 'file_read' || toolName === 'file-read') return 'file_read';
    if (normalized === 'data_export' || toolName === 'data-export') return 'data_export';
    if (normalized === 'http_request' || toolName === 'http-request' || toolName === 'web-search') {
      return 'http_request';
    }
    if (normalized === 'data_access' || toolName === 'data-access') return 'data_access';
    return normalized;
  }
  switch (actionType) {
    case 'email': return 'email_send';
    case 'http': return 'http_request';
    case 'file_write': return 'file_write';
    case 'shell': return 'tool_call';
    case 'credential': return 'data_access';
    default: return actionType ?? 'tool_call';
  }
}

export function resolveEventMapping(
  templateId: IndustryTemplateId,
  eventType: string,
): IndustryEventMapping | null {
  const template = INDUSTRY_TEMPLATES[templateId];
  return template.event_mappings.find((m) => m.scout_event_type === eventType) ?? null;
}

export function requiresHumanReview(
  templateId: IndustryTemplateId,
  toolName: string,
): boolean {
  const template = INDUSTRY_TEMPLATES[templateId];
  return template.human_review_required_for.includes(toolName);
}

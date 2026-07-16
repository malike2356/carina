import type { AivaPaidTier } from '../billing/aiva-tier.js';
import type { RoleComplexity } from './tier-recommender.js';

export type ProvisionDomain =
  | 'customer_support'
  | 'sales_outreach'
  | 'property_management'
  | 'finance_admin'
  | 'calendar_management'
  | 'general_assistant';

export interface AnalysedRole {
  suggestedName: string;
  domain: ProvisionDomain;
  responsibilities: string[];
  requiredTools: string[];
  requiredSkills: string[];
  communicationChannels: string[];
  complexity: RoleComplexity;
  recommendedTier: AivaPaidTier;
  confidenceScore: number;
  roleTemplateId: string | null;
  roleDescription: string;
}

export interface RoleAnalysisLlmPayload {
  suggestedName: string;
  domain: ProvisionDomain;
  responsibilities: string[];
  requiredTools: string[];
  requiredSkills: string[];
  communicationChannels: string[];
  complexity: RoleComplexity;
  confidenceScore: number;
}

export const PROVISION_DOMAINS: ProvisionDomain[] = [
  'customer_support',
  'sales_outreach',
  'property_management',
  'finance_admin',
  'calendar_management',
  'general_assistant',
];

export const PROVISION_TOOLS = [
  'email-read',
  'email-send',
  'web-search',
  'web-extract',
  'file-read',
  'file-write',
  'spreadsheet-read',
  'spreadsheet-write',
  'calendar-read',
  'calendar-create',
  'slack-message',
  'whatsapp-message',
  'notion-read',
  'notion-write',
  'crm-read',
  'crm-write',
] as const;

export const PROVISION_SKILLS = [
  'faq-responses',
  'escalation-protocol',
  'tone-matching',
  'ticket-tracking',
  'lead-qualification',
  'follow-up-sequences',
  'property-valuation',
  'tenant-screening',
  'invoice-generation',
  'expense-tracking',
  'meeting-scheduling',
  'reminder-sequences',
] as const;

export const PROVISION_CHANNELS = [
  'email',
  'whatsapp',
  'web_chat',
  'slack',
] as const;

export const DOMAIN_ROLE_TEMPLATE_IDS: Record<ProvisionDomain, string | null> = {
  customer_support: 'customer-support',
  sales_outreach: 'outreach-coordinator',
  property_management: 'property-manager',
  finance_admin: 'financial-analyst',
  calendar_management: 'calendar-manager',
  general_assistant: null,
};

export function formatDomainLabel(domain: ProvisionDomain): string {
  return domain
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

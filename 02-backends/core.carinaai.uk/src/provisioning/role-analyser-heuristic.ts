import {
  complexityFromToolCount,
  recommendTier,
} from './tier-recommender.js';
import type { AnalysedRole, ProvisionDomain } from './role-analyser-types.js';
import { DOMAIN_ROLE_TEMPLATE_IDS } from './role-analyser-types.js';

const DOMAIN_KEYWORDS: Array<{ domain: ProvisionDomain; keywords: string[]; name: string }> = [
  {
    domain: 'customer_support',
    keywords: ['customer support', 'support email', 'help desk', 'ticket', 'faq', 'complaint', 'inbound query'],
    name: 'Customer Support Agent',
  },
  {
    domain: 'sales_outreach',
    keywords: ['sales', 'outreach', 'lead', 'prospect', 'discovery call', 'qualify', 'pipeline'],
    name: 'Sales Outreach Agent',
  },
  {
    domain: 'property_management',
    keywords: ['property', 'tenant', 'landlord', 'rent', 'maintenance', 'viewing', 'lease', 'hmo'],
    name: 'Property Manager',
  },
  {
    domain: 'finance_admin',
    keywords: ['invoice', 'expense', 'finance', 'accounting', 'bookkeeping', 'payroll', 'vat', 'receipt'],
    name: 'Finance Admin',
  },
  {
    domain: 'calendar_management',
    keywords: ['calendar', 'schedule', 'meeting', 'appointment', 'booking', 'reminder', 'diary'],
    name: 'Calendar Assistant',
  },
];

const TOOL_KEYWORDS: Array<{ tool: string; keywords: string[] }> = [
  { tool: 'email-read', keywords: ['email', 'inbox', 'mail'] },
  { tool: 'email-send', keywords: ['reply', 'respond', 'send email', 'outreach'] },
  { tool: 'web-search', keywords: ['research', 'look up', 'search', 'find information'] },
  { tool: 'web-extract', keywords: ['scrape', 'extract', 'website', 'web page'] },
  { tool: 'file-read', keywords: ['document', 'pdf', 'file', 'attachment'] },
  { tool: 'file-write', keywords: ['draft', 'write document', 'create file'] },
  { tool: 'spreadsheet-read', keywords: ['spreadsheet', 'excel', 'sheet', 'csv'] },
  { tool: 'spreadsheet-write', keywords: ['track', 'log', 'update spreadsheet', 'spreadsheet'] },
  { tool: 'calendar-read', keywords: ['calendar', 'availability', 'schedule'] },
  { tool: 'calendar-create', keywords: ['book', 'schedule meeting', 'appointment', 'booking'] },
  { tool: 'slack-message', keywords: ['slack'] },
  { tool: 'whatsapp-message', keywords: ['whatsapp', 'whats app'] },
  { tool: 'notion-read', keywords: ['notion'] },
  { tool: 'notion-write', keywords: ['notion page', 'update notion'] },
  { tool: 'crm-read', keywords: ['crm', 'pipeline', 'contact record'] },
  { tool: 'crm-write', keywords: ['update crm', 'log lead', 'crm entry'] },
];

const DOMAIN_SKILLS: Record<ProvisionDomain, string[]> = {
  customer_support: ['faq-responses', 'escalation-protocol', 'tone-matching', 'ticket-tracking'],
  sales_outreach: ['lead-qualification', 'follow-up-sequences', 'tone-matching', 'escalation-protocol'],
  property_management: ['tenant-screening', 'escalation-protocol', 'tone-matching', 'reminder-sequences'],
  finance_admin: ['invoice-generation', 'expense-tracking', 'escalation-protocol'],
  calendar_management: ['meeting-scheduling', 'reminder-sequences', 'tone-matching'],
  general_assistant: ['tone-matching', 'escalation-protocol'],
};

const DOMAIN_CHANNELS: Record<ProvisionDomain, string[]> = {
  customer_support: ['email', 'web_chat'],
  sales_outreach: ['email'],
  property_management: ['whatsapp', 'email'],
  finance_admin: ['email', 'slack'],
  calendar_management: ['email', 'slack'],
  general_assistant: ['email'],
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function countKeywordHits(text: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => (text.includes(keyword) ? count + 1 : count), 0);
}

function detectDomain(text: string): {
  domain: ProvisionDomain;
  suggestedName: string;
  score: number;
} {
  let best = {
    domain: 'general_assistant' as ProvisionDomain,
    suggestedName: 'AI Assistant',
    score: 0,
  };

  for (const row of DOMAIN_KEYWORDS) {
    const score = countKeywordHits(text, row.keywords);
    if (score > best.score) {
      best = {
        domain: row.domain,
        suggestedName: row.name,
        score,
      };
    }
  }

  return best;
}

function detectTools(text: string): string[] {
  const tools = new Set<string>();
  for (const row of TOOL_KEYWORDS) {
    if (countKeywordHits(text, row.keywords) > 0) {
      tools.add(row.tool);
    }
  }
  if (tools.size === 0) {
    tools.add('email-read');
    tools.add('email-send');
  }
  return [...tools];
}

function detectChannels(text: string, domain: ProvisionDomain): string[] {
  const channels = new Set<string>(DOMAIN_CHANNELS[domain]);
  if (text.includes('whatsapp')) channels.add('whatsapp');
  if (text.includes('slack')) channels.add('slack');
  if (text.includes('web chat') || text.includes('live chat') || text.includes('chat widget')) {
    channels.add('web_chat');
  }
  return [...channels];
}

function deriveResponsibilities(description: string, domain: ProvisionDomain): string[] {
  const sentences = description
    .split(/[.!?\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12)
    .slice(0, 4);

  if (sentences.length > 0) return sentences;

  const defaults: Record<ProvisionDomain, string[]> = {
    customer_support: ['Answer common customer questions', 'Escalate complex issues to your team'],
    sales_outreach: ['Qualify inbound leads', 'Book discovery calls'],
    property_management: ['Handle tenant enquiries', 'Log maintenance requests'],
    finance_admin: ['Process invoices and expenses', 'Flag anomalies for review'],
    calendar_management: ['Manage scheduling requests', 'Send confirmations and reminders'],
    general_assistant: ['Handle routine tasks described by the owner', 'Escalate when unsure'],
  };
  return defaults[domain];
}

function deriveConfidence(domainScore: number, toolCount: number, descriptionLength: number): number {
  let score = 0.55;
  if (domainScore > 0) score += 0.2;
  if (domainScore > 1) score += 0.1;
  if (toolCount >= 2) score += 0.05;
  if (descriptionLength > 80) score += 0.05;
  if (descriptionLength > 180) score += 0.05;
  return Math.min(0.98, Math.round(score * 100) / 100);
}

export function analyseRoleDescriptionHeuristic(rawDescription: string): AnalysedRole {
  const roleDescription = rawDescription.trim();
  const text = normalizeText(roleDescription);
  const detected = detectDomain(text);
  const requiredTools = detectTools(text);
  const complexity = complexityFromToolCount(requiredTools.length);
  const recommendedTier = recommendTier(complexity, detected.domain);
  const communicationChannels = detectChannels(text, detected.domain);
  const requiredSkills = DOMAIN_SKILLS[detected.domain];
  const responsibilities = deriveResponsibilities(roleDescription, detected.domain);

  return {
    suggestedName: detected.suggestedName,
    domain: detected.domain,
    responsibilities,
    requiredTools,
    requiredSkills,
    communicationChannels,
    complexity,
    recommendedTier,
    confidenceScore: deriveConfidence(detected.score, requiredTools.length, roleDescription.length),
    roleTemplateId: DOMAIN_ROLE_TEMPLATE_IDS[detected.domain],
    roleDescription,
  };
}

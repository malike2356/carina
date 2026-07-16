import type { AivaPaidTier } from '../billing/aiva-tier.js';
import {
  complexityFromToolCount,
  recommendTier,
  type MarketplaceDomain,
} from '../provisioning/tier-recommender.js';

export type ScoutPolicySummary = {
  sandbox: { mode: string };
  egress: { mode: string; scanOutbound: boolean };
  tools: { dangerousRequireConfirmation: string[] };
  governance: { autoResponseTier: string };
};

export type AgentMarketplaceTemplate = {
  templateId: string;
  roleTemplateId: string;
  name: string;
  domain: MarketplaceDomain;
  icon: string;
  tagline: string;
  description: string;
  features: string[];
  tools: string[];
  skills: string[];
  tier: AivaPaidTier;
  setupTimeSeconds: number;
  useCaseExample: string;
  requiredIntegrations: string[];
  scoutPolicy: ScoutPolicySummary;
  greeting: string;
};

function tierForTemplate(domain: MarketplaceDomain, tools: string[]): AivaPaidTier {
  return recommendTier(complexityFromToolCount(tools.length), domain);
}

const TEMPLATES: Record<string, AgentMarketplaceTemplate> = {
  'property-manager': {
    templateId: 'property-manager',
    roleTemplateId: 'property-manager',
    name: 'Property Manager',
    domain: 'property_management',
    icon: 'building',
    tagline: 'Tenant enquiries, maintenance, viewings, rent; handled.',
    description:
      'AI worker for UK property professionals. Handles daily admin: tenant questions, maintenance coordination, viewing scheduling, rent chase-ups. Knows UK housing regulations.',
    features: [
      'Replies to tenant enquiries 24/7',
      'Logs maintenance requests',
      'Coordinates with contractors',
      'Manages viewing calendar',
      'Sends rent reminders',
      'UK housing regulation aware',
    ],
    tools: ['email-read', 'email-send', 'calendar-read', 'calendar-create', 'file-read', 'spreadsheet-write', 'web-search'],
    skills: [
      'tenant-communication',
      'maintenance-triage',
      'viewing-scheduling',
      'rent-collection-reminders',
      'uk-housing-regulations',
      'contractor-coordination',
      'tone-matching',
      'escalation-protocol',
    ],
    tier: tierForTemplate('property_management', [
      'email-read',
      'email-send',
      'calendar-read',
      'calendar-create',
      'file-read',
      'spreadsheet-write',
      'web-search',
    ]),
    setupTimeSeconds: 45,
    useCaseExample:
      'Sarah manages 45 properties across Manchester. Her AI worker handles 80% of tenant enquiries, saving 15 hours/week.',
    requiredIntegrations: [],
    scoutPolicy: {
      sandbox: { mode: 'session_only' },
      egress: { mode: 'allowlist', scanOutbound: false },
      tools: { dangerousRequireConfirmation: ['email-send'] },
      governance: { autoResponseTier: 'high' },
    },
    greeting:
      "Hello! I'm your AI Property Manager. I'm here to handle the daily admin: tenant enquiries, maintenance, viewings, and rent.",
  },
  'support-agent': {
    templateId: 'support-agent',
    roleTemplateId: 'customer-support',
    name: 'Support Agent',
    domain: 'customer_support',
    icon: 'headphones',
    tagline: 'Customer emails, FAQs, escalations. Friendly, always on.',
    description:
      'Handles customer support emails. Replies to common questions using your knowledge base, escalates complex issues, tracks everything.',
    features: [
      'Replies to support emails 24/7',
      'Answers FAQs from your knowledge base',
      'Escalates complex issues to you',
      'Tracks tickets in spreadsheet',
      'Learns your product over time',
    ],
    tools: ['email-read', 'email-send', 'web-search', 'spreadsheet-write'],
    skills: ['faq-responses', 'escalation-protocol', 'tone-matching', 'ticket-tracking'],
    tier: tierForTemplate('customer_support', ['email-read', 'email-send', 'web-search', 'spreadsheet-write']),
    setupTimeSeconds: 45,
    useCaseExample:
      'Tom runs a SaaS with 200 customers. His Support Agent handles 70% of support emails automatically.',
    requiredIntegrations: [],
    scoutPolicy: {
      sandbox: { mode: 'session_only' },
      egress: { mode: 'allowlist', scanOutbound: false },
      tools: { dangerousRequireConfirmation: ['email-send'] },
      governance: { autoResponseTier: 'high' },
    },
    greeting:
      "Hello! I'm your Support Agent. I handle customer emails so you can focus on everything else.",
  },
  'outreach-specialist': {
    templateId: 'outreach-specialist',
    roleTemplateId: 'outreach-coordinator',
    name: 'Outreach Specialist',
    domain: 'sales_outreach',
    icon: 'mail',
    tagline: 'Lead qualification, follow-up sequences, pipeline tracking.',
    description:
      'Qualifies inbound leads, sends personalised follow-up sequences, tracks pipeline in your CRM. Persuasive but never pushy.',
    features: [
      'Qualifies inbound leads automatically',
      'Sends personalised follow-up sequences',
      'Tracks pipeline in spreadsheet or CRM',
      'Schedules calls for qualified leads',
      'Reports conversion metrics',
    ],
    tools: ['email-read', 'email-send', 'web-search', 'spreadsheet-write', 'crm-read', 'crm-write'],
    skills: ['lead-qualification', 'follow-up-sequences', 'tone-matching', 'escalation-protocol'],
    tier: tierForTemplate('sales_outreach', [
      'email-read',
      'email-send',
      'web-search',
      'spreadsheet-write',
      'crm-read',
      'crm-write',
    ]),
    setupTimeSeconds: 45,
    useCaseExample:
      'Lisa runs a marketing agency. Her Outreach Specialist qualifies 50+ inbound leads/week and books qualified calls.',
    requiredIntegrations: [],
    scoutPolicy: {
      sandbox: { mode: 'session_only' },
      egress: { mode: 'allowlist', scanOutbound: true },
      tools: { dangerousRequireConfirmation: ['email-send', 'crm-write'] },
      governance: { autoResponseTier: 'critical' },
    },
    greeting:
      "Hello! I'm your Outreach Specialist. I qualify leads and handle follow-ups so you can focus on closing.",
  },
  'finance-admin': {
    templateId: 'finance-admin',
    roleTemplateId: 'financial-analyst',
    name: 'Finance Admin',
    domain: 'finance_admin',
    icon: 'receipt',
    tagline: 'Invoices, expenses, payment reminders. Precise and compliance-aware.',
    description:
      'Generates invoices, tracks expenses, sends payment reminders. Finance domain requires Business tier for compliance sensitivity.',
    features: [
      'Generates and sends invoices',
      'Tracks expenses and categorises',
      'Sends payment reminders',
      'Reconciles against bank feeds',
      'Prepares monthly summaries',
    ],
    tools: ['email-read', 'email-send', 'file-read', 'spreadsheet-read', 'spreadsheet-write'],
    skills: ['invoice-generation', 'expense-tracking', 'tone-matching', 'escalation-protocol'],
    tier: tierForTemplate('finance_admin', [
      'email-read',
      'email-send',
      'file-read',
      'spreadsheet-read',
      'spreadsheet-write',
    ]),
    setupTimeSeconds: 45,
    useCaseExample:
      'David runs a consultancy with 30 clients. His Finance Admin reduces admin from 8 hours/week to 30 minutes.',
    requiredIntegrations: [],
    scoutPolicy: {
      sandbox: { mode: 'docker' },
      egress: { mode: 'allowlist', scanOutbound: true },
      tools: { dangerousRequireConfirmation: ['email-send', 'file-write', 'spreadsheet-write'] },
      governance: { autoResponseTier: 'critical' },
    },
    greeting:
      "Hello! I'm your Finance Admin. I handle invoicing, expenses, and reminders with precision and discretion.",
  },
  'calendar-assistant': {
    templateId: 'calendar-assistant',
    roleTemplateId: 'calendar-manager',
    name: 'Calendar Assistant',
    domain: 'calendar_management',
    icon: 'calendar',
    tagline: 'Scheduling, meetings, reminders. Never double-books.',
    description:
      'Manages your calendar. Schedules meetings, sends invites, handles rescheduling, sends reminders.',
    features: [
      'Schedules meetings and sends invites',
      'Handles rescheduling automatically',
      'Sends reminders before meetings',
      'Manages time zone differences',
      'Blocks focus time proactively',
    ],
    tools: ['email-read', 'email-send', 'calendar-read', 'calendar-create'],
    skills: ['meeting-scheduling', 'reminder-sequences', 'tone-matching', 'escalation-protocol'],
    tier: tierForTemplate('calendar_management', ['email-read', 'email-send', 'calendar-read', 'calendar-create']),
    setupTimeSeconds: 45,
    useCaseExample:
      'Emma is a consultant with 20+ meetings/week. Her Calendar Assistant handles all scheduling with no double-books.',
    requiredIntegrations: [],
    scoutPolicy: {
      sandbox: { mode: 'session_only' },
      egress: { mode: 'allowlist', scanOutbound: false },
      tools: { dangerousRequireConfirmation: [] },
      governance: { autoResponseTier: 'high' },
    },
    greeting:
      "Hello! I'm your Calendar Assistant. I'll handle your scheduling so you never have to play email tennis again.",
  },
};

export function listMarketplaceTemplates(): AgentMarketplaceTemplate[] {
  return Object.values(TEMPLATES);
}

export function getMarketplaceTemplate(templateId: string): AgentMarketplaceTemplate | undefined {
  return TEMPLATES[templateId];
}

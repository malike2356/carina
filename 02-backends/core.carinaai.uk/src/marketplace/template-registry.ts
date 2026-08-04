import type { AivaPaidTier } from '../billing/aiva-tier.js';
import {
  complexityFromToolCount,
  recommendTier,
  type MarketplaceDomain,
} from '../provisioning/tier-recommender.js';
import { ROLE_TEMPLATES, type WorkerRoleTemplate } from '../workers/role-templates.js';

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
  groupId: MarketplaceGroupId;
  groupLabel: string;
};

type MarketplaceGroupId =
  | 'featured'
  | 'customer-sales'
  | 'admin-ops'
  | 'finance-legal'
  | 'marketing-content'
  | 'people-talent'
  | 'healthcare'
  | 'property-field'
  | 'specialist';

type GroupMeta = {
  id: MarketplaceGroupId;
  label: string;
  description: string;
  domain: MarketplaceDomain;
  icon: string;
  templateIds: string[];
};

const MARKETPLACE_GROUPS: GroupMeta[] = [
  {
    id: 'featured',
    label: 'Popular',
    description: 'Roles most teams start with.',
    domain: 'customer_support',
    icon: 'sparkles',
    templateIds: [
      'property-manager',
      'outreach-coordinator',
      'financial-analyst',
      'content-assistant',
      'calendar-manager',
      'customer-support',
    ],
  },
  {
    id: 'customer-sales',
    label: 'Customer and sales',
    description: 'Enquiries, leads, orders, and onboarding.',
    domain: 'sales_outreach',
    icon: 'mail',
    templateIds: [
      'email-handler',
      'sales-assistant',
      'client-onboarding-specialist',
      'ecommerce-order-support',
      'partnership-coordinator',
    ],
  },
  {
    id: 'admin-ops',
    label: 'Admin and operations',
    description: 'Diary, projects, documents, and automation.',
    domain: 'calendar_management',
    icon: 'calendar',
    templateIds: [
      'executive-assistant',
      'project-coordinator',
      'workspace-ops-admin',
      'automation-specialist',
      'event-coordinator',
      'travel-concierge',
      'structured-extractor',
    ],
  },
  {
    id: 'finance-legal',
    label: 'Finance and legal',
    description: 'Money, compliance, and intake.',
    domain: 'finance_admin',
    icon: 'receipt',
    templateIds: [
      'accounts-payable',
      'legal-intake-coordinator',
      'compliance-assistant',
      'mortgage-broker-assistant',
    ],
  },
  {
    id: 'marketing-content',
    label: 'Marketing and content',
    description: 'Drafting, social, campaigns, and research.',
    domain: 'sales_outreach',
    icon: 'megaphone',
    templateIds: [
      'content-assistant',
      'social-media-manager',
      'marketing-campaign-coordinator',
      'community-manager',
      'research-analyst',
      'field-monitor',
    ],
  },
  {
    id: 'people-talent',
    label: 'People and talent',
    description: 'Hiring, HR, and admissions.',
    domain: 'customer_support',
    icon: 'users',
    templateIds: [
      'recruitment-coordinator',
      'hr-benefits-coordinator',
      'admissions-officer',
    ],
  },
  {
    id: 'healthcare',
    label: 'Healthcare and wellbeing',
    description: 'Reception, care coordination, and coaching.',
    domain: 'customer_support',
    icon: 'heart',
    templateIds: [
      'healthcare-receptionist',
      'patient-care-coordinator',
      'personal-coach',
    ],
  },
  {
    id: 'property-field',
    label: 'Property and field',
    description: 'Property, hosting, and dispatch.',
    domain: 'property_management',
    icon: 'building',
    templateIds: [
      'property-manager',
      'restaurant-host',
      'field-service-dispatcher',
    ],
  },
  {
    id: 'specialist',
    label: 'Specialist',
    description: 'Niche roles that stay one click away.',
    domain: 'customer_support',
    icon: 'sparkles',
    templateIds: [
      'it-helpdesk',
      'grant-writer-assistant',
      'personal-assistant',
      'student-assistant',
    ],
  },
];

const GROUP_LOOKUP = new Map<string, GroupMeta>();
for (const group of MARKETPLACE_GROUPS) {
  for (const templateId of group.templateIds) {
    if (!GROUP_LOOKUP.has(templateId)) {
      GROUP_LOOKUP.set(templateId, group);
    }
  }
}

const MARKETPLACE_ALIASES: Record<string, string> = {
  'support-agent': 'customer-support',
  'outreach-specialist': 'outreach-coordinator',
  'finance-admin': 'financial-analyst',
  'calendar-assistant': 'calendar-manager',
};

const CURATED_OVERRIDES: Partial<Record<string, Partial<AgentMarketplaceTemplate>>> = {
  'property-manager': {
    tier: 'business',
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
    requiredIntegrations: [],
    scoutPolicy: {
      sandbox: { mode: 'session_only' },
      egress: { mode: 'allowlist', scanOutbound: false },
      tools: { dangerousRequireConfirmation: ['email-send'] },
      governance: { autoResponseTier: 'high' },
    },
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
    useCaseExample:
      'Sarah manages 45 properties across Manchester. Her AI worker handles 80 percent of tenant enquiries, saving 15 hours a week.',
    setupTimeSeconds: 45,
    greeting:
      "Hello! I'm your AI Property Manager. I'm here to handle the daily admin: tenant enquiries, maintenance, viewings, and rent.",
  },
  'customer-support': {
    tier: 'growth',
    tools: ['email-read', 'email-send', 'web-search', 'spreadsheet-write'],
    skills: ['faq-responses', 'escalation-protocol', 'tone-matching', 'ticket-tracking'],
    requiredIntegrations: [],
    scoutPolicy: {
      sandbox: { mode: 'session_only' },
      egress: { mode: 'allowlist', scanOutbound: false },
      tools: { dangerousRequireConfirmation: ['email-send'] },
      governance: { autoResponseTier: 'high' },
    },
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
    useCaseExample:
      'Tom runs a SaaS with 200 customers. His Support Agent handles 70 percent of support emails automatically.',
    setupTimeSeconds: 45,
    greeting:
      "Hello! I'm your Support Agent. I handle customer emails so you can focus on everything else.",
  },
  'outreach-coordinator': {
    tier: 'business',
    tools: ['email-read', 'email-send', 'web-search', 'spreadsheet-write', 'crm-read', 'crm-write'],
    skills: ['lead-qualification', 'follow-up-sequences', 'tone-matching', 'escalation-protocol'],
    requiredIntegrations: [],
    scoutPolicy: {
      sandbox: { mode: 'session_only' },
      egress: { mode: 'allowlist', scanOutbound: true },
      tools: { dangerousRequireConfirmation: ['email-send', 'crm-write'] },
      governance: { autoResponseTier: 'critical' },
    },
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
    useCaseExample:
      'Lisa runs a marketing agency. Her Outreach Specialist qualifies 50 plus inbound leads a week and books qualified calls.',
    setupTimeSeconds: 45,
    greeting:
      "Hello! I'm your Outreach Specialist. I qualify leads and handle follow-ups so you can focus on closing.",
  },
  'financial-analyst': {
    tier: 'business',
    tools: ['email-read', 'email-send', 'file-read', 'spreadsheet-read', 'spreadsheet-write'],
    skills: ['invoice-generation', 'expense-tracking', 'tone-matching', 'escalation-protocol'],
    requiredIntegrations: [],
    scoutPolicy: {
      sandbox: { mode: 'docker' },
      egress: { mode: 'allowlist', scanOutbound: true },
      tools: { dangerousRequireConfirmation: ['email-send', 'file-write', 'spreadsheet-write'] },
      governance: { autoResponseTier: 'critical' },
    },
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
    useCaseExample:
      'David runs a consultancy with 30 clients. His Finance Admin reduces admin from 8 hours a week to 30 minutes.',
    setupTimeSeconds: 45,
    greeting:
      "Hello! I'm your Finance Admin. I handle invoicing, expenses, and reminders with precision and discretion.",
  },
  'calendar-manager': {
    tier: 'growth',
    tools: ['email-read', 'email-send', 'calendar-read', 'calendar-create'],
    skills: ['meeting-scheduling', 'reminder-sequences', 'tone-matching', 'escalation-protocol'],
    requiredIntegrations: [],
    scoutPolicy: {
      sandbox: { mode: 'session_only' },
      egress: { mode: 'allowlist', scanOutbound: false },
      tools: { dangerousRequireConfirmation: [] },
      governance: { autoResponseTier: 'high' },
    },
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
    useCaseExample:
      'Emma is a consultant with 20 plus meetings a week. Her Calendar Assistant handles all scheduling with no double-books.',
    setupTimeSeconds: 45,
    greeting:
      "Hello! I'm your Calendar Assistant. I'll handle your scheduling so you never have to play email tennis again.",
  },
};

function groupForTemplate(templateId: string): GroupMeta {
  return (
    GROUP_LOOKUP.get(templateId)
    ?? MARKETPLACE_GROUPS.find((group) => group.id === 'specialist')!
  );
}

function tierForTemplate(group: GroupMeta, tools: string[]): AivaPaidTier {
  return recommendTier(complexityFromToolCount(tools.length), group.domain);
}

function defaultScoutPolicy(group: GroupMeta): ScoutPolicySummary {
  if (group.domain === 'finance_admin') {
    return {
      sandbox: { mode: 'docker' },
      egress: { mode: 'allowlist', scanOutbound: true },
      tools: { dangerousRequireConfirmation: ['email-send', 'file-write', 'spreadsheet-write'] },
      governance: { autoResponseTier: 'critical' },
    };
  }

  if (group.domain === 'property_management') {
    return {
      sandbox: { mode: 'session_only' },
      egress: { mode: 'allowlist', scanOutbound: false },
      tools: { dangerousRequireConfirmation: ['email-send'] },
      governance: { autoResponseTier: 'high' },
    };
  }

  if (group.domain === 'sales_outreach') {
    return {
      sandbox: { mode: 'session_only' },
      egress: { mode: 'allowlist', scanOutbound: true },
      tools: { dangerousRequireConfirmation: ['email-send', 'crm-write'] },
      governance: { autoResponseTier: 'critical' },
    };
  }

  return {
    sandbox: { mode: 'session_only' },
    egress: { mode: 'allowlist', scanOutbound: false },
    tools: { dangerousRequireConfirmation: ['email-send'] },
    governance: { autoResponseTier: 'high' },
  };
}

function buildGenericUseCase(role: WorkerRoleTemplate): string {
  return `A good fit when you need ${role.description.toLowerCase()}`;
}

function buildMarketplaceTemplate(role: WorkerRoleTemplate): AgentMarketplaceTemplate {
  const group = groupForTemplate(role.id);
  const features = role.personaBlocks.capabilities.slice(0, 5);
  const tools = role.defaultChannels.map((channel) => `${channel}-channel`);
  const tier = tierForTemplate(group, tools);

  const template: AgentMarketplaceTemplate = {
    templateId: role.id,
    roleTemplateId: role.id,
    name: role.name,
    domain: group.domain,
    icon: group.icon,
    tagline: role.description,
    description: role.description,
    features,
    tools,
    skills: role.skillPacks,
    tier,
    setupTimeSeconds: 60,
    useCaseExample: buildGenericUseCase(role),
    requiredIntegrations: [],
    scoutPolicy: defaultScoutPolicy(group),
    greeting: `Hello! I'm your ${role.name}. Tell me what you need help with.`,
    groupId: group.id,
    groupLabel: group.label,
  };

  return {
    ...template,
    ...(CURATED_OVERRIDES[role.id] ?? {}),
  };
}

export function listMarketplaceTemplates(): AgentMarketplaceTemplate[] {
  return ROLE_TEMPLATES.map((role) => buildMarketplaceTemplate(role));
}

export function getMarketplaceTemplate(templateId: string): AgentMarketplaceTemplate | undefined {
  const resolvedId = MARKETPLACE_ALIASES[templateId] ?? templateId;
  const role = ROLE_TEMPLATES.find((entry) => entry.id === resolvedId);
  if (!role) {
    return undefined;
  }
  return buildMarketplaceTemplate(role);
}

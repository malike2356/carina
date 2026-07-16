import {
  AIVA_FEATURED_TEMPLATE_IDS,
  AIVA_ROLE_TEMPLATE_CARDS,
  type AivaRoleTemplateCard,
} from '@/lib/aiva-role-templates';

export type AivaRoleGroupId =
  | 'featured'
  | 'customer-sales'
  | 'admin-ops'
  | 'finance-legal'
  | 'marketing-content'
  | 'people-talent'
  | 'healthcare'
  | 'property-field'
  | 'specialist';

export type AivaRoleGroup = {
  id: AivaRoleGroupId;
  title: string;
  description: string;
  templateIds: string[];
};

/**
 * Grouped role catalog. Hire stays quiet; full depth lives on /aiva/roles.
 * Popular is a curated shortlist. Other groups partition the full catalog
 * (each template appears in exactly one thematic group).
 */
export const AIVA_ROLE_GROUPS: AivaRoleGroup[] = [
  {
    id: 'featured',
    title: 'Popular',
    description: 'Roles most teams start with.',
    templateIds: [...AIVA_FEATURED_TEMPLATE_IDS],
  },
  {
    id: 'customer-sales',
    title: 'Customer and sales',
    description: 'Enquiries, leads, orders, and onboarding.',
    templateIds: [
      'customer-support',
      'outreach-coordinator',
      'email-handler',
      'sales-assistant',
      'client-onboarding-specialist',
      'ecommerce-order-support',
      'partnership-coordinator',
    ],
  },
  {
    id: 'admin-ops',
    title: 'Admin and operations',
    description: 'Diary, projects, documents, and automation.',
    templateIds: [
      'calendar-manager',
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
    title: 'Finance and legal',
    description: 'Money, compliance, and intake.',
    templateIds: [
      'financial-analyst',
      'accounts-payable',
      'legal-intake-coordinator',
      'compliance-assistant',
      'mortgage-broker-assistant',
    ],
  },
  {
    id: 'marketing-content',
    title: 'Marketing and content',
    description: 'Drafting, social, campaigns, and research.',
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
    title: 'People and talent',
    description: 'Hiring, HR, and admissions.',
    templateIds: [
      'recruitment-coordinator',
      'hr-benefits-coordinator',
      'admissions-officer',
    ],
  },
  {
    id: 'healthcare',
    title: 'Healthcare and wellbeing',
    description: 'Reception, care coordination, and coaching.',
    templateIds: [
      'healthcare-receptionist',
      'patient-care-coordinator',
      'personal-coach',
    ],
  },
  {
    id: 'property-field',
    title: 'Property and field',
    description: 'Property, hosting, and dispatch.',
    templateIds: [
      'property-manager',
      'restaurant-host',
      'field-service-dispatcher',
    ],
  },
  {
    id: 'specialist',
    title: 'Specialist',
    description: 'Niche roles that stay one click away.',
    templateIds: [
      'it-helpdesk',
      'grant-writer-assistant',
    ],
  },
];

export function cardsForGroup(group: AivaRoleGroup): AivaRoleTemplateCard[] {
  return group.templateIds
    .map((id) => AIVA_ROLE_TEMPLATE_CARDS.find((card) => card.templateId === id))
    .filter((card): card is AivaRoleTemplateCard => Boolean(card));
}

export function findRoleCard(templateId: string): AivaRoleTemplateCard | null {
  return AIVA_ROLE_TEMPLATE_CARDS.find((card) => card.templateId === templateId) ?? null;
}

/** Thematic groups only (excludes Popular shortlist duplicate view). */
export function thematicRoleGroups(): AivaRoleGroup[] {
  return AIVA_ROLE_GROUPS.filter((group) => group.id !== 'featured');
}

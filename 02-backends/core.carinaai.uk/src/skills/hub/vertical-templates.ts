export type VerticalId =
  | 'property'
  | 'legal'
  | 'finance'
  | 'recruitment'
  | 'healthcare'
  | 'support';

export type VerticalTemplate = {
  id: VerticalId;
  name: string;
  description: string;
  packs: string[];
  featured?: boolean;
};

export const VERTICAL_TEMPLATES: VerticalTemplate[] = [
  {
    id: 'property',
    name: 'Property',
    description: 'UK property workflows: lettings, compliance, and legal context.',
    packs: ['property-uk', 'legal-uk'],
    featured: true,
  },
  {
    id: 'legal',
    name: 'Legal',
    description: 'Contract review, tenancy law, and compliance checklists.',
    packs: ['legal-uk'],
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Cashflow, VAT, invoicing, and investment analysis.',
    packs: ['finance'],
    featured: true,
  },
  {
    id: 'recruitment',
    name: 'Recruitment',
    description: 'Pipeline review, candidate follow-up, and CRM cadences.',
    packs: ['sales-crm', 'productivity'],
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'Clinical notes, scheduling, medications, and compliance.',
    packs: ['healthcare'],
    featured: true,
  },
  {
    id: 'support',
    name: 'Support',
    description: 'Operator triage, inbox workflows, and daily utilities.',
    packs: ['operator-daily', 'capabilities-ops', 'email-extended'],
  },
];

export function getVerticalTemplate(id: string): VerticalTemplate | undefined {
  return VERTICAL_TEMPLATES.find((template) => template.id === id);
}

export function packsForVerticalTemplate(id: string): string[] {
  return getVerticalTemplate(id)?.packs ?? [];
}

export function mergeTemplatePacks(current: string[], templateId: string): string[] {
  const next = new Set(current);
  for (const pack of packsForVerticalTemplate(templateId)) {
    next.add(pack);
  }
  return [...next].sort();
}

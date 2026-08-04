import { AIVA_ROLE_TEMPLATE_CARDS } from '@/lib/aiva-role-templates';

export type AivaHireCandidate = {
  id: string;
  templateId: string;
  name: string;
  bio: string;
  location: string;
};

const CANDIDATE_POOL: Omit<AivaHireCandidate, 'templateId'>[] = [
  {
    id: 'aria',
    name: 'Aria Chen',
    bio: 'Warm and precise. She turns vague requests into clear next steps without making anyone feel rushed.',
    location: 'United Kingdom',
  },
  {
    id: 'ethan',
    name: 'Ethan Thomson',
    bio: 'Calm under pressure. He asks one sharp question at a time until the real problem is obvious.',
    location: 'United Kingdom',
  },
  {
    id: 'lucas',
    name: 'Lucas Harrison',
    bio: 'Direct but polite. He keeps nudging until the numbers line up and the goalpost moves forward.',
    location: 'United Kingdom',
  },
  {
    id: 'maya',
    name: 'Maya Okonkwo',
    bio: 'Friendly and thorough. She remembers context, follows up, and never lets a thread go cold.',
    location: 'United Kingdom',
  },
  {
    id: 'sam',
    name: 'Sam Rivera',
    bio: 'Quietly efficient. Short replies, fast triage, and clean handoffs when a human should step in.',
    location: 'United Kingdom',
  },
  {
    id: 'dana',
    name: 'Dana Brooks',
    bio: 'Organised to a fault. She spots scheduling conflicts before they become your problem.',
    location: 'United Kingdom',
  },
  {
    id: 'leo',
    name: 'Leo Park',
    bio: 'Creative but structured. Drafts first, asks for feedback second, and keeps brand voice consistent.',
    location: 'United Kingdom',
  },
  {
    id: 'nina',
    name: 'Nina Patel',
    bio: 'Patient with detail. She explains finance in plain English and flags what needs your eyes.',
    location: 'United Kingdom',
  },
];

function candidatesForTemplate(templateId: string): AivaHireCandidate[] {
  const template = AIVA_ROLE_TEMPLATE_CARDS.find((card) => card.templateId === templateId);
  const roleLabel = template?.roleName ?? 'Worker';
  return CANDIDATE_POOL.map((entry, index) => ({
    ...entry,
    templateId,
    id: `${templateId}-${entry.id}`,
    name: index === 0 ? defaultNameForRole(templateId) : entry.name,
    bio: personalizeBio(entry.bio, roleLabel),
  }));
}

function defaultNameForRole(templateId: string): string {
  const defaults: Record<string, string> = {
    'customer-support': 'Aria',
    'outreach-coordinator': 'Alex',
    'property-manager': 'Mia',
    'financial-analyst': 'Sam',
    'content-assistant': 'Leo',
    'calendar-manager': 'Dana',
  };
  return defaults[templateId] ?? 'Aiva';
}

function personalizeBio(bio: string, roleLabel: string): string {
  return `${bio} Built for ${roleLabel.toLowerCase()} work from day one.`;
}

export function listRoleTemplatesForHire() {
  return AIVA_ROLE_TEMPLATE_CARDS.map((card) => ({
    templateId: card.templateId,
    label: card.roleName,
    description: card.roleDescription.split('.')[0] ?? card.roleDescription,
    tagline: card.exampleQ ? card.exampleQ.replace(/^"|"$/g, '') : card.roleDescription,
    icon: card.icon,
    defaultChannels: card.defaultChannels,
    roleDescription: card.roleDescription,
    exampleQ: card.exampleQ,
    exampleA: card.exampleA,
  }));
}

export function listCandidatesForTemplate(templateId: string): AivaHireCandidate[] {
  return candidatesForTemplate(templateId);
}

export function listCandidateBatch(
  templateId: string,
  batchIndex: number,
  batchSize = 3,
): AivaHireCandidate[] {
  const all = candidatesForTemplate(templateId);
  if (all.length === 0) return [];
  const start = (batchIndex * batchSize) % all.length;
  const batch: AivaHireCandidate[] = [];
  for (let i = 0; i < batchSize; i += 1) {
    batch.push(all[(start + i) % all.length]);
  }
  return batch;
}

export function resolveRoleTemplate(templateId: string) {
  return AIVA_ROLE_TEMPLATE_CARDS.find((card) => card.templateId === templateId) ?? null;
}

import {
  Building2,
  CalendarDays,
  Headphones,
  PenLine,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

export interface AivaRoleTemplateCard {
  id: string;
  templateId: string;
  label: string;
  icon: LucideIcon;
  exampleQ: string | null;
  exampleA: string;
  roleName: string;
  roleDescription: string;
  defaultChannels: string[];
}

export const AIVA_ROLE_TEMPLATE_CARDS: AivaRoleTemplateCard[] = [
  {
    id: 'property-manager',
    templateId: 'property-manager',
    label: 'Property Manager',
    icon: Building2,
    exampleQ: '"Is the flat on Park Road still available?"',
    exampleA: 'Aria: "It is. Want to book a viewing this week?"',
    roleName: 'Property Manager',
    roleDescription:
      'Handles tenant and buyer enquiries about available properties. Books viewings, answers questions about terms and fees, and logs maintenance requests. Escalates anything involving legal notices, complaints, or eviction queries.',
    defaultChannels: ['whatsapp', 'email'],
  },
  {
    id: 'outreach-coordinator',
    templateId: 'outreach-coordinator',
    label: 'Outreach Coordinator',
    icon: Target,
    exampleQ: '"What does your service include?"',
    exampleA: 'Aria: "Happy to walk you through it. What size is your team?"',
    roleName: 'Outreach Coordinator',
    roleDescription:
      'Responds to inbound enquiries, qualifies leads by asking the right questions, and books discovery calls. Does not make pricing commitments. Escalates when a prospect asks to speak to a human.',
    defaultChannels: ['email'],
  },
  {
    id: 'financial-analyst',
    templateId: 'financial-analyst',
    label: 'Financial Analyst',
    icon: TrendingUp,
    exampleQ: '"Can you summarise last month\'s expenses?"',
    exampleA: 'Aria: "Here is a breakdown by category. Two items need your review."',
    roleName: 'Financial Analyst',
    roleDescription:
      'Reads invoices and spreadsheets, categorises expenses, and generates monthly summaries. Flags anomalies and missing information. Escalates discrepancies and anything requiring a financial decision.',
    defaultChannels: ['email', 'slack'],
  },
  {
    id: 'content-assistant',
    templateId: 'content-assistant',
    label: 'Content Assistant',
    icon: PenLine,
    exampleQ: '"Can you draft a blog post about our launch?"',
    exampleA: 'Aria: "Here is a first draft based on your brief. Ready for review."',
    roleName: 'Content Assistant',
    roleDescription:
      'Drafts blog posts, social captions, and newsletters from briefs. Researches topics and formats content per brand guidelines. Does not publish without approval. Escalates sensitive or ambiguous briefs.',
    defaultChannels: ['email', 'slack'],
  },
  {
    id: 'calendar-manager',
    templateId: 'calendar-manager',
    label: 'Calendar Manager',
    icon: CalendarDays,
    exampleQ: '"Can I book a table for Saturday?"',
    exampleA: 'Aria: "Saturday evening works. How many guests?"',
    roleName: 'Calendar Manager',
    roleDescription:
      'Manages scheduling requests, proposes available slots, sends confirmations and reminders, and prepares meeting briefs. Does not book paid venues without approval. Escalates high-priority conflicts.',
    defaultChannels: ['email', 'slack'],
  },
  {
    id: 'customer-support',
    templateId: 'customer-support',
    label: 'Customer Support',
    icon: Headphones,
    exampleQ: '"Do you offer next-day delivery?"',
    exampleA: 'Aria: "Yes, orders placed before 2pm ship same day..."',
    roleName: 'Customer Support',
    roleDescription:
      'Triages inbound queries, answers FAQs from the knowledge base, and routes complex issues to the right team member. Tone: helpful and calm. Flags billing disputes, legal questions, or angry tone for review.',
    defaultChannels: ['email', 'web', 'whatsapp'],
  },
];

export const AIVA_CHANNEL_OPTIONS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'Email' },
  { id: 'slack', label: 'Slack' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'web', label: 'Web chat' },
] as const;

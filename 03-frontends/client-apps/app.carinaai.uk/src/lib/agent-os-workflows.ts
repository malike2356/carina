export type AgentOsWorkflow = {
  id: string;
  title: string;
  description: string;
  href: string;
  status: 'ready' | 'preview';
};

export const AGENT_OS_WORKFLOWS: AgentOsWorkflow[] = [
  {
    id: 'hello',
    title: 'First useful output',
    description: 'Create a useful first document and complete the day-one milestone.',
    href: '/agent-os/workflows/hello',
    status: 'ready',
  },
  {
    id: 'content-series',
    title: 'Content series',
    description: 'Turn one brief into a structured series of publish-ready drafts.',
    href: '/agent-os/workflows/content-series',
    status: 'ready',
  },
  {
    id: 'crm-import',
    title: 'Clean CRM import',
    description: 'Normalize a CSV, remove duplicates, and download a clean import file.',
    href: '/agent-os/workflows/crm-import',
    status: 'ready',
  },
  {
    id: 'video',
    title: 'Video brief',
    description: 'Build a production-ready video outline from a goal and audience.',
    href: '/agent-os/workflows/video',
    status: 'ready',
  },
  {
    id: 'seo',
    title: 'SEO brief',
    description: 'Create a focused search brief with intent, outline, and next actions.',
    href: '/agent-os/workflows/seo',
    status: 'ready',
  },
  {
    id: 'outreach',
    title: 'Outreach sequence',
    description: 'Draft a responsible outreach sequence and save a follow-up task.',
    href: '/agent-os/workflows/outreach',
    status: 'ready',
  },
  {
    id: 'onboarding-path',
    title: 'Onboarding path',
    description: 'Map a practical day 1, day 7, and day 30 adoption path.',
    href: '/agent-os/workflows/onboarding-path',
    status: 'ready',
  },
];

import type { PackSkillInput } from '../../pack-types.js';

export const propreneurWorkspaceSkills: PackSkillInput[] = [
  {
    name: 'portfolio-review',
    description: 'Summarise the connected Propreneur property portfolio: count, status breakdown, rent roll, and flagged issues.',
    trigger: [
      'portfolio review',
      'show my properties',
      'property portfolio',
      'how many properties',
      'rent roll summary',
    ],
    steps: `1. Call propreneur-get-portfolio to retrieve all properties.
2. Group by status (let, vacant, managed, sold).
3. Sum monthly rent for all active tenancies.
4. Flag any properties with missing EPC or expiring compliance.
5. Present a concise summary table: address, status, rent, flags.`,
    toolsUsed: ['propreneur-get-portfolio'],
  },
  {
    name: 'compliance-check',
    description: 'Check compliance certificate status across all Propreneur properties and flag upcoming expirations.',
    trigger: [
      'compliance check',
      'EPC expiry',
      'gas safety certificate',
      'EICR due',
      'compliance status',
      'certificates expiring',
    ],
    steps: `1. Call propreneur-get-portfolio to list all properties.
2. For each property, call propreneur-get-compliance to fetch certificate status.
3. Categorise items: expired, expiring within 90 days, valid.
4. For expired and near-expiry items, include the type, expiry date, and recommended action.
5. Present a prioritised list: critical (expired) first, then upcoming, then all-clear.`,
    toolsUsed: ['propreneur-get-portfolio', 'propreneur-get-compliance'],
  },
  {
    name: 'deal-pipeline-review',
    description: 'Review the Propreneur deal pipeline: open deals, stalled entries, and follow-up actions.',
    trigger: [
      'deal pipeline',
      'open deals',
      'deal status',
      'property deals review',
      'stalled deals',
      'deal follow-up',
    ],
    steps: `1. Call propreneur-get-deals to retrieve all open deals.
2. Group by stage or status.
3. Identify stalled deals (no update in 14+ days if date available).
4. Summarise total deal value, count by stage, and top three next actions.
5. Recommend which deals to prioritise this week.`,
    toolsUsed: ['propreneur-get-deals'],
  },
  {
    name: 'property-ai-task',
    description: 'Run a complex, multi-step property task using the full Carina AI inside the connected Propreneur workspace. Use this for tasks that require deep tenant, financial, or compliance context.',
    trigger: [
      'ask propreneur carina',
      'propreneur carina',
      'use propreneur ai',
      'complex property task',
      'property report',
      'tenancy analysis',
      'rent review analysis',
      'arrears report',
      'hmo compliance report',
      'financial summary propreneur',
    ],
    steps: `1. Identify the specific task or question the user wants Propreneur Carina to handle.
2. Clarify any missing details (which property, date range, tenant name) before calling the tool.
3. Call propreneur-carina-chat with the complete, well-formed task description.
4. Present the reply from Propreneur Carina to the user verbatim, adding context only if needed.
5. If requires_confirmation is true, direct the user to log in to their Propreneur workspace to approve the pending action.`,
    toolsUsed: ['propreneur-carina-chat'],
  },
  {
    name: 'propose-deal',
    description: 'Propose a new property deal in Propreneur for human review. The deal is not created until a Propreneur admin approves it.',
    trigger: [
      'propose deal',
      'add deal to propreneur',
      'log new deal',
      'create deal propreneur',
      'deal proposal',
    ],
    steps: `1. Collect: deal title, property (if known), deal value, priority, and reason for the proposal.
2. Confirm all details with the user before submitting.
3. Call propreneur-propose-deal with the confirmed details.
4. Inform the user the deal has been submitted for review and will appear in Propreneur's pending proposals.
5. Do not tell the user the deal is created - it requires human approval first.`,
    toolsUsed: ['propreneur-propose-deal'],
  },
];

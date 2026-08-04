import type { PackSkillInput } from '../property-uk/skills.js';

export const salesCrmSkills: PackSkillInput[] = [
  {
    name: 'deal-staging',
    description: 'Move deals through CRM pipeline stages with next-action prompts',
    trigger: ['pipeline stage', 'deal stage', 'CRM pipeline', 'move deal', 'sales stage'],
    steps: `1. Capture deal name, value, stage, owner, and last contact date.
2. Validate stage criteria (discovery, proposal, negotiation, won/lost).
3. Define next action, owner, and due date for the new stage.
4. Output CRM-ready update notes and follow-up task list.`,
    toolsUsed: ['file-write', 'send-message'],
  },
  {
    name: 'email-sequences',
    description: 'Draft multi-touch outbound email sequences for prospects',
    trigger: ['email sequence', 'outreach sequence', 'follow-up emails', 'drip campaign', 'cold outreach'],
    steps: `1. Define ICP, offer, tone, and number of touches (typically 3-5).
2. Draft subject lines and bodies with clear CTAs and spacing (day 0, 3, 7, 14).
3. Personalise placeholders for name, company, and trigger event.
4. Output sequence table with send timing and A/B subject variants.`,
    toolsUsed: ['file-write', 'web-search'],
  },
  {
    name: 'proposal-generator',
    description: 'Generate structured sales proposals from discovery notes',
    trigger: ['sales proposal', 'client proposal', 'SOW draft', 'scope of work', 'quote document'],
    steps: `1. Ingest discovery notes: pain points, scope, timeline, budget signals.
2. Structure: executive summary, approach, deliverables, timeline, pricing, terms.
3. Align deliverables to measurable outcomes and assumptions.
4. Export markdown or DOCX-ready sections for review.`,
    toolsUsed: ['file-read', 'file-write'],
  },
  {
    name: 'pipeline-review',
    description: 'Review CRM pipeline health, stalled deals, and forecast',
    trigger: ['pipeline review', 'sales forecast', 'stalled deals', 'win rate', 'quota attainment'],
    steps: `1. Load deal list with stage, age, value, and last activity.
2. Flag stalled deals (no activity 14+ days) and stage bottlenecks.
3. Calculate weighted forecast by stage probability.
4. Recommend top 5 actions to unblock revenue this week.`,
    toolsUsed: ['file-read', 'code-exec', 'file-write'],
  },
];

import type { PackSkillInput } from '../../pack-types.js';

export const salesCrmSkills: PackSkillInput[] = [
  {
    name: 'deal-qualification',
    description: 'Qualify property investment deals using BANT and MEDDIC frameworks',
    trigger: ['deal qualification', 'BANT', 'MEDDIC', 'qualify lead', 'go no-go deal'],
    steps: `1. Capture Budget, Authority, Need, Timeline (BANT) for the opportunity.
2. Layer MEDDIC: Metrics, Economic buyer, Decision criteria/process, Pain, Champion.
3. Score fit against your buy-box (strategy, geography, yield, refurb appetite).
4. Mark red flags: unclear funding, no decision maker, unrealistic timeline.
5. Recommend advance, nurture, or walk away with explicit next actions.`,
    toolsUsed: ['file-write', 'send-message'],
  },
  {
    name: 'follow-up-cadence',
    description: 'Plan follow-up timing and channels for UK property investor prospects',
    trigger: ['follow-up cadence', 'outreach timing', 'nurture sequence', 'investor follow up'],
    steps: `1. Segment prospect temperature (cold, warm, active deal).
2. Propose touch pattern (e.g. day 0 email, day 3 value note, day 7 call, day 14 case study).
3. Match channel to preference (email, LinkedIn, phone, WhatsApp where permitted).
4. Include compliance notes (PECR/marketing consent for electronic messages).
5. Output calendar-ready follow-up list with owner and message angle.`,
    toolsUsed: ['file-write'],
  },
  {
    name: 'objection-handling',
    description: 'Handle common objections in UK property investment sales conversations',
    trigger: ['objection handling', 'sales objection', 'too expensive', 'market timing', 'risk concern'],
    steps: `1. Restate the objection in the prospect's words.
2. Classify: price, timing, trust, complexity, or competition.
3. Respond with evidence (case study, numbers, process clarity) without pressure tactics.
4. Offer a low-risk next step (review pack, 15-minute call, model scenario).
5. Log objection and resolution in CRM notes for pipeline review.`,
    toolsUsed: ['file-write', 'web-search'],
  },
  {
    name: 'pipeline-review',
    description: 'Run a weekly CRM pipeline review with stage exit criteria',
    trigger: ['pipeline review', 'deal stages', 'stalled deals', 'forecast review', 'CRM hygiene'],
    steps: `1. List open deals by stage with value, age, and last activity.
2. Apply exit criteria per stage (qualified, discovery complete, proposal sent, negotiation).
3. Flag stalled deals (no activity 14+ days) and missing next steps.
4. Calculate weighted forecast using stage probabilities.
5. Output top five actions to unblock revenue this week.`,
    toolsUsed: ['file-read', 'file-write', 'code-exec'],
  },
  {
    name: 'investor-profiling',
    description: 'Profile a property investor capital, strategy, timeline, and risk appetite',
    trigger: ['investor profile', 'buy box', 'investor segmentation', 'capital capacity', 'strategy fit'],
    steps: `1. Capture available capital, funding sources, and liquidity timeline.
2. Identify strategy (BTL, BRRR, HMO, flip, commercial) and geography.
3. Assess experience level, team support, and risk tolerance.
4. Map to suitable deal types and service tier.
5. Summarise profile for CRM and tailor next conversation.`,
    toolsUsed: ['file-write'],
  },
];

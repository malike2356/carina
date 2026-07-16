import type { PackSkillInput } from '../../pack-types.js';

export const marketingOpsSkills: PackSkillInput[] = [
  {
    name: 'linkedin-post-scheduler',
    description: 'Generate a week of LinkedIn post drafts from a theme bank and stage them for approval',
    trigger: ['linkedin post', 'linkedin draft', 'linkedin schedule', 'weekly posts', 'post scheduler'],
    steps: `1. Ask for: theme bank (list of topics), target audience, voice/tone, CTA style, and any prior posts to avoid repeating.
2. Assign one theme per weekday (Mon-Fri). Cycle if fewer than 5 themes, never repeat on consecutive days.
3. Draft each post: 80-200 words, short paragraphs, voice-matched, with the requested CTA.
4. Check drafts against prior posts: if a draft is semantically close to a previous one, regenerate with a different angle.
5. Never fabricate stats or quotes. Use [X% of leaders report...] placeholders and flag them.
6. Output a day-by-day list: date, theme, draft text, char count, suggested time, status=pending_approval.
7. Append a summary: themes used, flagged placeholders, any regenerations.`,
    toolsUsed: ['file-write', 'file-read'],
  },
  {
    name: 'linkedin-outreach-helper',
    description: 'Draft personalized LinkedIn connection requests and follow-up messages',
    trigger: ['linkedin outreach', 'linkedin connection', 'linkedin message', 'linkedin follow up', 'connection request'],
    steps: `1. Ask for the target person (name/company/profile URL) and the outreach goal (networking, recruiting, selling, mentorship, event follow-up).
2. Gather: relationship type, specific reason for contact, desired tone, any mutual context to highlight.
3. Draft connection request (max 300 chars): lead with a genuine, specific commonality, one sentence on why connecting. No generic filler.
4. If a follow-up message is needed (max 3 short paragraphs): reference prior interaction, provide clear value, end with a low-friction CTA.
5. Present draft to user, invite edits, iterate until approved.
6. Never use hyperbolic flattery or spam patterns. Include at least two concrete details from the profile or shared context.
7. Warn if user requests bulk identical outreach; explain personalized messages perform better.`,
    toolsUsed: ['web-search', 'http-request'],
  },
  {
    name: 'mailchimp-campaign-auditor',
    description: 'Audit a sent Mailchimp campaign: breaks down opens/clicks/unsubs by segment and proposes fixes for the next send',
    trigger: ['mailchimp audit', 'email campaign audit', 'campaign performance', 'mailchimp report', 'email open rate'],
    steps: `1. Ask for the campaign name or ID and the audience/list it was sent to.
2. Request or accept pasted metrics: overall opens (unique and total), clicks by URL, unsubscribes, bounces (hard and soft), and complaints.
3. Break down by segment if data is available. Compare each metric against stated historical averages. Flag anything more than 1 standard deviation below average as underperforming.
4. Generate a ranked list of 3-5 concrete actionable fixes for the next send. Each fix must reference a specific metric (e.g., "Segment X had 4.2% open rate vs 18% average").
5. Note any segment with fewer than 50 recipients as low-sample and caveat percentage-based recommendations.
6. Never invent metrics. Work only from what the user provides.`,
    toolsUsed: ['http-request'],
  },
  {
    name: 'google-ads-optimizer',
    description: 'Review Google Ads campaign metrics and propose bid adjustments with projected CAC impact',
    trigger: ['google ads', 'bid optimization', 'ads review', 'campaign bids', 'cac target', 'ppc review'],
    steps: `1. Ask for campaign metrics: impressions, clicks, conversions, cost, avg CPC, and conversion value for the last 14 days.
2. Compute for each campaign: CAC (cost / conversions), ROAS (value / cost), CTR, conversion rate.
3. Flag campaigns with fewer than 10 conversions as low-data; recommend manual review, not bid changes.
4. Propose bid adjustments: if CAC is >20% above target, suggest 10-15% bid decrease. If CAC is >20% below target and impression share is below 80%, suggest 10-15% bid increase.
5. Project impact for each proposed change: new daily spend, projected conversions, projected CAC. Label clearly as estimates.
6. All proposals are recommendations only; never auto-apply. Present as a structured report.`,
    toolsUsed: ['http-request', 'code-exec'],
  },
];

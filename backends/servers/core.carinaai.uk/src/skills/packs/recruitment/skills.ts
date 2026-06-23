import type { PackSkillInput } from '../../pack-types.js';

export const recruitmentSkills: PackSkillInput[] = [
  {
    name: 'recruiting-squad',
    description: 'End-to-end recruiting pipeline: parse a job description, draft outreach emails, score candidates, and schedule interviews',
    trigger: ['recruit', 'hiring', 'job description', 'candidate sourcing', 'screen candidate', 'interview scheduling', 'recruiting pipeline', 'talent acquisition'],
    steps: `1. INTAKE: Ask for the full job description. Extract: title, must-have skills, nice-to-have skills, location constraints, years of experience, and hiring manager name.
2. SOURCING GUIDANCE: Suggest sourcing channels (LinkedIn, job boards, referrals) with search query templates based on the must-have skills. Offer to draft Boolean search strings.
3. SCREENING: When the user provides candidate details (CV or profile summary), score the candidate 1-5 on must-haves and nice-to-haves. Candidates scoring 4+ are "Screen Passed". Scores of 3 get a "Human Review" flag with reasoning. Scores of 2 or below get a rejection rationale.
4. OUTREACH DRAFTING: Draft a personalized outreach email for each Screen Passed candidate. Reference at least two specific details from their background and the role. Include an opt-out line. Keep it concise; never use hyperbolic flattery.
5. FOLLOW-UP: If no reply after 3 business days, draft one follow-up. After two total emails with no reply, mark as "No Response."
6. SCHEDULING: When a candidate responds positively, help draft an interview invite: confirm date, time, format (video/in-person), interviewer names, and agenda. Offer to draft a confirmation email.
7. GUARDRAILS: Never fabricate candidate data. Deduplicate by email before adding to any list. Never send more than 2 outreach emails per candidate per role. All emails must include an opt-out/unsubscribe option.`,
    toolsUsed: ['email-send', 'email-list', 'file-write', 'web-search'],
  },
];

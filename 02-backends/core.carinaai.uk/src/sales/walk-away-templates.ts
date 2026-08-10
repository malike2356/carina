/**
 * Professional decline / walk-away email templates for sales qualification.
 */

import type { ClientQualificationProfile, ScorecardResult } from './qualification-scorecard.js';

export type DeclineReason =
  | 'scope_mismatch'
  | 'budget_misalignment'
  | 'timeline_conflict'
  | 'red_flag_behavior'
  | 'generic';

export const DECLINE_REASONS: DeclineReason[] = [
  'scope_mismatch',
  'budget_misalignment',
  'timeline_conflict',
  'red_flag_behavior',
  'generic',
];

export interface DeclineEmailInput {
  clientProfile: ClientQualificationProfile;
  reason: DeclineReason;
  /** Sender display name */
  senderName?: string;
  /** Optional referral / alternative for scope mismatch */
  alternative?: string;
  scorecard?: ScorecardResult;
}

export interface DeclineEmail {
  reason: DeclineReason;
  subject: string;
  body: string;
  tone: 'professional_firm_open_door';
}

function firstName(profile: ClientQualificationProfile): string {
  const raw = (profile.name || 'there').trim();
  const first = raw.split(/\s+/)[0];
  return first || 'there';
}

function pickReasonFromScorecard(scorecard?: ScorecardResult): DeclineReason {
  if (!scorecard) return 'generic';
  if (scorecard.automaticFail) return 'red_flag_behavior';
  const ids = new Set(scorecard.flags.map((f) => f.criterionId));
  if (ids.has('budget_alignment')) return 'budget_misalignment';
  if (ids.has('scope_creep')) return 'scope_mismatch';
  if (ids.has('timeline_realism')) return 'timeline_conflict';
  if (scorecard.flags.some((f) => f.severity === 'critical')) return 'red_flag_behavior';
  return 'generic';
}

export function suggestDeclineReason(scorecard?: ScorecardResult): DeclineReason {
  return pickReasonFromScorecard(scorecard);
}

export function generateDeclineEmail(input: DeclineEmailInput): DeclineEmail {
  const name = firstName(input.clientProfile);
  const sender = (input.senderName || 'The Verlox team').trim();
  const alternative =
    (input.alternative || '').trim()
    || 'a specialist partner better suited to this scale of work';

  switch (input.reason) {
    case 'scope_mismatch':
      return {
        reason: input.reason,
        subject: `Following up on ${input.clientProfile.company || input.clientProfile.name}`,
        body: [
          `Hi ${name},`,
          '',
          'Thank you for sharing your project vision with us. After careful review, I do not believe we are the right fit for what you are looking to build.',
          '',
          `Based on our assessment, the scope of this project extends beyond our current capacity. We would recommend ${alternative} for this scale of work.`,
          '',
          'I want to make sure you find the right partner. If a referral would help, say the word.',
          '',
          'Best,',
          sender,
        ].join('\n'),
        tone: 'professional_firm_open_door',
      };
    case 'budget_misalignment':
      return {
        reason: input.reason,
        subject: `Regarding ${input.clientProfile.company || 'your project'}`,
        body: [
          `Hi ${name},`,
          '',
          'I appreciate the opportunity to discuss your project. Based on the scope we outlined, I do not believe we can deliver the quality you deserve within the budget parameters discussed.',
          '',
          'The investment required for this outcome falls outside your current budget range. We would rather be upfront than compromise on quality.',
          '',
          'If your budget or timeline shifts in the future, we can revisit. No hard feelings either way.',
          '',
          'Best,',
          sender,
        ].join('\n'),
        tone: 'professional_firm_open_door',
      };
    case 'timeline_conflict':
      return {
        reason: input.reason,
        subject: `Timeline for ${input.clientProfile.company || 'your project'}`,
        body: [
          `Hi ${name},`,
          '',
          'Thank you for the conversations so far. Our current commitments prevent us from meeting your timeline without sacrificing the quality we hold ourselves to.',
          '',
          'Rather than over-promise, we are stepping back so you can find a partner who can move at the pace you need.',
          '',
          'Wishing you a smooth kickoff with whoever you choose.',
          '',
          'Best,',
          sender,
        ].join('\n'),
        tone: 'professional_firm_open_door',
      };
    case 'red_flag_behavior':
      return {
        reason: input.reason,
        subject: `Next steps for ${input.clientProfile.company || 'the project'}`,
        body: [
          `Hi ${name},`,
          '',
          'After our conversations, we have decided this is not the right fit for our team at this time. We wish you the best in finding the right partner.',
          '',
          'Thank you for your time.',
          '',
          'Best,',
          sender,
        ].join('\n'),
        tone: 'professional_firm_open_door',
      };
    case 'generic':
    default:
      return {
        reason: 'generic',
        subject: `Following up on ${input.clientProfile.company || input.clientProfile.name}`,
        body: [
          `Hi ${name},`,
          '',
          'After careful consideration, we do not believe we are the best match for this project.',
          '',
          'Thank you for considering us. We wish you every success with the work ahead.',
          '',
          'Best,',
          sender,
        ].join('\n'),
        tone: 'professional_firm_open_door',
      };
  }
}

export function listWalkAwayTemplates(): Array<{ reason: DeclineReason; summary: string }> {
  return [
    { reason: 'scope_mismatch', summary: 'Scope beyond capacity; offer alternative.' },
    { reason: 'budget_misalignment', summary: 'Budget cannot support quality delivery.' },
    { reason: 'timeline_conflict', summary: 'Cannot meet timeline without quality sacrifice.' },
    { reason: 'red_flag_behavior', summary: 'Not the right fit; firm and brief.' },
    { reason: 'generic', summary: 'Professional decline without burning the relationship.' },
  ];
}

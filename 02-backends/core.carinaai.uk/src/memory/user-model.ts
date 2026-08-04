export type UserFactCategory =
  | 'expertise'
  | 'preference'
  | 'goal'
  | 'context'
  | 'behavior'
  | 'blind_spot'
  | 'constraint';

export const USER_FACT_CATEGORIES: UserFactCategory[] = [
  'expertise',
  'preference',
  'goal',
  'context',
  'behavior',
  'blind_spot',
  'constraint',
];

export interface UserFact {
  id: string;
  category: UserFactCategory;
  fact: string;
  confidence: number;
  observedAt: Date;
  conversationId: string;
  confirmedAt?: Date;
  contradictedAt?: Date;
}

export interface UserModelMeta {
  profileId: string;
  compiledSummary?: string;
  compiledAt?: Date;
  conversationCount: number;
}

import { isDatabaseConfigured } from '../config/database-url.js';

export function isUserFactCategory(value: string): value is UserFactCategory {
  return (USER_FACT_CATEGORIES as string[]).includes(value);
}

export function userIntelligenceEnabled(): boolean {
  if (process.env.CARINA_USER_INTELLIGENCE === 'false') return false;
  return isDatabaseConfigured();
}

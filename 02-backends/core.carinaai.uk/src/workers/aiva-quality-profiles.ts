export type AivaQualityProfile = 'social_fast' | 'owner_standard' | 'owner_deep' | 'customer_safe' | 'fallback_full';

export type AivaQualitySettings = {
  profile: AivaQualityProfile;
  thinkingLevel: 'off' | 'low' | 'medium' | 'high';
  maxTurns: number;
  iterationBudget: number;
  maxCompletionTokens: number;
  blockExpensiveModels: boolean;
  useFullAgentLoop: boolean;
};

const PROFILES: Record<AivaQualityProfile, AivaQualitySettings> = {
  social_fast: { profile: 'social_fast', thinkingLevel: 'off', maxTurns: 4, iterationBudget: 6, maxCompletionTokens: 500, blockExpensiveModels: true, useFullAgentLoop: false },
  owner_standard: { profile: 'owner_standard', thinkingLevel: 'low', maxTurns: 12, iterationBudget: 20, maxCompletionTokens: 1500, blockExpensiveModels: false, useFullAgentLoop: true },
  owner_deep: { profile: 'owner_deep', thinkingLevel: 'high', maxTurns: 20, iterationBudget: 40, maxCompletionTokens: 3000, blockExpensiveModels: false, useFullAgentLoop: true },
  customer_safe: { profile: 'customer_safe', thinkingLevel: 'low', maxTurns: 8, iterationBudget: 12, maxCompletionTokens: 1000, blockExpensiveModels: true, useFullAgentLoop: true },
  fallback_full: { profile: 'fallback_full', thinkingLevel: 'medium', maxTurns: 12, iterationBudget: 20, maxCompletionTokens: 1500, blockExpensiveModels: false, useFullAgentLoop: true },
};

export function aivaQualityProfile(input: { audiencePrincipal?: boolean; simpleTurn?: boolean; deepTask?: boolean; fallback?: boolean } = {}): AivaQualityProfile {
  if (input.fallback) return 'fallback_full';
  if (input.audiencePrincipal) return 'customer_safe';
  if (input.simpleTurn) return 'social_fast';
  if (input.deepTask) return 'owner_deep';
  return 'owner_standard';
}

export function aivaQualitySettings(profile: AivaQualityProfile): AivaQualitySettings {
  return { ...PROFILES[profile] };
}

export function listAivaQualityProfiles(): AivaQualitySettings[] {
  return Object.values(PROFILES).map((profile) => ({ ...profile }));
}

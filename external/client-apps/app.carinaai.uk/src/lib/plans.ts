import type { WorkspacePlan } from '@/db/schema';

export const PLAN_LIMITS: Record<
  WorkspacePlan,
  { dailyTokens: number | null; monthlyTokens: number | null; label: string; priceGbp: number | null }
> = {
  free: {
    dailyTokens: 50_000,
    monthlyTokens: null,
    label: 'Free',
    priceGbp: 0,
  },
  starter: {
    dailyTokens: null,
    monthlyTokens: 500_000,
    label: 'Starter',
    priceGbp: 19,
  },
  team: {
    dailyTokens: null,
    monthlyTokens: null,
    label: 'Team',
    priceGbp: 79,
  },
};

export function totalTokens(input: number, output: number): number {
  return input + output;
}

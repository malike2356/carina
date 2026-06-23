import type { WorkspacePlan } from '@/db/schema';

export type WhiteLabelCommercialTier = 'starter' | 'agency' | 'enterprise';

export function workspacePlanLabel(
  plan: WorkspacePlan,
  productName?: string | null,
): string {
  const labels: Record<WorkspacePlan, string> = {
    free: 'Free',
    starter: 'Starter',
    team: 'Team',
  };
  const base = labels[plan];
  if (!productName?.trim()) return base;
  return `${productName.trim()} ${base}`;
}

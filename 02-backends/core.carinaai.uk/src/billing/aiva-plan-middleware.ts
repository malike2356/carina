import type { NextFunction, Request, Response } from 'express';
import { getSubscription } from '../workers/aiva-subscription-store.js';
import { hasPlanTier, isBusinessPlan } from './plan-tier.js';

export type PlanGatedRequest = Request & { workspaceId?: string };

export function sendPlanUpgradeRequired(
  res: Response,
  planTier: string,
  required: 'team' | 'business',
): void {
  res.status(403).json({
    error: `${required.charAt(0).toUpperCase()}${required.slice(1)} plan required`,
    code: 'PLAN_UPGRADE_REQUIRED',
    planTier,
    planRequired: required,
  });
}

export async function requireTeamPlan(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const workspaceId = (req as PlanGatedRequest).workspaceId;
  const sub = await getSubscription(workspaceId!);
  const planTier = sub?.planTier ?? 'trial';
  if (!hasPlanTier(planTier, 'team')) {
    sendPlanUpgradeRequired(res, planTier, 'team');
    return;
  }
  next();
}

export async function requireBusinessPlan(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const workspaceId = (req as PlanGatedRequest).workspaceId;
  const sub = await getSubscription(workspaceId!);
  const planTier = sub?.planTier ?? 'trial';
  if (!isBusinessPlan(planTier)) {
    sendPlanUpgradeRequired(res, planTier, 'business');
    return;
  }
  next();
}

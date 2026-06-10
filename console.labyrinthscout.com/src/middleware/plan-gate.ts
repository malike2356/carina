import type { Request, Response, NextFunction } from 'express';
import { getAccountSubscriptionPlan, isScoutProPlan } from '../lib/subscription-plan.js';

export async function requireScoutPro(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.scoutAuth || req.scoutAuth.kind === 'operator') {
    next();
    return;
  }
  if (req.scoutAuth.kind !== 'account') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const plan = await getAccountSubscriptionPlan(req.scoutAuth.accountId);
    if (!isScoutProPlan(plan)) {
      res.status(403).json({
        error: 'Scout Pro required',
        plan,
        upgrade_url: 'https://core.carinaai.uk/checkout?plan=scout_pro',
      });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: 'Plan lookup failed' });
  }
}

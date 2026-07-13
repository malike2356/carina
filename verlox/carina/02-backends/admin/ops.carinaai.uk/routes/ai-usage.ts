import { Router } from 'express';
import { fetchAiUsageDashboard, formatMinorCurrency } from '../lib/ai-usage-dashboard.js';

export const aiUsageRouter = Router();

aiUsageRouter.get('/', async (req, res) => {
  const days = Number(req.query.days ?? 30);
  const summary = await fetchAiUsageDashboard(Number.isFinite(days) ? days : 30);
  res.render('ai-usage', {
    title: 'AI usage',
    days: Number.isFinite(days) ? days : 30,
    summary,
    money: formatMinorCurrency,
  });
});

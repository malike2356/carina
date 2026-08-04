import { Router } from 'express';
import {
  fetchAiUsageDashboard,
  formatMinorCurrency,
  formatRatePercent,
  updateAiUsagePricingConfig,
} from '../lib/ai-usage-dashboard.js';

export const aiUsageRouter = Router();

aiUsageRouter.get('/', async (req, res) => {
  const days = Number(req.query.days ?? 30);
  const summary = await fetchAiUsageDashboard(Number.isFinite(days) ? days : 30);
  res.render('ai-usage', {
    title: 'AI usage',
    days: Number.isFinite(days) ? days : 30,
    summary,
    money: formatMinorCurrency,
    percent: formatRatePercent,
    saved: req.query.saved === '1',
  });
});

aiUsageRouter.post('/pricing', async (req, res) => {
  const paymentOverheadPercent = Number(req.body.paymentOverheadPercent);
  const platformMarginPercent = Number(req.body.platformMarginPercent);
  if (!Number.isFinite(paymentOverheadPercent) || !Number.isFinite(platformMarginPercent)) {
    res.status(400).send('Invalid AI usage pricing percentages');
    return;
  }
  await updateAiUsagePricingConfig({
    paymentOverheadPercent,
    platformMarginPercent,
    updatedBy: req.session?.adminEmail ?? req.session?.userName ?? req.session?.userId ?? 'ops-admin',
  });
  const days = Number(req.body.days ?? 30);
  res.redirect(`/ai-usage?days=${Number.isFinite(days) ? days : 30}&saved=1`);
});

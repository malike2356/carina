import { Router } from 'express';
import { getPricing, upsertPrice } from '../lib/pricing-store.js';

export const pricingRouter = Router();

pricingRouter.get('/', async (req, res) => {
  const rows = await getPricing();
  res.render('pricing', {
    title: 'Platform Pricing',
    rows,
    saved: req.query['saved'] === '1',
    errMsg: typeof req.query['err'] === 'string' ? req.query['err'] : '',
  });
});

pricingRouter.post('/update', async (req, res) => {
  const { id, monthly_gbp } = req.body as { id?: string; monthly_gbp?: string };
  const planId = (id ?? '').trim();
  if (!planId) {
    res.redirect('/pricing?err=' + encodeURIComponent('Missing plan id'));
    return;
  }
  const raw = String(monthly_gbp ?? '').trim();
  const parsed = raw === '' ? null : parseInt(raw, 10);
  if (raw !== '' && (isNaN(parsed as number) || (parsed as number) < 0)) {
    res.redirect('/pricing?err=' + encodeURIComponent('Price must be a positive integer or blank'));
    return;
  }
  try {
    await upsertPrice(planId, parsed);
    res.redirect('/pricing?saved=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/pricing?err=' + encodeURIComponent('Save failed: ' + msg));
  }
});

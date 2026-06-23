import { Router, type IRouter } from 'express';
import { config } from '../config/index.js';
import { queryMarketplaceCatalog } from '../skills/hub/marketplace-catalog.js';
import { buildPackStorefront } from '../skills/hub/pack-storefront.js';
import type { MarketplaceEntryKind } from '../skills/hub/marketplace-types.js';
import { listWorkshopDrafts, workshopReviewEnabled } from '../skills/workshop-store.js';
import { scanSkillSecurity } from '../skills/skill-security.js';

export const marketplaceApiRouter: IRouter = Router();

marketplaceApiRouter.get('/storefront', async (req, res) => {
  try {
    const activePacks = typeof req.query.activePacks === 'string'
      ? req.query.activePacks.split(',').map((value) => value.trim()).filter(Boolean)
      : config.carina.activePacks;
    const productName = typeof req.query.productName === 'string' ? req.query.productName : undefined;
    const storefront = buildPackStorefront({
      activePacks,
      productName,
      marketplaceEnabled: config.hosted.enabled,
    });
    res.json(storefront);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

marketplaceApiRouter.get('/catalog', async (req, res) => {
  try {
    const kind = typeof req.query.kind === 'string' ? req.query.kind as MarketplaceEntryKind : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const catalog = await queryMarketplaceCatalog(
      { kind, category, q },
      { includeHubDb: true },
    );
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

marketplaceApiRouter.get('/featured', async (_req, res) => {
  try {
    const catalog = await queryMarketplaceCatalog({ featured: true }, { includeHubDb: true });
    const featured = catalog.entries.slice(0, 12);
    res.json({ entries: featured, summary: catalog.summary });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export const workshopApiRouter: IRouter = Router();

workshopApiRouter.get('/status', (_req, res) => {
  res.json({
    enabled: workshopReviewEnabled(),
    env: 'CARINA_SKILL_WORKSHOP',
  });
});

workshopApiRouter.get('/drafts', async (_req, res) => {
  try {
    const drafts = await listWorkshopDrafts();
    const rows = drafts.map((draft) => ({
      id: draft.id,
      name: draft.name,
      description: draft.description,
      createdAt: draft.createdAt,
      security: scanSkillSecurity(draft),
    }));
    res.json({ drafts: rows });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

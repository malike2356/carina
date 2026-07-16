import type { Express } from 'express';
import { scoutNlQueryRouter } from './nl-query-api.js';
import { scoutInvestigationRouter } from './investigation-api.js';
import { scoutRecommendationsRouter } from './recommendations-api.js';

export function mountScoutAgenticRoutes(app: Express): void {
  app.use('/api/scout', scoutNlQueryRouter);
  app.use('/api/scout', scoutInvestigationRouter);
  app.use('/api/scout', scoutRecommendationsRouter);
}

export { scoutNlQueryRouter, scoutInvestigationRouter, scoutRecommendationsRouter };

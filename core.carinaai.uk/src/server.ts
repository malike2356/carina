import type { Express } from 'express';
import { config } from './config/index.js';
import { cloudRouter, mountCloudWebhook } from './api/cloud/router.js';

export function mountCloudRawRoutes(app: Express): void {
  mountCloudWebhook(app);
}

export function mountServerRoutes(app: Express): void {
  app.use('/api/cloud', cloudRouter);
}

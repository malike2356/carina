import type { Express } from 'express';
import { config } from './config/index.js';
import { cloudRouter, loginCloudOrg, mountCloudWebhook, registerCloudOrg } from './api/cloud/router.js';

export function mountCloudRawRoutes(app: Express): void {
  mountCloudWebhook(app);
}

export function mountServerRoutes(app: Express): void {
  app.post('/app/auth/register', registerCloudOrg);
  app.post('/app/auth/login', loginCloudOrg);
  app.use('/api/cloud', cloudRouter);
}

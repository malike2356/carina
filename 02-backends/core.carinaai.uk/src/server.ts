import type { Express } from 'express';
import { cloudRouter, loginCloudOrg, mountCloudWebhook, registerCloudOrg } from './api/cloud/router.js';
import { incidentBlogRouter } from './api/incident-blog.js';
import { aivaRouter } from './api/aiva-api.js';
import { aivaEmailRouter } from './api/aiva-email-api.js';
import { aivaPropreneurWebhookRouter } from './api/aiva-propreneur-webhook-api.js';
import { isAiWorkersEnabled } from './workers/aiva-message-handler.js';
import { isEmailIngestionEnabled, isPropreneurBridgeEnabled } from './workers/aiva-feature-flags.js';
import { mountChannelWebhooks } from './channels/channel-router.js';
import { channelsApiRouter } from './channels/channels-api.js';
import { mountWidgetRoutes } from './widget/widget-router.js';
import { mountEmailRoutes } from './email/email-routes.js';
import { conversationsRouter } from './conversations/conversations-router.js';
import { aivaAnalyticsRouter } from './analytics/aiva-analytics-router.js';
import { adminRouter } from './admin/admin-router.js';
import { mountWorkspaceUploads, workspaceRouter } from './workspace/workspace-router.js';
import { publicPricingRouter } from './api/public-pricing.js';
import { ragUploadRouter } from './api/rag-upload-api.js';

export function mountCloudRawRoutes(app: Express): void {
  mountCloudWebhook(app);
  if (isAiWorkersEnabled()) {
    mountChannelWebhooks(app);
  }
}

export function mountServerRoutes(app: Express): void {
  mountEmailRoutes(app);
  app.post('/app/auth/register', registerCloudOrg);
  app.post('/app/auth/login', loginCloudOrg);
  app.use('/api/public/pricing', publicPricingRouter);
  app.use('/api/carina-ops/rag', ragUploadRouter);
  app.use('/api/cloud', cloudRouter);
  app.use('/api/incident-blog', incidentBlogRouter);
  if (isAiWorkersEnabled()) {
    app.use('/api/aiva/analytics', aivaAnalyticsRouter);
    app.use('/api/analytics', aivaAnalyticsRouter);
    app.use('/api/aiva', aivaRouter);
    if (isEmailIngestionEnabled() || isPropreneurBridgeEnabled()) {
      app.use('/api/aiva/email', aivaEmailRouter);
    }
    app.use('/api/aiva/webhooks', aivaPropreneurWebhookRouter);
    app.use('/api/conversations', conversationsRouter);
    app.use('/api/channels', channelsApiRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api/workspace', workspaceRouter);
    mountWorkspaceUploads(app);
    mountWidgetRoutes(app);
  }
}

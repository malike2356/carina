import type { Express } from 'express';
import { mountCloudWebhook, cloudRouter, loginCloudOrg, registerCloudOrg } from './api/cloud/router.js';
import { mountPaddleWebhook } from './api/routes/paddle-webhook-route.js';
import { mountPaddleCheckoutRoute } from './api/routes/paddle-checkout-route.js';
import { incidentBlogRouter } from './api/incident-blog.js';
import { aivaRouter } from './api/workspace-api.js';
import { aivaEmailRouter } from './api/workspace-email-api.js';
import { aivaEmailOAuthRouter } from './api/aiva-email-oauth-api.js';
import { aivaSocialOAuthRouter } from './api/aiva-social-oauth-api.js';
import { aivaSocialApprovalRouter } from './api/aiva-social-approval-api.js';
import { aivaN8nIntegrationRouter } from './api/aiva-n8n-integration-api.js';
import { aivaEmailApprovalRouter } from './api/aiva-email-approval-api.js';
import { aivaPropreneurWebhookRouter } from './api/aiva-propreneur-webhook-api.js';
import { propreneurHubReplyRouter } from './api/propreneur-hub-reply-api.js';
import { isAiWorkersEnabled } from './workers/workspace-message-handler.js';
import { isEmailIngestionActive, isPropreneurBridgeEnabled } from './workers/aiva-feature-flags.js';
import { mountChannelWebhooks } from './channels/channel-router.js';
import { mountAivaSocialInbound } from './api/aiva-channels-inbound-api.js';
import { channelsApiRouter } from './channels/channels-api.js';
import { mountWidgetRoutes } from './widget/widget-router.js';
import { mountEmailRoutes } from './email/email-routes.js';
import { conversationsRouter } from './conversations/conversations-router.js';
import { aivaAnalyticsRouter } from './analytics/aiva-analytics-router.js';
import { adminRouter } from './admin/admin-router.js';
import { mountWorkspaceUploads, workspaceRouter } from './workspace/workspace-router.js';
import { publicPricingRouter } from './api/public-pricing.js';
import { publicTrustRouter } from './security/trust/public-api.js';
import { aivaMarketplacePublicRouter } from './api/aiva-marketplace-api.js';
import { ragUploadRouter } from './api/rag-upload-api.js';
import { toolStatusRouter } from './api/tool-status-api.js';
import { runtimeToolsRouter } from './api/runtime-tools-api.js';
import { mutationApiRouter } from './api/mutation-api.js';
import { contactsSyncRouter } from './api/contacts-sync-api.js';
import { capabilityCheckRouter } from './api/capability-check-api.js';
import { onboardingRouter } from './api/onboarding-api.js';
import { channelConfigApiRouter } from './api/channel-config-api.js';
import { settingsApiRouter } from './api/settings-api.js';

export function mountCloudRawRoutes(app: Express): void {
  mountCloudWebhook(app);
  mountPaddleWebhook(app);
  if (isAiWorkersEnabled()) {
    mountChannelWebhooks(app);
    mountAivaSocialInbound(app);
  }
}

export function mountServerRoutes(app: Express): void {
  mountEmailRoutes(app);
  app.post('/app/auth/register', registerCloudOrg);
  app.post('/app/auth/login', loginCloudOrg);
  app.use('/api/public/pricing', publicPricingRouter);
  app.use('/api/public/trust', publicTrustRouter);
  app.use('/api/public/aiva/marketplace', aivaMarketplacePublicRouter);
  app.use('/api/internal/channels', channelConfigApiRouter);
  app.use('/api/internal/settings', settingsApiRouter);
  app.use('/api/carina-ops/rag', ragUploadRouter);
  app.use('/api/carina-ops/credentials', toolStatusRouter);
  app.use('/api/carina-ops/tools', runtimeToolsRouter);
  app.use('/api/mutation', mutationApiRouter);
  app.use('/api/contacts-sync', contactsSyncRouter);
  app.use('/api/capabilities', capabilityCheckRouter);
  app.use('/api/onboarding', onboardingRouter);
  app.use('/api/cloud', cloudRouter);
  app.use('/api/incident-blog', incidentBlogRouter);
  if (isAiWorkersEnabled()) {
    mountPaddleCheckoutRoute(app);
    app.use('/api/aiva/analytics', aivaAnalyticsRouter);
    app.use('/api/analytics', aivaAnalyticsRouter);
    app.use('/api/aiva', aivaRouter);
    if (isEmailIngestionActive() || isPropreneurBridgeEnabled()) {
      app.use('/api/aiva/email', aivaEmailRouter);
      app.use('/api/aiva/email/oauth', aivaEmailOAuthRouter);
      app.use('/api/aiva/email/approvals', aivaEmailApprovalRouter);
    }
    app.use('/api/aiva/social/oauth', aivaSocialOAuthRouter);
    app.use('/api/aiva/social/approvals', aivaSocialApprovalRouter);
    app.use('/api/aiva/integrations/n8n', aivaN8nIntegrationRouter);
    app.use('/api/aiva/webhooks', aivaPropreneurWebhookRouter);
    app.use('/api/inbound', propreneurHubReplyRouter);
    app.use('/api/conversations', conversationsRouter);
    app.use('/api/channels', channelsApiRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api/workspace', workspaceRouter);
    mountWorkspaceUploads(app);
    mountWidgetRoutes(app);
  }
}

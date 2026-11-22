import type { Express } from 'express';
import { mountCloudWebhook, cloudRouter, loginCloudOrg, registerCloudOrg } from './api/cloud/router.js';
import { mountPaddleWebhook } from './api/routes/paddle-webhook-route.js';
import { mountPaddleCheckoutRoute } from './api/routes/paddle-checkout-route.js';
import { incidentBlogRouter } from './api/incident-blog.js';
import { documentVaultDeliveryRouter } from './api/document-vault-delivery-api.js';
import { documentVaultSearchOpsRouter } from './api/document-vault-search-ops-api.js';
import { zoomWebhookRouter } from './api/zoom-webhook-api.js';
import { googleCalendarWebhookRouter } from './api/google-calendar-webhook-api.js';
import { registerVicalSideEffects } from './vical/side-effects.js';
import { youtubeChannelAnalyticsRouter } from './analytics/youtube-channel/dashboard-api.js';
import { propreneurHubReplyRouter } from './api/propreneur-hub-reply-api.js';
import { isAiWorkersEnabled } from './workers/workspace-message-handler.js';
import { mountChannelWebhooks } from './channels/channel-router.js';
import { channelsApiRouter } from './channels/channels-api.js';
import { mountWidgetRoutes } from './widget/widget-router.js';
import { mountEmailRoutes } from './email/email-routes.js';
import { conversationsRouter } from './conversations/conversations-router.js';
import { adminRouter } from './admin/admin-router.js';
import { mountWorkspaceUploads, workspaceRouter } from './workspace/workspace-router.js';
import { publicPricingRouter } from './api/public-pricing.js';
import { publicTrustRouter } from './security/trust/public-api.js';
import { ragUploadRouter } from './api/rag-upload-api.js';
import { toolStatusRouter } from './api/tool-status-api.js';
import { runtimeToolsRouter } from './api/runtime-tools-api.js';
import { mutationApiRouter } from './api/mutation-api.js';
import { contactsSyncRouter } from './api/contacts-sync-api.js';
import { companiesHouseRouter } from './api/companies-house-api.js';
import { capabilityCheckRouter } from './api/capability-check-api.js';
import { onboardingRouter } from './api/onboarding-api.js';
import { channelConfigApiRouter } from './api/channel-config-api.js';
import { settingsApiRouter } from './api/settings-api.js';
import { githubAgentSyncRouter } from './api/github-agent-sync-api.js';
import { channelShieldRouter, emailShieldAliasRouter } from './channel-shield/index.js';
import { startPropertyChannelRenderWorker } from './content/media-pipeline/render-queue.js';
import { startPropertyChannelCadenceScheduler } from './workflows/templates/property-channel/cadence-scheduler.js';
import { startMonthlyPnLScheduler } from './finance/pnl-scheduler.js';

/**
 * Aiva product routers and Scout mounts were removed 2026-11-22.
 * Archived under archive/carina-stripped-aiva-scout-20261122/.
 * Aiva now lives on Hermes (aiva2 / malike2356/aiva). Scout is malike2356/scout.
 */
export function mountCloudRawRoutes(app: Express): void {
  mountCloudWebhook(app);
  mountPaddleWebhook(app);
  if (isAiWorkersEnabled()) {
    mountChannelWebhooks(app);
  }
}

export function mountServerRoutes(app: Express): void {
  mountEmailRoutes(app);
  app.post('/app/auth/register', registerCloudOrg);
  app.post('/app/auth/login', loginCloudOrg);
  app.use('/api/public/pricing', publicPricingRouter);
  app.use('/api/public/trust', publicTrustRouter);
  app.use('/api/document-vault', documentVaultDeliveryRouter);
  app.use('/api/document-vault', documentVaultSearchOpsRouter);
  app.use('/api/internal/channels', channelConfigApiRouter);
  app.use('/api/internal/settings', settingsApiRouter);
  app.use('/api/agent-sync', githubAgentSyncRouter);
  app.use('/api/carina-ops/rag', ragUploadRouter);
  app.use('/api/carina-ops/credentials', toolStatusRouter);
  app.use('/api/carina-ops/tools', runtimeToolsRouter);
  app.use('/api/mutation', mutationApiRouter);
  app.use('/api/contacts-sync', contactsSyncRouter);
  app.use('/api/contacts', contactsSyncRouter);
  app.use('/api/companies-house', companiesHouseRouter);
  app.use('/api/capabilities', capabilityCheckRouter);
  app.use('/api/onboarding', onboardingRouter);
  app.use('/api/cloud', cloudRouter);
  app.use('/api/incident-blog', incidentBlogRouter);
  if (isAiWorkersEnabled()) {
    startPropertyChannelRenderWorker();
    startPropertyChannelCadenceScheduler();
    startMonthlyPnLScheduler();
    mountPaddleCheckoutRoute(app);
    app.use('/api/aiva/property-channel', youtubeChannelAnalyticsRouter);
    app.use('/api/aiva/youtube-channel', youtubeChannelAnalyticsRouter);
    app.use('/api/webhooks', zoomWebhookRouter);
    app.use('/api/webhooks', googleCalendarWebhookRouter);
    registerVicalSideEffects();
    app.use('/api/aiva/channel-shield', channelShieldRouter);
    app.use('/api/aiva/email-shield', emailShieldAliasRouter);
    app.use('/api/inbound', propreneurHubReplyRouter);
    app.use('/api/conversations', conversationsRouter);
    app.use('/api/channels', channelsApiRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api/workspace', workspaceRouter);
    mountWorkspaceUploads(app);
    mountWidgetRoutes(app);
  }
}

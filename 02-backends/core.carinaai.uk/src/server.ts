import type { Express } from 'express';
import { mountCloudWebhook, cloudRouter, loginCloudOrg, registerCloudOrg } from './api/cloud/router.js';
import { mountPaddleWebhook } from './api/routes/paddle-webhook-route.js';
import { mountPaddleCheckoutRoute } from './api/routes/paddle-checkout-route.js';
import { incidentBlogRouter } from './api/incident-blog.js';
import { aivaRouter } from './api/workspace-api.js';
import { aivaEmailRouter } from './api/workspace-email-api.js';
import { aivaEmailOAuthRouter } from './api/aiva-email-oauth-api.js';
import { aivaToolsOAuthRouter } from './api/aiva-tools-oauth-api.js';
import { aivaYouTubeOAuthRouter } from './api/aiva-youtube-oauth-api.js';
import { aivaPropertyChannelRouter, aivaYouTubeChannelRouter } from './api/aiva-property-channel-api.js';
import { aivaOutreachRouter } from './api/aiva-outreach-api.js';
import { aivaVicalRouter } from './api/aiva-vical-api.js';
import { registerVicalSideEffects } from './vical/side-effects.js';
import { youtubeChannelAnalyticsRouter } from './analytics/youtube-channel/dashboard-api.js';
import { aivaSocialOAuthRouter } from './api/aiva-social-oauth-api.js';
import { aivaSocialApprovalRouter } from './api/aiva-social-approval-api.js';
import { aivaN8nIntegrationRouter } from './api/aiva-n8n-integration-api.js';
import { aivaEmailApprovalRouter } from './api/aiva-email-approval-api.js';
import {
  aivaHostedEmailInboundRouter,
  aivaHostedEmailRouter,
} from './api/aiva-hosted-email-api.js';
import { aivaPropreneurWebhookRouter } from './api/aiva-propreneur-webhook-api.js';
import { aivaPropreneurSyncHealthRouter } from './api/aiva-propreneur-sync-health-api.js';
import { aivaPropreneurSessionRouter } from './api/aiva-propreneur-session-api.js';
import { propreneurHubReplyRouter } from './api/propreneur-hub-reply-api.js';
import { isAiWorkersEnabled } from './workers/workspace-message-handler.js';
import { isEmailIngestionActive, isPropreneurBridgeEnabled } from './workers/aiva-feature-flags.js';
import { isGoogleRecorderActive } from './ingestion/google-recorder/recorder-config.js';
import { aivaGoogleRecorderRouter } from './api/aiva-google-recorder-api.js';
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
import { companiesHouseRouter } from './api/companies-house-api.js';
import { capabilityCheckRouter } from './api/capability-check-api.js';
import { onboardingRouter } from './api/onboarding-api.js';
import { channelConfigApiRouter } from './api/channel-config-api.js';
import { settingsApiRouter } from './api/settings-api.js';
import { githubAgentSyncRouter } from './api/github-agent-sync-api.js';
import { channelShieldRouter, emailShieldAliasRouter } from './channel-shield/index.js';
import { workspaceOpsRouter } from './aiva/workspace-ops/index.js';
import { startAivaLearningReviewScheduler } from './memory/aiva/learning-loop.js';
import { startPropertyChannelRenderWorker } from './content/media-pipeline/render-queue.js';
import { startPropertyChannelCadenceScheduler } from './workflows/templates/property-channel/cadence-scheduler.js';

export function mountCloudRawRoutes(app: Express): void {
  mountCloudWebhook(app);
  mountPaddleWebhook(app);
  if (isAiWorkersEnabled()) {
    mountChannelWebhooks(app);
    mountAivaSocialInbound(app);
    // Hosted email catch-all inbound. Provider handlers verify their own webhook trust.
    app.use('/api/aiva/email/inbound', aivaHostedEmailInboundRouter);
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
    startAivaLearningReviewScheduler();
    startPropertyChannelRenderWorker();
    startPropertyChannelCadenceScheduler();
    mountPaddleCheckoutRoute(app);
    app.use('/api/aiva/analytics', aivaAnalyticsRouter);
    app.use('/api/analytics', aivaAnalyticsRouter);
    app.use('/api/aiva', aivaRouter);
    app.use('/api/aiva', aivaHostedEmailRouter);
    app.use('/api/aiva/tools/oauth', aivaToolsOAuthRouter);
    app.use('/api/aiva/youtube/oauth', aivaYouTubeOAuthRouter);
    app.use('/api/aiva/property-channel', youtubeChannelAnalyticsRouter);
    app.use('/api/aiva/property-channel', aivaPropertyChannelRouter);
    app.use('/api/aiva/youtube-channel', youtubeChannelAnalyticsRouter);
    app.use('/api/aiva/youtube-channel', aivaYouTubeChannelRouter);
    app.use('/api/aiva/outreach', aivaOutreachRouter);
    app.use('/api/aiva/vical', aivaVicalRouter);
    registerVicalSideEffects();
    if (isEmailIngestionActive() || isPropreneurBridgeEnabled()) {
      app.use('/api/aiva/email', aivaEmailRouter);
      app.use('/api/aiva/email/oauth', aivaEmailOAuthRouter);
      app.use('/api/aiva/email/approvals', aivaEmailApprovalRouter);
    }
    app.use('/api/aiva/social/oauth', aivaSocialOAuthRouter);
    app.use('/api/aiva/social/approvals', aivaSocialApprovalRouter);
    app.use('/api/aiva/integrations/n8n', aivaN8nIntegrationRouter);
    app.use('/api/aiva/webhooks', aivaPropreneurWebhookRouter);
    app.use('/api/aiva', aivaPropreneurSyncHealthRouter);
    app.use('/api/aiva', aivaPropreneurSessionRouter);
    app.use('/api/aiva/channel-shield', channelShieldRouter);
    app.use('/api/aiva/email-shield', emailShieldAliasRouter);
    app.use('/api/aiva/workspace-ops', workspaceOpsRouter);
    if (isGoogleRecorderActive()) {
      app.use('/api/aiva/google-recorder', aivaGoogleRecorderRouter);
    }
    app.use('/api/inbound', propreneurHubReplyRouter);
    app.use('/api/conversations', conversationsRouter);
    app.use('/api/channels', channelsApiRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api/workspace', workspaceRouter);
    mountWorkspaceUploads(app);
    mountWidgetRoutes(app);
  }
}

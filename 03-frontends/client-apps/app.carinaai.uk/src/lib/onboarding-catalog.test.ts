import { describe, expect, it } from 'vitest';
import {
  CUSTOM_ONBOARDING_TEMPLATE,
  getOnboardingChannels,
  mapMarketplaceTemplates,
  resolveChannelSetupUrl,
} from './onboarding-catalog';

describe('onboarding-catalog', () => {
  it('lists quick-connect channels in setup-ease order', () => {
    const channels = getOnboardingChannels();
    expect(channels.map((entry) => entry.channelId)).toEqual([
      'web',
      'telegram',
      'whatsapp',
      'email',
      'slack',
    ]);
    expect(channels[0]?.setupEase).toBeGreaterThan(channels.at(-1)?.setupEase ?? 0);
  });

  it('appends the custom template to marketplace templates', () => {
    const templates = mapMarketplaceTemplates({
      templates: [{
        templateId: 'support-agent',
        name: 'Support Agent',
        icon: 'headphones',
        tagline: 'Support',
        tier: 'starter',
        tierLabel: 'Starter',
        setupTimeSeconds: 45,
      }],
    });
    expect(templates.at(-1)).toEqual(CUSTOM_ONBOARDING_TEMPLATE);
  });

  it('builds worker channel setup URLs when a worker exists', () => {
    expect(resolveChannelSetupUrl('telegram', 'worker-1')).toBe('/aiva/workers/worker-1/channels');
    expect(resolveChannelSetupUrl('telegram')).toBe('/channels/telegram');
  });
});

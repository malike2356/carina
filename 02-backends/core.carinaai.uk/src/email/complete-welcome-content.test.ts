import { describe, expect, it } from 'vitest';
import {
  buildCompleteWelcomeEmailData,
  channelQuickStartInstruction,
  completeWelcomeSubject,
  quickStartBullets,
} from './complete-welcome-content.js';

describe('complete-welcome-content', () => {
  it('builds domain-specific quick start bullets', () => {
    const bullets = quickStartBullets('customer_support');
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toContain('support question');
  });

  it('formats telegram quick start with bot handle', () => {
    expect(channelQuickStartInstruction('telegram', '123:abc')).toContain('Telegram');
    expect(channelQuickStartInstruction('telegram', 'MyWorkerBot')).toContain('@MyWorkerBot');
  });

  it('builds complete welcome data with pending channel setup', () => {
    const data = buildCompleteWelcomeEmailData({
      firstName: 'Alex',
      workerName: 'Support Agent',
      workerRole: 'Handles customer emails',
      templateDomain: 'customer_support',
      tier: 'starter',
      workerId: 'worker-1',
      selectedChannelId: 'telegram',
      connectedChannels: [],
    });

    expect(data.pendingChannel?.type).toBe('Telegram');
    expect(data.channelSetupUrls.Telegram).toContain('/channels/telegram');
    expect(data.workspaceUrl).toContain('/aiva');
    expect(data.apkUrl).toContain('/downloads/carina-mobile.apk');
    expect(completeWelcomeSubject('Support Agent')).toBe("Hey, I'm Support Agent!");
  });

  it('uses connected channel details when present', () => {
    const data = buildCompleteWelcomeEmailData({
      firstName: 'Alex',
      workerName: 'Support Agent',
      workerRole: 'Handles customer emails',
      templateDomain: 'customer_support',
      tier: 'trial',
      workerId: 'worker-1',
      selectedChannelId: 'email',
      connectedChannels: [{ channel: 'email', identifier: 'support@mail.carinaai.uk' }],
    });

    expect(data.connectedChannel?.name).toBe('support@mail.carinaai.uk');
    expect(data.pendingChannel).toBeUndefined();
  });
});

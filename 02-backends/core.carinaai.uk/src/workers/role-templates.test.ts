import { describe, expect, it } from 'vitest';
import { getRoleTemplate } from './role-templates.js';
import { templateHasSocialPresenceCapability } from './worker-capability-context.js';
import { buildPersonaPrompt } from './persona-builder.js';

describe('role-templates social presence', () => {
  it('social-media-manager includes native social default channels', () => {
    const template = getRoleTemplate('social-media-manager');
    expect(template).toBeTruthy();
    expect(template?.defaultChannels).toEqual(
      expect.arrayContaining(['linkedin', 'instagram', 'messenger', 'twitter', 'web']),
    );
    expect(templateHasSocialPresenceCapability(template!)).toBe(true);
  });

  it('social-media-manager persona includes approval inbox guidance', () => {
    const template = getRoleTemplate('social-media-manager');
    const prompt = buildPersonaPrompt('Aria', template!, 'Brand voice: confident and warm.');
    expect(prompt).toContain('approval inbox');
    expect(prompt).toContain('LIVE WORKER CONTEXT');
    expect(prompt).toContain('Process inbound social DMs');
  });

  it('email-handler persona does not include social capability block', () => {
    const template = getRoleTemplate('email-handler');
    expect(templateHasSocialPresenceCapability(template!)).toBe(false);
    const prompt = buildPersonaPrompt('Inbox', template!);
    expect(prompt).not.toContain('LIVE WORKER CONTEXT');
    expect(prompt).not.toContain('Native social channels');
  });
});

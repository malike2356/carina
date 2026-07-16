import { describe, expect, it } from 'vitest';
import { looksLikeCaptcha } from './browser-assists.js';
import { loadDepthFeatures } from './features.js';
import { matchSaveAsSkillPhrase } from './conversational-skills.js';
import { verifyGoogleToolsOAuthState, signGoogleToolsOAuthState } from './google-tools-oauth-state.js';

describe('aiva polish features v3', () => {
  it('loads realtime voice, browser captcha, and org strict scoping flags', () => {
    const features = loadDepthFeatures(true);
    expect(features.version).toBeGreaterThanOrEqual(3);
    expect(features.voice.duplexProvider).toBe('realtime');
    expect(features.voice.bargeIn).toBe(true);
    expect(features.browser.captchaMode).toBe('owner_assist');
    expect(features.orgs.strictScoping).toBe(true);
    expect(features.tools?.accountsEnabled).toBe(true);
  });
});

describe('captcha heuristics', () => {
  it('detects common challenge markers', () => {
    expect(looksLikeCaptcha('<div class="g-recaptcha"></div>')).toBe(true);
    expect(looksLikeCaptcha('Welcome to example.com')).toBe(false);
  });
});

describe('google oauth account mode state', () => {
  it('signs and verifies account mode without workerId', () => {
    process.env.CHANNEL_CREDENTIAL_KEY = process.env.CHANNEL_CREDENTIAL_KEY || 'test-polish-secret-key-32chars!!';
    const state = signGoogleToolsOAuthState({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      workerId: '',
      toolSlug: 'gmail',
      redirectUri: 'https://example.test/callback',
      returnPath: '/aiva/tools',
      mode: 'account',
    });
    const parsed = verifyGoogleToolsOAuthState(state);
    expect(parsed?.mode).toBe('account');
    expect(parsed?.toolSlug).toBe('gmail');
    expect(parsed?.returnPath).toBe('/aiva/tools');
  });
});

describe('conversational save still works', () => {
  it('matches phrases', () => {
    expect(matchSaveAsSkillPhrase('save this as a skill')).toBeTruthy();
  });
});

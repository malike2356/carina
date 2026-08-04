import { describe, expect, it } from 'vitest';
import {
  defaultPlatformFlags,
  isFeatureEnabled,
  parseFeatureOverrides,
  resolveAllWorkspaceFeatures,
  resolveWorkspaceFeature,
  getWorkspaceFeature,
  featureRequiredForPath,
} from './workspace-features';

describe('workspace feature resolution', () => {
  it('enables a feature when workspace override is true', () => {
    expect(
      isFeatureEnabled('ai_chat_assistant', { ai_chat_assistant: true }),
    ).toBe(true);
  });

  it('disables a feature when workspace override is false', () => {
    expect(
      isFeatureEnabled('ai_chat_assistant', { ai_chat_assistant: false }),
    ).toBe(false);
  });

  it('defers to platform default when no override exists', () => {
    const resolved = resolveWorkspaceFeature(
      getWorkspaceFeature('ai_chat_assistant'),
      {},
    );
    expect(resolved.enabled).toBe(true);
    expect(resolved.source).toBe('platform_default');
    expect(resolved.overridden).toBe(false);
  });

  it('defers to platform default when override is removed', () => {
    const overrides = parseFeatureOverrides({ ai_chat_assistant: false });
    delete overrides.ai_chat_assistant;
    const resolved = resolveWorkspaceFeature(
      getWorkspaceFeature('ai_chat_assistant'),
      overrides,
    );
    expect(resolved.enabled).toBe(true);
    expect(resolved.source).toBe('platform_default');
    expect(Object.keys(overrides)).toEqual([]);
  });

  it('treats empty overrides as platform defaults for all features', () => {
    const all = resolveAllWorkspaceFeatures({});
    expect(all.every((feature) => !feature.overridden || feature.alwaysOn)).toBe(true);
    expect(all.find((feature) => feature.key === 'document_vault')?.enabled).toBe(true);
  });

  it('ignores unknown keys and non-boolean values when parsing overrides', () => {
    expect(
      parseFeatureOverrides({
        ai_chat_assistant: true,
        unknown_feature: false,
        ai_reports: 'yes',
        nested: { bad: true },
      }),
    ).toEqual({ ai_chat_assistant: true });
  });

  it('marks core features as always on with no toggle', () => {
    const vault = resolveWorkspaceFeature(getWorkspaceFeature('document_vault'), {
      document_vault: false,
    });
    expect(vault.enabled).toBe(true);
    expect(vault.alwaysOn).toBe(true);
    expect(vault.toggleable).toBe(false);
    expect(vault.source).toBe('always_on');
  });

  it('respects platform kill-switch even when workspace override is true', () => {
    const flags = defaultPlatformFlags();
    flags.ai_chat_assistant = false;
    const resolved = resolveWorkspaceFeature(
      getWorkspaceFeature('ai_chat_assistant'),
      { ai_chat_assistant: true },
      flags,
    );
    expect(resolved.enabled).toBe(false);
    expect(resolved.source).toBe('platform_disabled');
  });

  it('maps gated paths to the correct feature', () => {
    expect(featureRequiredForPath('/research')).toBe('ai_agent_tools');
    expect(featureRequiredForPath('/api/carina/chat')).toBe('ai_chat_assistant');
    expect(featureRequiredForPath('/api/karina/chat')).toBe('ai_chat_assistant');
    expect(featureRequiredForPath('/analytics')).toBe('activity_analytics');
    expect(featureRequiredForPath('/contacts')).toBe('contacts');
    expect(featureRequiredForPath('/outreach')).toBe('outreach');
    expect(featureRequiredForPath('/aiva/outreach')).toBe('outreach');
    expect(featureRequiredForPath('/email')).toBe('email');
    expect(featureRequiredForPath('/aiva/workers')).toBe('ai_workers');
    expect(featureRequiredForPath('/aiva/approvals')).toBe('approvals');
    expect(featureRequiredForPath('/calendar')).toBe('calendar');
    expect(featureRequiredForPath('/channels')).toBe('channels');
    expect(featureRequiredForPath('/aiva/youtube-channel')).toBe('youtube_channel');
    expect(featureRequiredForPath('/aiva/outreach')).toBe('outreach');
    expect(featureRequiredForPath('/aiva/outreach/channels/youtube')).toBe('outreach');
    expect(featureRequiredForPath('/documents')).toBeNull();
    expect(featureRequiredForPath('/settings')).toBeNull();
    expect(featureRequiredForPath('/billing')).toBeNull();
  });

  it('includes workspace modules in the default catalogue', () => {
    const all = resolveAllWorkspaceFeatures({});
    expect(all.some((feature) => feature.key === 'contacts' && feature.enabled)).toBe(true);
    expect(all.some((feature) => feature.key === 'ai_workers' && feature.category === 'workspace')).toBe(true);
    expect(all.filter((feature) => feature.category === 'workspace').length).toBeGreaterThanOrEqual(9);
  });
});

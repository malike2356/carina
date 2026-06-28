import { describe, expect, it } from 'vitest';
import { isOpsMachineApiPath, isPublicHostedPath } from './web-auth.js';

describe('web-auth', () => {
  it('marks hosted auth paths as public', () => {
    expect(isPublicHostedPath('/hosted-login')).toBe(true);
    expect(isPublicHostedPath('/hosted-register')).toBe(true);
    expect(isPublicHostedPath('/app/auth/login')).toBe(true);
    expect(isPublicHostedPath('/app/auth/register')).toBe(true);
    expect(isPublicHostedPath('/api/cloud/auth/login')).toBe(true);
    expect(isPublicHostedPath('/api/cloud/auth/register')).toBe(true);
    expect(isPublicHostedPath('/webhooks/telegram')).toBe(true);
    expect(isPublicHostedPath('/api/channels/webhook/slack')).toBe(true);
    expect(isPublicHostedPath('/api/channels/webhook/telegram/00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isPublicHostedPath('/api/widget/00000000-0000-4000-8000-000000000001/config')).toBe(true);
    expect(isPublicHostedPath('/health')).toBe(true);
    expect(isPublicHostedPath('/i18n.js')).toBe(true);
    expect(isPublicHostedPath('/manifest.json')).toBe(true);
    expect(isPublicHostedPath('/favicon.ico')).toBe(true);
    expect(isPublicHostedPath('/api/chat')).toBe(false);
  });

  it('allows ops bearer on machine-readable API paths', () => {
    expect(isOpsMachineApiPath('/api/providers', 'GET')).toBe(true);
    expect(isOpsMachineApiPath('/api/health', 'GET')).toBe(true);
    expect(isOpsMachineApiPath('/api/ops/skill-packs', 'GET')).toBe(true);
    expect(isOpsMachineApiPath('/api/ops/skill-packs', 'PUT')).toBe(true);
    expect(isOpsMachineApiPath('/api/carina-ops/admin/margins', 'GET')).toBe(true);
    expect(isOpsMachineApiPath('/api/chat/stream', 'GET')).toBe(true);
    expect(isOpsMachineApiPath('/api/security/dashboard', 'GET')).toBe(true);
    expect(isOpsMachineApiPath('/api/security/dashboard/stream', 'GET')).toBe(true);
    expect(isOpsMachineApiPath('/api/mcp', 'GET')).toBe(true);
    expect(isOpsMachineApiPath('/api/mcp/filesystem/test', 'POST')).toBe(true);
    expect(isOpsMachineApiPath('/api/transcribe', 'POST')).toBe(true);
    expect(isOpsMachineApiPath('/api/chat/send', 'POST')).toBe(false);
    expect(isOpsMachineApiPath('/', 'GET')).toBe(false);
  });

  it('allows ops health check without session', () => {
    expect(isPublicHostedPath('/api/carina-ops/health')).toBe(true);
  });

  it('keeps ops console paths protected', () => {
    expect(isPublicHostedPath('/ops')).toBe(false);
    expect(isPublicHostedPath('/ops/workbench')).toBe(false);
  });

  it('keeps tenant Aiva management APIs protected from hosted session bypass', () => {
    expect(isPublicHostedPath('/api/aiva/workers')).toBe(false);
    expect(isPublicHostedPath('/api/channels')).toBe(false);
  });

  it('allows ops static assets without listing every file', () => {
    expect(isPublicHostedPath('/ops/assets/ops.css')).toBe(true);
    expect(isPublicHostedPath('/ops/assets/layout.js')).toBe(true);
  });
});

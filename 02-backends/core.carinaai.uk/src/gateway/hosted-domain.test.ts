import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: {
    hosted: { appHost: 'app.carinaai.uk', operatorHosts: ['core.carinaai.uk'], enabled: true },
    product: { domain: 'carinaai.uk' },
  },
}));

import {
  canonicalAppHost,
  isCanonicalAppHost,
  isControlPlaneHost,
  normaliseHost,
} from './hosted-domain.js';

describe('hosted-domain', () => {
  const prevAppHost = process.env.CARINA_HOSTED_APP_HOST;
  const prevControl = process.env.CARINA_CONTROL_PLANE_HOSTS;
  const prevOperator = process.env.CARINA_OPERATOR_HOSTS;

  beforeEach(() => {
    process.env.CARINA_HOSTED_APP_HOST = 'app.carinaai.uk';
    process.env.CARINA_CONTROL_PLANE_HOSTS = 'core.carinaai.uk,ops.carinaai.uk';
    process.env.CARINA_OPERATOR_HOSTS = 'core.carinaai.uk,localhost';
  });

  afterEach(() => {
    if (prevAppHost === undefined) delete process.env.CARINA_HOSTED_APP_HOST;
    else process.env.CARINA_HOSTED_APP_HOST = prevAppHost;
    if (prevControl === undefined) delete process.env.CARINA_CONTROL_PLANE_HOSTS;
    else process.env.CARINA_CONTROL_PLANE_HOSTS = prevControl;
    if (prevOperator === undefined) delete process.env.CARINA_OPERATOR_HOSTS;
    else process.env.CARINA_OPERATOR_HOSTS = prevOperator;
  });

  it('normalises hostnames', () => {
    expect(normaliseHost('APP.CarinaAI.UK:443')).toBe('app.carinaai.uk');
  });

  it('detects canonical app host', () => {
    expect(canonicalAppHost()).toBe('app.carinaai.uk');
    expect(isCanonicalAppHost('app.carinaai.uk')).toBe(true);
    expect(isCanonicalAppHost('workspace.client.example')).toBe(false);
  });

  it('treats control plane hosts separately from customer domains', () => {
    expect(isControlPlaneHost('core.carinaai.uk')).toBe(true);
    expect(isControlPlaneHost('ops.carinaai.uk')).toBe(true);
    expect(isControlPlaneHost('workspace.client.example')).toBe(false);
  });
});

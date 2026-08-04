import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { isHostedRequest, isOperatorHost, operatorHosts } from './hosted-domain.js';

describe('hosted-domain', () => {
  const prevHosted = process.env.HOSTED_MODE;
  const prevHosts = process.env.CARINA_OPERATOR_HOSTS;

  beforeEach(() => {
    process.env.HOSTED_MODE = 'true';
    process.env.CARINA_OPERATOR_HOSTS = 'core.carinaai.uk,localhost';
  });

  afterEach(() => {
    process.env.HOSTED_MODE = prevHosted;
    process.env.CARINA_OPERATOR_HOSTS = prevHosts;
  });

  it('treats core.carinaai.uk as operator host', () => {
    expect(isOperatorHost('core.carinaai.uk')).toBe(true);
    expect(isHostedRequest('core.carinaai.uk')).toBe(false);
  });

  it('treats app.carinaai.uk as hosted when mode enabled', () => {
    expect(isOperatorHost('app.carinaai.uk')).toBe(false);
    expect(isHostedRequest('app.carinaai.uk')).toBe(true);
  });

  it('treats localhost as operator host', () => {
    expect(operatorHosts()).toContain('localhost');
    expect(isHostedRequest('localhost')).toBe(false);
  });
});

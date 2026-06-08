import { describe, expect, it } from 'vitest';
import { parseDeployArgs } from '../deploy-command.js';

describe('deploy command', () => {
  it('parses proxy mode arguments', () => {
    expect(parseDeployArgs(['--mode', 'proxy', '--target', 'http://localhost:3000', '--port', '3001'])).toEqual({
      mode: 'proxy',
      target: 'http://localhost:3000',
      port: 3001,
    });
  });
});

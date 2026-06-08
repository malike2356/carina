import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { PROVIDER_CAPABILITIES } from './provider-capabilities.js';

describe('PROVIDER_CAPABILITIES', () => {
  it('only contains model providers present in config', () => {
    const configPath = path.resolve(process.cwd(), 'src/config/index.ts');
    const configSource = fs.readFileSync(configPath, 'utf8');
    const configuredProviders = ['deepseek', 'openai', 'anthropic'].filter((provider) =>
      configSource.includes(`${provider}: {`),
    );

    expect(Object.keys(PROVIDER_CAPABILITIES).sort()).toEqual(configuredProviders.sort());
  });

  it('marks every provider as chat capable', () => {
    for (const capabilities of Object.values(PROVIDER_CAPABILITIES)) {
      expect(capabilities.chat).toBe(true);
    }
  });
});

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfigValue, loadFromYaml, setConfigValue, writeConfig } from './loader.js';

let tmpDir = '';
let oldDefaultProvider: string | undefined;
let oldDefaultModel: string | undefined;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-config-'));
  oldDefaultProvider = process.env.DEFAULT_PROVIDER;
  oldDefaultModel = process.env.DEFAULT_MODEL;
  delete process.env.DEFAULT_PROVIDER;
  delete process.env.DEFAULT_MODEL;
});

afterEach(async () => {
  if (oldDefaultProvider === undefined) delete process.env.DEFAULT_PROVIDER;
  else process.env.DEFAULT_PROVIDER = oldDefaultProvider;
  if (oldDefaultModel === undefined) delete process.env.DEFAULT_MODEL;
  else process.env.DEFAULT_MODEL = oldDefaultModel;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('CLI config loader', () => {
  it('merges YAML with defaults', async () => {
    const configPath = path.join(tmpDir, 'config.yaml');
    await fs.writeFile(configPath, 'provider: openai\nproviders:\n  openai:\n    api_key: test-key\n');

    const config = await loadFromYaml(configPath);

    expect(config.provider).toBe('openai');
    expect(config.model).toBe('deepseek-chat');
    expect(config.providers.openai.api_key).toBe('test-key');
    expect(config.providers.deepseek.model).toBe('deepseek-chat');
  });

  it('round-trips config set and get', async () => {
    const configPath = path.join(tmpDir, 'config.yaml');
    const config = await loadFromYaml(configPath);
    await writeConfig(config, configPath);

    await setConfigValue('providers.deepseek.api_key', 'secret-value', configPath);

    await expect(getConfigValue('providers.deepseek.api_key', configPath)).resolves.toBe('secret-value');
  });

  it('persists Scout config settings', async () => {
    const configPath = path.join(tmpDir, 'config.yaml');
    await setConfigValue('scout.enabled', 'true', configPath);
    await setConfigValue('scout.url', 'http://localhost:3001', configPath);

    await expect(getConfigValue('scout.enabled', configPath)).resolves.toBe(true);
    await expect(getConfigValue('scout.url', configPath)).resolves.toBe('http://localhost:3001');
  });
});

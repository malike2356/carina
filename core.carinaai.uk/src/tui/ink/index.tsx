import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import { bootstrapInkTuiRuntime } from './bootstrap.js';

export interface InkTuiOptions {
  gatewayUrl?: string;
  sessionId?: string;
  version?: string;
}

export function launchInkTUI(options: InkTuiOptions = {}): () => void {
  const { unmount } = render(<App {...options} />, { exitOnCtrlC: true });
  return unmount;
}

export async function runInkTui(options: InkTuiOptions = {}): Promise<void> {
  const { ensureFirstRunReady } = await import('../../cli/first-run.js');
  await ensureFirstRunReady();

  const { initSkin } = await import('../skins/skin-store.js');
  initSkin();

  await bootstrapInkTuiRuntime();

  const { readPackageInfo } = await import('../../cli/registry.js');
  const pkg = readPackageInfo();

  const gatewayUrl = options.gatewayUrl
    ?? process.env.CARINA_GATEWAY_URL
    ?? 'local';

  launchInkTUI({
    ...options,
    gatewayUrl,
    version: options.version ?? pkg.version,
  });
}

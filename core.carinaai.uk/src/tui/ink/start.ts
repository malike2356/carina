export { runInkTui, launchInkTUI, type InkTuiOptions } from './index.js';

export async function startInkTUI(options: { sessionId?: string; gatewayUrl?: string; version?: string } = {}): Promise<void> {
  const { runInkTui } = await import('./index.js');
  await runInkTui(options);
}

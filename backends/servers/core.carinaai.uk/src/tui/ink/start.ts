export { runInkTui, launchInkTUI, type InkTuiOptions } from './index.js';

export async function startInkTUI(options: { sessionId?: string; gatewayUrl?: string; version?: string } = {}): Promise<void> {
  const { runInkTui } = await import('./index.js');

  if (!options.sessionId && !options.gatewayUrl) {
    await new Promise<void>((resolve) => {
      import('./launcher/index.js').then(({ renderLauncher }) => {
        renderLauncher({ version: options.version, onLaunchChat: resolve });
      }).catch(() => resolve());
    });
  }

  await runInkTui(options);
}

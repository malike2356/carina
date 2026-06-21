import type { Express } from 'express';

export type WebGatewayOptions = {
  localMode?: boolean;
  host?: string;
  port?: number;
};

export type WebPackage = {
  startWeb: (options?: WebGatewayOptions) => Promise<void>;
  createWebServer: (options?: WebGatewayOptions) => Promise<Express>;
};

const WEB_INSTALL_HINT =
  'Web UI not installed. Run: npm install @verlox/carina-web';

export function webInstallHint(): string {
  return WEB_INSTALL_HINT;
}

export async function importWebPackage(): Promise<WebPackage | null> {
  try {
    const mod = await import('@verlox/carina-web') as WebPackage;
    return mod;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ERR_MODULE_NOT_FOUND') return null;
    throw err;
  }
}

export async function startWebGateway(
  options: WebGatewayOptions = {},
): Promise<boolean> {
  const web = await importWebPackage();
  if (!web) {
    console.warn(WEB_INSTALL_HINT);
    return false;
  }
  await web.startWeb(options);
  return true;
}

export type KeprixConfig = {
  apiBaseUrl: string;
  studioBaseUrl: string;
  serviceToken: string;
  handoffSecret: string;
};

function trimUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/$/, '');
}

export function readKeprixConfig(): KeprixConfig {
  const studioBaseUrl = trimUrl(process.env.KEPRIX_STUDIO_BASE_URL);
  const apiBaseUrl = trimUrl(process.env.KEPRIX_API_BASE_URL) || studioBaseUrl;
  return {
    apiBaseUrl,
    studioBaseUrl: studioBaseUrl || apiBaseUrl,
    serviceToken: (process.env.KEPRIX_SERVICE_TOKEN ?? '').trim(),
    handoffSecret: (process.env.KEPRIX_HANDOFF_SECRET ?? '').trim(),
  };
}

export function isKeprixStudioConfigured(config: KeprixConfig = readKeprixConfig()): boolean {
  return Boolean(config.apiBaseUrl && config.studioBaseUrl);
}

export function isKeprixHandoffConfigured(config: KeprixConfig = readKeprixConfig()): boolean {
  return isKeprixStudioConfigured(config) && config.handoffSecret.length >= 16;
}

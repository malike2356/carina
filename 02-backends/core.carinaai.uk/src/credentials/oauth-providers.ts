import type { OAuthProviderDefinition } from './types.js';

export const OAUTH_PROVIDERS: OAuthProviderDefinition[] = [
  {
    name: 'github',
    displayName: 'GitHub',
    clientIdEnv: 'GITHUB_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GITHUB_OAUTH_CLIENT_SECRET',
    scope: 'read:user repo',
    deviceCodeUrl: 'https://github.com/login/device/code',
    tokenUrl: 'https://github.com/login/oauth/access_token',
  },
  {
    name: 'google',
    displayName: 'Google',
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    scope: 'openid email profile https://www.googleapis.com/auth/generative-language.retriever https://www.googleapis.com/auth/contacts',
    deviceCodeUrl: 'https://oauth2.googleapis.com/device/code',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
  {
    name: 'azure',
    displayName: 'Microsoft Azure',
    clientIdEnv: 'AZURE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'AZURE_OAUTH_CLIENT_SECRET',
    scope: 'https://cognitiveservices.azure.com/.default offline_access',
    deviceCodeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  },
  {
    name: 'openai',
    displayName: 'OpenAI (OAuth)',
    clientIdEnv: 'OPENAI_OAUTH_CLIENT_ID',
    clientSecretEnv: 'OPENAI_OAUTH_CLIENT_SECRET',
    scope: 'openid profile email offline_access',
    deviceCodeUrl: 'https://auth.openai.com/oauth/device/code',
    tokenUrl: 'https://auth.openai.com/oauth/token',
  },
];

export const OAUTH_PROVIDER_MAP = Object.fromEntries(
  OAUTH_PROVIDERS.map((p) => [p.name, p]),
) as Record<string, OAuthProviderDefinition>;

export function isOAuthProviderConfigured(def: OAuthProviderDefinition): boolean {
  return Boolean(process.env[def.clientIdEnv]?.trim());
}

export function oauthClientCredentials(def: OAuthProviderDefinition): {
  clientId: string;
  clientSecret?: string;
} {
  const clientId = process.env[def.clientIdEnv]?.trim() ?? '';
  const clientSecret = def.clientSecretEnv
    ? process.env[def.clientSecretEnv]?.trim()
    : undefined;
  return { clientId, clientSecret: clientSecret || undefined };
}

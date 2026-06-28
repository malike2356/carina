declare module 'node-saml' {
  export interface SamlOptions {
    issuer?: string;
    callbackUrl?: string;
    entryPoint?: string;
    cert?: string;
    audience?: string;
    identifierFormat?: string;
    [key: string]: unknown;
  }

  export interface SamlProfile {
    nameID?: string;
    email?: string;
    [key: string]: unknown;
  }

  export class SAML {
    constructor(options: SamlOptions);
    getAuthorizeUrl(options?: { additionalParams?: Record<string, string>; RelayState?: string }): Promise<string>;
    validatePostResponse(body: { SAMLResponse?: string; RelayState?: string }): Promise<{ profile: SamlProfile }>;
  }
}

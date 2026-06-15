import crypto from 'crypto';

export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function signOAuth1Request(params: {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  nonce?: string;
  timestamp?: string;
}): Record<string, string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.consumerKey,
    oauth_nonce: params.nonce ?? crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: params.timestamp ?? String(Math.floor(Date.now() / 1000)),
    oauth_token: params.accessToken,
    oauth_version: '1.0',
  };

  const signatureKey = `${percentEncode(params.consumerSecret)}&${percentEncode(params.accessTokenSecret)}`;
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(oauthParams[key]!)}`)
    .join('&');

  const baseString = [
    params.method.toUpperCase(),
    percentEncode(params.url),
    percentEncode(paramString),
  ].join('&');

  oauthParams.oauth_signature = crypto
    .createHmac('sha1', signatureKey)
    .update(baseString)
    .digest('base64');

  return oauthParams;
}

export function formatOAuth1AuthorizationHeader(oauthParams: Record<string, string>): string {
  const header = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key]!)}"`)
    .join(', ');
  return `OAuth ${header}`;
}

export function buildTwitterCrcResponse(
  crcToken: string,
  consumerSecret: string,
): { response_token: string } {
  const digest = crypto.createHmac('sha256', consumerSecret).update(crcToken).digest('base64');
  return { response_token: `sha256=${digest}` };
}

export function verifyTwitterWebhookSignature(
  rawBody: string | Buffer,
  consumerSecret: string,
  signatureHeader: string,
): boolean {
  if (!consumerSecret || !signatureHeader) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expected = `sha256=${crypto.createHmac('sha256', consumerSecret).update(body).digest('base64')}`;
  try {
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signatureHeader);
    return expectedBuf.length === signatureBuf.length
      && crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

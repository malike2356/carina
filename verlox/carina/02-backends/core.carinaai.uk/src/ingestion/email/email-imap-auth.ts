import type { EmailConnection } from './email-connection-store.js';
import {
  getEmailCredentials,
  getEmailOAuthCredentials,
} from './email-connection-store.js';
import { getValidAccessToken } from './gmail-oauth.js';
import { refreshOutlookAccessToken } from './outlook-oauth.js';
import type { ImapAuth } from './imap-connector.js';

export async function resolveWorkerImapAuth(
  workerId: string,
  connection: EmailConnection,
): Promise<ImapAuth | null> {
  const passwordCreds = await getEmailCredentials(workerId);
  if (passwordCreds?.password) {
    return {
      type: 'password',
      params: {
        host: connection.imapHost,
        port: connection.imapPort,
        tls: connection.imapTls,
        username: passwordCreds.username,
        password: passwordCreds.password,
      },
    };
  }

  const oauth = await getEmailOAuthCredentials(workerId);
  if (!oauth) return null;

  const base = {
    host: connection.imapHost,
    port: connection.imapPort,
    tls: connection.imapTls,
    username: oauth.username,
  };

  if (connection.oauthProvider === 'gmail') {
    const accessToken = await getValidAccessToken(oauth.refreshToken);
    return { type: 'oauth2', params: { ...base, accessToken } };
  }

  if (connection.oauthProvider === 'outlook') {
    const accessToken = await refreshOutlookAccessToken(oauth.refreshToken);
    return { type: 'oauth2', params: { ...base, accessToken } };
  }

  return null;
}

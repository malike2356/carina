import { describe, expect, it } from 'vitest';
import { humanizeToolError } from '@/lib/humanize-tool-error';

describe('humanizeToolError', () => {
  it('parses Notion-style unauthorized JSON', () => {
    const raw = JSON.stringify({
      object: 'error',
      status: 401,
      code: 'unauthorized',
      message: 'API token is invalid.',
      request_id: 'abc',
    });
    expect(humanizeToolError(raw, 'Notion')).toMatch(/Notion: API token is invalid/i);
    expect(humanizeToolError(raw, 'Notion')).toMatch(/Guide me/);
  });

  it('strips HubSpot HTML 405 pages', () => {
    const raw =
      '<html> <head> <title>Error 405 Method Not Allowed</title> </head> <body>oops</body></html>';
    expect(humanizeToolError(raw, 'HubSpot')).toMatch(/method not allowed/i);
    expect(humanizeToolError(raw, 'HubSpot')).not.toMatch(/<html/i);
  });

  it('explains disabled Gmail API on a GCP project', () => {
    const raw = JSON.stringify({
      error: {
        code: 403,
        message:
          'Gmail API has not been used in project 420319712907 before or it is disabled. Enable it by visiting https://console.developers.google.com/...',
      },
    });
    const out = humanizeToolError(raw, 'Gmail');
    expect(out).toMatch(/Gmail API is not enabled/i);
    expect(out).toMatch(/420319712907/);
    expect(out).not.toMatch(/expired or was revoked/i);
  });

  it('explains unauthorized_client without calling it expired', () => {
    const raw = 'Google token refresh failed HTTP 401: unauthorized_client: Unauthorized';
    const out = humanizeToolError(raw, 'Gmail');
    expect(out).toMatch(/wrong OAuth client|Reconnect/i);
    expect(out).not.toMatch(/API token is invalid/i);
  });
});

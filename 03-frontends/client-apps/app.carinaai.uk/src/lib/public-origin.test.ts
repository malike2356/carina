import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { getPublicOrigin } from './public-origin';

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

describe('getPublicOrigin', () => {
  it('uses the forwarded public host instead of the internal bind address', () => {
    const request = new NextRequest('https://0.0.0.0:4100/api/aiva/email/oauth/gmail/callback', {
      headers: {
        host: '0.0.0.0:4100',
        'x-forwarded-host': 'admin.hireaiva.co.uk',
        'x-forwarded-proto': 'https',
      },
    });

    expect(getPublicOrigin(request)).toBe('https://admin.hireaiva.co.uk');
  });

  it('never returns a configured internal bind address', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://0.0.0.0:4100';
    const request = new NextRequest('https://0.0.0.0:4100/callback', {
      headers: { host: '0.0.0.0:4100' },
    });

    expect(getPublicOrigin(request)).toBe('https://app.carinaai.uk');
  });
});

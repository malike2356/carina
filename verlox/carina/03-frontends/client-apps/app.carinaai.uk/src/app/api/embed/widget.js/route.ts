import { resolveCoreUrl, resolvePublicCoreHttpUrl } from '@/lib/core-proxy';

export const dynamic = 'force-dynamic';

function widgetFetchUrl(): string {
  const internal = resolveCoreUrl().replace(/\/$/, '');
  if (internal.includes('carina-web') || internal.includes('localhost')) {
    return `${internal}/widget.js`;
  }
  return `${resolvePublicCoreHttpUrl().replace(/\/$/, '')}/widget.js`;
}

export async function GET(): Promise<Response> {
  const widgetUrl = widgetFetchUrl();
  let upstream: Response;
  try {
    upstream = await fetch(widgetUrl, { cache: 'no-store' });
  } catch {
    return new Response('// Could not reach core widget bundle', {
      status: 502,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }

  if (!upstream.ok) {
    return new Response('// Widget bundle unavailable on core', {
      status: upstream.status,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }

  const body = await upstream.text();
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'CDN-Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

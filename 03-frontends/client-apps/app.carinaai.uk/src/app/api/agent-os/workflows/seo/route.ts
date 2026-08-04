import { NextResponse } from 'next/server';
import { createAgentOsDocument } from '@/lib/agent-os-documents';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    keyword?: string;
    url?: string;
    notes?: string;
  };
  const keyword = String(body.keyword ?? '').trim() || 'agent workspace';
  const url = String(body.url ?? '').trim() || '(site notes only)';
  const notes = String(body.notes ?? '').trim();
  const title = `SEO draft: ${keyword}`;
  const content = `# ${title}

**Primary keyword:** ${keyword}  
**URL / notes:** ${url}

${notes ? `## Site notes\n${notes}\n` : ''}

## Outline
1. Intent
2. Problem framing
3. Solution sections
4. Internal links
5. CTA

## Draft
Write a clear article for operators evaluating ${keyword}. Keep claims honest.

## Internal link suggestions
- /agent-os
- /agent-os/capabilities
- /knowledge

## Limits
Google Search Console fetch is optional and only when that API is connected. This run is prep-only.
`;
  const result = await createAgentOsDocument(title, content);
  if ('error' in result) return result.error;
  return NextResponse.json({ data: result.document, href: `/documents/${result.document!.id}` });
}

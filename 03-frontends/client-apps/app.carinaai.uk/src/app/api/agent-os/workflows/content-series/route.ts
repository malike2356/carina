import { NextResponse } from 'next/server';
import { createAgentOsDocument } from '@/lib/agent-os-documents';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    topic?: string;
    audience?: string;
    platforms?: string;
  };
  const topic = String(body.topic ?? '').trim() || 'Product update';
  const audience = String(body.audience ?? '').trim() || 'operators';
  const platforms = String(body.platforms ?? '').trim() || 'LinkedIn, X, email';
  const title = `Content series: ${topic}`;
  const content = `# ${title}

**Audience:** ${audience}  
**Platforms:** ${platforms}

## Hooks
1. The quiet bottleneck in ${topic}
2. What ${audience} still do by hand
3. One change that compounds this week

## LinkedIn
Draft a 120-word post: problem, proof, ask.

## X
Thread of 4 posts: hook, insight, example, CTA.

## Email
Subject + 3-sentence body + single CTA.

## Captions
- Short
- Medium
- Long

## Human review
Create tasks before publishing. Do not auto-post.
`;
  const result = await createAgentOsDocument(title, content);
  if ('error' in result) return result.error;
  return NextResponse.json({ data: result.document, href: `/documents/${result.document.id}` });
}

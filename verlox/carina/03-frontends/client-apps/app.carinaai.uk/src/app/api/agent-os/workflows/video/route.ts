import { NextResponse } from 'next/server';
import { createAgentOsDocument } from '@/lib/agent-os-documents';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    topic?: string;
    audience?: string;
    minutes?: number;
  };
  const topic = String(body.topic ?? '').trim() || 'Product demo';
  const audience = String(body.audience ?? '').trim() || 'founders';
  const minutes = Number(body.minutes) > 0 ? Number(body.minutes) : 8;
  const title = `Video prep: ${topic}`;
  const content = `# ${title}

**Audience:** ${audience}  
**Length:** ~${minutes} minutes

## Script
1. Hook (15s)
2. Problem
3. Demo beats
4. CTA

## Storyboard
- Beat 1: title card
- Beat 2: screen share
- Beat 3: proof
- Beat 4: ask

## Description
One paragraph for the listing page.

## Tags
carina, agent-os, ${topic.toLowerCase().replace(/\s+/g, '-')}

## Thumbnail text
${topic}

## Gate
Do not upload to YouTube until a human confirms and a channel is connected.
`;
  const result = await createAgentOsDocument(title, content);
  if ('error' in result) return result.error;
  return NextResponse.json({ data: result.document, href: `/documents/${result.document!.id}` });
}

import { NextResponse } from 'next/server';
import { createAgentOsDocument } from '@/lib/agent-os-documents';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    product?: string;
    audience?: string;
  };
  const product = String(body.product ?? '').trim() || 'Carina';
  const audience = String(body.audience ?? '').trim() || 'new users';
  const title = `Onboarding path: ${product}`;
  const content = `# ${title}

**Audience:** ${audience}

## Welcome sequence
1. Why ${product}
2. First win in 10 minutes
3. Where to ask for help

## First-call prep
- Confirm goal
- Share Agent OS glass
- Run Hello recipe together

## System walkthrough
- Workers
- Approvals
- Memory Galaxy
- Workflows

## Day 1 checklist
- [ ] Hire or open a worker
- [ ] Run Hello
- [ ] Connect one channel (optional)

## Day 7 checklist
- [ ] Open Memory Galaxy
- [ ] Run 3 workflows or connect a channel
- [ ] Review approvals inbox

## Day 30 checklist
- [ ] Review usage by agent
- [ ] Clear approvals
- [ ] Confirm Soft Wall / billing understanding
`;
  const result = await createAgentOsDocument(title, content);
  if ('error' in result) return result.error;
  return NextResponse.json({ data: result.document, href: `/documents/${result.document!.id}` });
}

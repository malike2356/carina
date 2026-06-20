import { NextResponse } from 'next/server';
import {
  buildDevSecurityDashboardStub,
  fetchSecurityDashboardFromCore,
  securityDashboardCoreConfigured,
} from '@/lib/security-dashboard-core';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let timer: ReturnType<typeof setInterval> | null = null;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const push = async () => {
        try {
          const data = securityDashboardCoreConfigured()
            ? await fetchSecurityDashboardFromCore()
            : buildDevSecurityDashboardStub();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: err instanceof Error ? err.message : String(err) })}\n\n`,
            ),
          );
        }
      };

      await push();
      timer = setInterval(() => {
        void push();
      }, 5000);
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

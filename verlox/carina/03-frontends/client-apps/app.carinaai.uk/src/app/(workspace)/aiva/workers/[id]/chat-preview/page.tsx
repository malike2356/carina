import Link from 'next/link';
import { WidgetPreviewLoader } from '@/components/aiva/WidgetPreviewLoader';
import { requireSession } from '@/lib/session';

export default async function AivaChatPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-base px-6 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          href={`/aiva/workers/${id}?tab=channels`}
          className="text-sm text-accent hover:underline"
        >
          Back to channels
        </Link>
        <div className="rounded-xl border border-border bg-surface p-6">
          <h1 className="text-lg font-semibold text-text-primary">Test web chat</h1>
          <p className="mt-2 text-sm text-text-secondary">
            The chat bubble should appear in the bottom-right corner of this page. This is the same
            widget visitors see when you embed it on your website.
          </p>
          <p className="mt-2 text-xs text-text-muted">
            Tip: paste the embed snippet into a normal HTML page on your site. It does not run inside
            the Aiva dashboard menus; use this page to preview instead.
          </p>
          <WidgetPreviewLoader workerId={id} />
        </div>
      </div>
    </div>
  );
}

import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { loadLegalMarkdown, resolveLegalPageMeta } from '@/lib/legal/content';

export const dynamic = 'force-dynamic';

export default async function RefundsVersionPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  const meta = await resolveLegalPageMeta('refund_policy', version);
  const markdown = await loadLegalMarkdown('refund_policy');
  return (
    <LegalDocumentView
      title={meta.title}
      version={meta.version}
      effectiveDate={meta.effectiveDate}
      markdown={markdown}
      archiveUrl={meta.archiveUrl}
    />
  );
}

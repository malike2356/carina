import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { loadLegalMarkdown, resolveLegalPageMeta } from '@/lib/legal/content';

export const dynamic = 'force-dynamic';

export default async function RefundsPage() {
  const meta = await resolveLegalPageMeta('refund_policy');
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

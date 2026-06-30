import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { loadLegalMarkdown, resolveLegalPageMeta } from '@/lib/legal/content';

export const dynamic = 'force-dynamic';

export default async function DpaPage() {
  const meta = await resolveLegalPageMeta('dpa');
  const markdown = await loadLegalMarkdown('dpa');
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

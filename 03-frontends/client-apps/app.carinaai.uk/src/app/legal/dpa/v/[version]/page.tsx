import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { loadLegalMarkdown, resolveLegalPageMeta } from '@/lib/legal/content';

export const dynamic = 'force-dynamic';

export default async function DpaVersionPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  const meta = await resolveLegalPageMeta('dpa', version);
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

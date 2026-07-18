import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { loadLegalMarkdown, resolveLegalPageMeta } from '@/lib/legal/content';

export const dynamic = 'force-dynamic';

export default async function MsaVersionPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  const meta = await resolveLegalPageMeta('msa', version);
  const markdown = await loadLegalMarkdown('msa');
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

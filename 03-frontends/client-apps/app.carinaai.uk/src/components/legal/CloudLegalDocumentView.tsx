import Link from 'next/link';
import { MarkdownContent } from '@/components/chat/MarkdownContent';
import { PrintPdfButton } from '@/components/legal/PrintPdfButton';
import { LEGAL_NAV_LINKS } from '@/lib/legal/content';

type CloudLegalDocumentViewProps = {
  title: string;
  version: string;
  effectiveDate: string;
  markdown: string;
  archiveUrl: string;
};

export function CloudLegalDocumentView({
  title,
  version,
  effectiveDate,
  markdown,
  archiveUrl,
}: CloudLegalDocumentViewProps) {
  return (
    <div className="min-h-screen bg-base text-text-primary">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-8 px-4 py-10 lg:flex-row">
        <aside className="lg:w-56">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Legal</p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            {LEGAL_NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-accent hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 flex-1">
          <header className="mb-6 border-b border-border pb-4">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Version {version} | Effective {effectiveDate}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <PrintPdfButton />
              <Link href={archiveUrl} className="text-accent hover:underline">
                Archived version link
              </Link>
            </div>
          </header>
          <div className="prose prose-invert max-w-none text-sm leading-relaxed">
            <MarkdownContent content={markdown} />
          </div>
        </article>
      </div>
    </div>
  );
}

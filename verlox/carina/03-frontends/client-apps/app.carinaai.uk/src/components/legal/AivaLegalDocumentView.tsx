import Link from 'next/link';
import { MarkdownContent } from '@/components/chat/MarkdownContent';
import { PrintPdfButton } from '@/components/legal/PrintPdfButton';
import { LEGAL_NAV_LINKS } from '@/lib/legal/content';

type AivaLegalDocumentViewProps = {
  title: string;
  version: string;
  effectiveDate: string;
  markdown: string;
  archiveUrl: string;
};

const MARKETING_HOME = 'https://hireaiva.co.uk/';

export function AivaLegalDocumentView({
  title,
  version,
  effectiveDate,
  markdown,
  archiveUrl,
}: AivaLegalDocumentViewProps) {
  return (
    <div className="aiva-legal-page">
      <nav className="aiva-legal-nav" aria-label="Aiva product">
        <div className="aiva-legal-nav-inner">
          <Link href={MARKETING_HOME} className="aiva-legal-logo">
            Aiva<span className="aiva-legal-logo-dot">.</span>
          </Link>
          <div className="aiva-legal-nav-links">
            <a href={`${MARKETING_HOME}#how-it-works`}>How it works</a>
            <a href={`${MARKETING_HOME}#pricing`}>Pricing</a>
            <a href="https://hireaiva.co.uk/support/">Support</a>
            <Link href="/login">Sign in</Link>
            <Link href="/register" className="aiva-legal-nav-cta">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <main className="aiva-legal-main">
        <div className="aiva-legal-layout">
          <aside className="aiva-legal-sidebar">
            <p className="aiva-legal-sidebar-label">Legal</p>
            <nav className="aiva-legal-sidebar-nav">
              {LEGAL_NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </aside>

          <article className="aiva-legal-article">
            <header className="aiva-legal-header">
              <h1>{title}</h1>
              <p className="aiva-legal-meta">
                Version {version} | Effective {effectiveDate}
              </p>
              <div className="aiva-legal-actions">
                <PrintPdfButton />
                <Link href={archiveUrl}>Archived version link</Link>
              </div>
            </header>
            <div className="aiva-legal-prose">
              <MarkdownContent content={markdown} />
            </div>
          </article>
        </div>
      </main>

      <footer className="aiva-legal-footer">
        <div className="aiva-legal-footer-inner">
          <Link href={MARKETING_HOME} className="aiva-legal-logo">
            Aiva<span className="aiva-legal-logo-dot">.</span>
          </Link>
          <div className="aiva-legal-footer-links">
            <a href={`${MARKETING_HOME}#pricing`}>Pricing</a>
            <a href="https://hireaiva.co.uk/support/">Support</a>
            <Link href="/register">Start free</Link>
          </div>
          <p className="aiva-legal-footer-platform">
            Aiva is built on <a href="https://carinaai.uk/">Carina</a> from VERLOX.
          </p>
          <p className="aiva-legal-footer-copy">
            &copy; 2026 <a href="https://verlox.uk">VERLOX Ltd</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

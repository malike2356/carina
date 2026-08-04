import type { Metadata } from 'next';
import PublicBookPage from '../../[slug]/page';

export const metadata: Metadata = {
  title: 'Book a session',
  robots: { index: false, follow: false },
};

/** Embeddable public book surface (iframe-friendly; noindex). */
export default function BookEmbedPage() {
  return (
    <div className="min-h-screen bg-surface p-3">
      <PublicBookPage />
    </div>
  );
}

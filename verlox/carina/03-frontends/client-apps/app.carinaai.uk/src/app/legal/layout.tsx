import type { ReactNode } from 'react';
import { Cormorant_Garamond, Instrument_Sans } from 'next/font/google';
import { getRequestHostname } from '@/lib/server-brand';
import { resolveHostBrandContext } from '@/lib/host-resolver';
import './aiva-legal.css';

const aivaSerif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-aiva-serif',
  display: 'swap',
});

const aivaSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-aiva-sans',
  display: 'swap',
});

export default async function LegalLayout({ children }: { children: ReactNode }) {
  const hostname = await getRequestHostname();
  const { isAivaProduct } = await resolveHostBrandContext(hostname);

  if (!isAivaProduct) {
    return children;
  }

  return (
    <div className={`${aivaSerif.variable} ${aivaSans.variable} aiva-legal-fonts`}>
      {children}
    </div>
  );
}

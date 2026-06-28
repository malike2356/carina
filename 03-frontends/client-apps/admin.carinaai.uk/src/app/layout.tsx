import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Carina Admin',
  description: 'VERLOX internal admin for admin.carinaai.uk',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-base text-text-primary antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import { BrandProvider } from '@/components/shell/BrandProvider';
import { ThemeProvider } from '@/components/shell/ThemeProvider';
import { ThemeSwitcherHost } from '@/components/shell/ThemeSwitcherHost';
import { I18nShell } from '@/components/shell/I18nShell';
import { PwaBootstrap } from '@/components/shell/PwaBootstrap';
import { getBrandForCurrentRequest } from '@/lib/server-brand';
import {
  htmlColorScheme,
  resolveServerThemePreference,
  serverThemeStylesheetHref,
} from '@/lib/server-theme';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandForCurrentRequest();
  return {
    title: brand.publicSiteTitle,
    description: `Hosted ${brand.productName} workspace with BYOK keys and browser chat.`,
    manifest: '/manifest.webmanifest',
    icons: {
      icon: brand.faviconUrl ?? '/favicon.svg',
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const preference = await resolveServerThemePreference();

  return (
    <html
      lang="en"
      className={preference.mode === 'dark' ? 'dark' : undefined}
      data-theme={preference.themeId}
      data-theme-mode={preference.mode}
      style={{ colorScheme: htmlColorScheme(preference.mode) }}
      suppressHydrationWarning
    >
      <head>
        <link rel="stylesheet" href={serverThemeStylesheetHref(preference.themeId)} />
        <link rel="stylesheet" href="/themes/theme-bridge.css?v=1" />
      </head>
      <body className="bg-base text-text-primary antialiased" suppressHydrationWarning>
        <I18nShell>
          <BrandProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </BrandProvider>
          <ThemeSwitcherHost />
          <PwaBootstrap />
        </I18nShell>
      </body>
    </html>
  );
}

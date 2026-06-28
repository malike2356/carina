import type { Metadata } from 'next';
import { BrandProvider } from '@/components/shell/BrandProvider';
import { ProductSurfaceProvider } from '@/components/shell/ProductSurfaceProvider';
import { ThemeProvider } from '@/components/shell/ThemeProvider';
import { I18nShell } from '@/components/shell/I18nShell';
import { AivaServiceWorkerKillScript } from '@/components/shell/AivaServiceWorkerKillScript';
import { PwaBootstrap } from '@/components/shell/PwaBootstrap';
import { CookieConsent } from '@/components/CookieConsent';
import { SentryConsentLoader } from '@/components/SentryConsentLoader';
import { getBrandForCurrentRequest, getRequestHostname } from '@/lib/server-brand';
import { resolveHostBrandContext } from '@/lib/host-resolver';
import {
  htmlColorScheme,
  resolveServerThemePreference,
  serverThemeStylesheetHref,
} from '@/lib/server-theme';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const hostname = await getRequestHostname();
  const hostContext = await resolveHostBrandContext(hostname);
  const brand = hostContext.resolvedBrand;
  const isAiva = hostContext.isAivaProduct;
  return {
    title: brand.publicSiteTitle,
    description: isAiva
      ? 'Hire and manage AI employees for your business. Powered by Carina.'
      : `Hosted ${brand.productName} workspace with BYOK keys and browser chat.`,
    manifest: isAiva ? undefined : '/manifest.webmanifest',
    icons: {
      icon: brand.faviconUrl ?? '/favicon.svg',
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const preference = await resolveServerThemePreference();
  const hostname = await getRequestHostname();
  const hostContext = await resolveHostBrandContext(hostname);
  const brand = await getBrandForCurrentRequest();

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
        {hostContext.isAivaProduct ? <AivaServiceWorkerKillScript /> : null}
        <link
          id="carina-theme-sheet"
          rel="stylesheet"
          href={serverThemeStylesheetHref(preference.themeId)}
        />
        <link rel="stylesheet" href="/themes/theme-bridge.css?v=3" />
      </head>
      <body className="bg-base text-text-primary antialiased" suppressHydrationWarning>
        <I18nShell>
          <ProductSurfaceProvider surface={hostContext.productSurface}>
            <BrandProvider initialBrand={brand}>
              <ThemeProvider>{children}</ThemeProvider>
            </BrandProvider>
          </ProductSurfaceProvider>
          <PwaBootstrap />
          <SentryConsentLoader />
          <CookieConsent />
        </I18nShell>
      </body>
    </html>
  );
}

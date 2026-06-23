'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolveBrand, type ResolvedBrand } from '@/lib/brand';

const DEFAULT_BRAND = resolveBrand({ mode: 'hosted' });

const BrandContext = createContext<ResolvedBrand>(DEFAULT_BRAND);

export function BrandProvider({
  children,
  initialBrand,
}: {
  children: ReactNode;
  initialBrand?: ResolvedBrand;
}) {
  const [brand, setBrand] = useState<ResolvedBrand>(initialBrand ?? DEFAULT_BRAND);

  useEffect(() => {
    let cancelled = false;

    async function loadBrand() {
      const settingsResponse = await fetch('/api/workspace/settings').catch(() => null);
      if (settingsResponse?.ok) {
        const payload = await settingsResponse.json().catch(() => null);
        const resolved = payload?.data?.resolvedBrand as ResolvedBrand | undefined;
        if (!cancelled && resolved?.productName) {
          setBrand(resolved);
          applyBrandDocument(resolved);
          return;
        }
      }

      const publicResponse = await fetch('/api/brand').catch(() => null);
      if (publicResponse?.ok) {
        const payload = await publicResponse.json().catch(() => null);
        const resolved = payload?.data as ResolvedBrand | undefined;
        if (!cancelled && resolved?.productName) {
          setBrand(resolved);
          applyBrandDocument(resolved);
        }
      }
    }

    void loadBrand();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => brand, [brand]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): ResolvedBrand {
  return useContext(BrandContext);
}

export function applyBrandDocument(brand: ResolvedBrand) {
  if (typeof document === 'undefined') return;

  document.title = brand.publicSiteTitle;

  const iconHref = brand.faviconUrl ?? '/favicon.svg';
  for (const rel of ['icon', 'shortcut icon']) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = iconHref;
  }

  const root = document.documentElement;
  Object.entries(brand.colorTokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

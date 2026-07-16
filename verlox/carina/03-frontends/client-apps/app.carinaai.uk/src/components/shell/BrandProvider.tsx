'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { resolveBrand, type ResolvedBrand } from '@/lib/brand';
import { hasClientSessionCookie } from '@/lib/client-session';

const DEFAULT_BRAND = resolveBrand({ mode: 'hosted' });

export type WorkspaceBootstrap = {
  theme?: unknown;
  appearance?: unknown;
  resolvedBrand?: ResolvedBrand;
} | null;

type BrandContextValue = {
  brand: ResolvedBrand;
  workspaceBootstrap: WorkspaceBootstrap;
  workspaceLoaded: boolean;
};

const BrandContext = createContext<BrandContextValue>({
  brand: DEFAULT_BRAND,
  workspaceBootstrap: null,
  workspaceLoaded: false,
});

type PublicBrandPayload = {
  brand?: ResolvedBrand;
};

async function fetchPublicBrand(): Promise<ResolvedBrand | null> {
  const publicResponse = await fetch('/api/brand').catch(() => null);
  if (!publicResponse?.ok) return null;
  const payload = await publicResponse.json().catch(() => null);
  const resolved = (payload?.data as PublicBrandPayload | undefined)?.brand;
  return resolved?.productName ? resolved : null;
}

export function BrandProvider({
  children,
  initialBrand,
}: {
  children: ReactNode;
  initialBrand?: ResolvedBrand;
}) {
  const [brand, setBrand] = useState<ResolvedBrand>(initialBrand ?? DEFAULT_BRAND);
  const [workspaceBootstrap, setWorkspaceBootstrap] = useState<WorkspaceBootstrap>(null);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);

  useEffect(() => {
    if (initialBrand?.productName) {
      applyBrandDocument(initialBrand);
    }
  }, [initialBrand]);

  useEffect(() => {
    let cancelled = false;

    async function loadBrand() {
      if (!hasClientSessionCookie()) {
        const publicBrand = await fetchPublicBrand();
        if (!cancelled) {
          setWorkspaceLoaded(true);
          if (publicBrand) {
            setBrand(publicBrand);
            applyBrandDocument(publicBrand);
          }
        }
        return;
      }

      const settingsResponse = await fetch('/api/workspace/settings').catch(() => null);
      if (settingsResponse?.ok) {
        const payload = await settingsResponse.json().catch(() => null);
        const data = (payload?.data ?? null) as WorkspaceBootstrap;
        if (!cancelled) {
          setWorkspaceBootstrap(data);
          setWorkspaceLoaded(true);
        }
        const resolved = data?.resolvedBrand;
        if (!cancelled && resolved?.productName) {
          setBrand(resolved);
          applyBrandDocument(resolved);
          return;
        }
      } else if (!cancelled) {
        setWorkspaceLoaded(true);
      }

      const publicBrand = await fetchPublicBrand();
      if (!cancelled && publicBrand) {
        setBrand(publicBrand);
        applyBrandDocument(publicBrand);
      }
    }

    void loadBrand();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ brand, workspaceBootstrap, workspaceLoaded }),
    [brand, workspaceBootstrap, workspaceLoaded],
  );
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): ResolvedBrand {
  return useContext(BrandContext).brand;
}

export function useWorkspaceBootstrap(): Pick<BrandContextValue, 'workspaceBootstrap' | 'workspaceLoaded'> {
  const { workspaceBootstrap, workspaceLoaded } = useContext(BrandContext);
  return { workspaceBootstrap, workspaceLoaded };
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

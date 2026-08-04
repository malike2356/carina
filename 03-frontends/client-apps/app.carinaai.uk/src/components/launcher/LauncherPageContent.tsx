'use client';

import nextDynamic from 'next/dynamic';
import type { LauncherData } from '@/lib/launcher-data';
import { useIsAivaProduct } from '@/hooks/useProductSurface';
import { LauncherLoadingPlaceholder } from './LauncherLoadingPlaceholder';

const LauncherShell = nextDynamic(
  () => import('./LauncherShell').then((mod) => mod.LauncherShell),
  {
    ssr: false,
    loading: () => <LauncherLoadingPlaceholder />,
  },
);

const AivaLauncherShell = nextDynamic(
  () => import('./AivaLauncherShell').then((mod) => mod.AivaLauncherShell),
  {
    ssr: false,
    loading: () => <LauncherLoadingPlaceholder />,
  },
);

export function LauncherPageContent(props: LauncherData) {
  const isAiva = useIsAivaProduct();
  if (isAiva) {
    return <AivaLauncherShell {...props} />;
  }
  return <LauncherShell {...props} />;
}

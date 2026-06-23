'use client';

import nextDynamic from 'next/dynamic';
import type { LauncherData } from '@/lib/launcher-data';
import { LauncherLoadingPlaceholder } from './LauncherLoadingPlaceholder';

const LauncherShell = nextDynamic(
  () => import('./LauncherShell').then((mod) => mod.LauncherShell),
  {
    ssr: false,
    loading: () => <LauncherLoadingPlaceholder />,
  },
);

export function LauncherPageContent(props: LauncherData) {
  return <LauncherShell {...props} />;
}

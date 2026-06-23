'use client';

import { ExternalLink } from 'lucide-react';
import { resolveCoreSurfaceUrl, coreSurfaceDeepLinkEnabled } from '@/lib/core-surface';

interface CoreSurfaceBannerProps {
  surface: 'email' | 'documents' | 'calendar';
}

export function CoreSurfaceBanner({ surface }: CoreSurfaceBannerProps) {
  if (!coreSurfaceDeepLinkEnabled()) return null;

  const paths: Record<typeof surface, string> = {
    email: '/email',
    documents: '/documents',
    calendar: '/calendar',
  };
  const labels: Record<typeof surface, string> = {
    email: 'email workspace',
    documents: 'document editor',
    calendar: 'calendar',
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-text-secondary">
      <span>
        Self-hosting Carina Core? That instance may have more on this surface. Cloud stays scoped to what is wired here.
      </span>
      <a
        href={resolveCoreSurfaceUrl(paths[surface])}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-accent hover:underline"
      >
        Open core {labels[surface]}
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

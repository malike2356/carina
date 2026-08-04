'use client';

import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { IntegrationGuideDrawer } from '@/components/integrations/IntegrationGuideDrawer';
import type { IntegrationGuideId } from '@/lib/integration-guides';
import { cn } from '@/lib/utils';

type GuideMeLinkProps = {
  guideId: IntegrationGuideId;
  label?: string;
  className?: string;
  /** Compact text-only link (default) or pill button. */
  variant?: 'link' | 'pill';
};

/**
 * Opens a right-side setup guide drawer. Place next to Connect / sync actions.
 */
export function GuideMeLink({
  guideId,
  label = 'Guide me',
  className,
  variant = 'link',
}: GuideMeLinkProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 text-sm font-medium',
          variant === 'pill'
            ? 'rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-accent hover:bg-accent/20'
            : 'text-accent underline-offset-2 hover:underline',
          className,
        )}
      >
        <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </button>
      <IntegrationGuideDrawer
        guideId={guideId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type MobileScreenProps = {
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  primaryAction?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Hide the in-page title row when the shell header already shows it. */
  hideTitleOnMobile?: boolean;
};

export function MobileScreen({
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
  primaryAction,
  children,
  className,
  hideTitleOnMobile = false,
}: MobileScreenProps) {
  const showHeader = Boolean(title || backHref || primaryAction || subtitle);

  return (
    <div className={cn('mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 lg:py-8', className)}>
      {showHeader ? (
        <div
          className={cn(
            'mb-5 flex items-start justify-between gap-3',
            hideTitleOnMobile && 'hidden lg:flex',
          )}
        >
          <div className="min-w-0 flex-1">
            {backHref ? (
              <Link
                href={backHref}
                className="touch-target mb-2 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {backLabel}
              </Link>
            ) : null}
            {title ? (
              <h1 className="truncate text-xl font-semibold text-text-primary lg:text-2xl">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
            ) : null}
          </div>
          {primaryAction ? (
            <div className="flex shrink-0 items-center gap-2">{primaryAction}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

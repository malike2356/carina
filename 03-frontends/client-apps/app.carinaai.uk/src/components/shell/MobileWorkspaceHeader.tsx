'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { BrandMark } from '@/components/shell/BrandMark';
import { getBreadcrumbs } from '@/lib/workspace-nav';
import { cn } from '@/lib/utils';
import { ThemeSwitcher } from '@/components/shell/ThemeSwitcher';
import { WorkspaceAccountMenu } from '@/components/shell/WorkspaceAccountMenu';

function toggleMobileSidebar() {
  document.dispatchEvent(new CustomEvent('toggle-sidebar'));
}

export function MobileWorkspaceHeader({
  className,
  userEmail,
  userName,
}: {
  className?: string;
  userEmail: string;
  userName: string;
}) {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);
  const pageLabel = crumbs[crumbs.length - 1]?.label ?? '';

  return (
    <header
      className={cn(
        'sticky top-0 z-[80] flex items-center gap-2 border-b border-border bg-surface/95 px-3 py-2 backdrop-blur lg:hidden',
        'pt-[max(0.5rem,env(safe-area-inset-top))]',
        className,
      )}
    >
      <button
        type="button"
        onClick={toggleMobileSidebar}
        className="touch-target inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-primary hover:bg-elevated"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <div className="min-w-0 overflow-hidden">
          <BrandMark size={22} showName nameClassName="truncate text-sm font-semibold text-text-primary" />
        </div>
        {pageLabel ? (
          <p className="truncate text-[11px] text-text-muted">{pageLabel}</p>
        ) : null}
      </div>
      <ThemeSwitcher showLabel={false} syncApi />
      <WorkspaceAccountMenu userEmail={userEmail} userName={userName} />
    </header>
  );
}

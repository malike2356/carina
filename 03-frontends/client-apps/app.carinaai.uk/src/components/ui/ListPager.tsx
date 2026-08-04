'use client';

import { cn } from '@/lib/utils';

export const DEFAULT_PAGE_SIZE = 20;

export function totalPagesFor(total: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function slicePage<T>(
  items: T[],
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): T[] {
  const safePage = Math.min(Math.max(1, page), totalPagesFor(items.length, pageSize));
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

type ListPagerProps = {
  page: number;
  totalPages: number;
  totalItems?: number;
  onChangePage: (page: number) => void;
  disabled?: boolean;
  className?: string;
};

/** Previous / Page X of Y / Next for tall workspace lists. */
export function ListPager({
  page,
  totalPages,
  totalItems,
  onChangePage,
  disabled = false,
  className,
}: ListPagerProps) {
  if (totalPages <= 1) return null;

  const atStart = page <= 1 || disabled;
  const atEnd = page >= totalPages || disabled;

  return (
    <nav
      className={cn(
        'flex items-center justify-between gap-3 border-t border-border px-1 py-3',
        className,
      )}
      aria-label="Pagination"
    >
      <button
        type="button"
        onClick={() => onChangePage(page - 1)}
        disabled={atStart}
        className="text-xs text-text-muted hover:text-text-secondary disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-xs text-text-muted">
        Page {page} of {totalPages}
        {typeof totalItems === 'number' ? ` · ${totalItems}` : ''}
      </span>
      <button
        type="button"
        onClick={() => onChangePage(page + 1)}
        disabled={atEnd}
        className="text-xs text-text-muted hover:text-text-secondary disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}

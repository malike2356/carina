import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, backHref, backLabel, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
      <div className="min-w-0 flex-1">
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-secondary"
          >
            <ArrowLeft className="h-3 w-3" />
            {backLabel ?? 'Back'}
          </Link>
        )}
        <h1 className="text-base font-semibold text-text-primary">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

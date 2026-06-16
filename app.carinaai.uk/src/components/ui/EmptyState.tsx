import { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon && <div className="text-text-muted">{icon}</div>}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {subtitle && <p className="max-w-xs text-xs text-text-muted">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

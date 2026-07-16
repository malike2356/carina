import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, size = 'md', className, children, ...props }, ref) => {
    const sz = size === 'sm' ? 'p-1 rounded' : 'p-1.5 rounded-md';
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={cn(
          sz,
          'text-text-muted hover:text-text-secondary hover:bg-elevated transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
IconButton.displayName = 'IconButton';

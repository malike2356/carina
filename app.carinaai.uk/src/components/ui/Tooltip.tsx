'use client';

import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

export function Tooltip({
  text,
  children,
  side = 'top',
}: {
  text: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [visible, setVisible] = useState(false);
  const posClass = {
    top: '-top-8 left-1/2 -translate-x-1/2',
    bottom: '-bottom-8 left-1/2 -translate-x-1/2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side];

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className={cn(
            'absolute z-50 whitespace-nowrap rounded px-2 py-1 text-xs',
            'bg-overlay text-text-primary border border-border pointer-events-none',
            posClass,
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
}

'use client';

import { Expand, Minimize2, Minus, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';
import { useWindowDrag } from '@/hooks/useWindowDrag';
import type { WindowDefinition } from '@/lib/window-manager/types';
import type { WorkspaceWindowId } from '@/lib/window-manager/types';

interface WindowShellProps {
  definition: WindowDefinition;
  windowId: WorkspaceWindowId;
  zIndex: number;
  minimized: boolean;
  focused: boolean;
  maximized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onFocus: () => void;
  onMaximize: () => void;
  onRestoreSize: () => void;
  children: React.ReactNode;
}

function floatingStyle(
  definition: WindowDefinition,
  maximized: boolean,
  isMobile: boolean,
): React.CSSProperties | undefined {
  if (maximized) return { left: 0, top: 0, width: '100vw', height: '100vh' };
  if (isMobile) return undefined;

  const size = definition.size ?? 'tool';
  const LEFT = 264;
  const TOP = 56;

  if (size === 'panel') {
    return { left: LEFT, top: TOP, width: `min(380px, calc(100vw - ${LEFT}px))` };
  }

  if (size === 'terminal') {
    return {
      left: LEFT,
      top: TOP,
      width: `min(860px, calc(100vw - ${LEFT}px))`,
      height: `min(520px, calc(100vh - ${TOP + 48}px))`,
    };
  }

  const w = Math.max(definition.minWidth ?? 860, 320);
  return {
    left: LEFT,
    top: TOP,
    width: `min(${w}px, calc(100vw - ${LEFT}px))`,
    height: `min(${definition.minHeight ?? 660}px, calc(100vh - ${TOP + 48}px))`,
  };
}

export function WindowShell({
  definition,
  windowId,
  zIndex,
  minimized,
  focused,
  maximized,
  onClose,
  onMinimize,
  onFocus,
  onMaximize,
  onRestoreSize,
  children,
}: WindowShellProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  useWindowDrag(modalRef, contentRef, headerRef, {
    windowId,
    enabled: !maximized && !minimized && !isMobile,
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!focused) return;
      if (event.key === 'Escape') {
        if (maximized) {
          onRestoreSize();
        } else {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focused, maximized, onClose, onRestoreSize]);

  const handleFocus = useCallback(() => {
    onFocus();
  }, [onFocus]);

  if (minimized) return null;

  return (
    <div
      ref={modalRef}
      className={cn(
        // Outer shell must not steal clicks from the left nav / account menu.
        // Only the floating content chrome receives pointer events.
        'carina-window pointer-events-none fixed inset-0 z-[var(--carina-window-z)]',
        focused && 'carina-window-focused',
        definition.accent === 'scout' && 'carina-window-scout',
      )}
      style={{ ['--carina-window-z' as string]: zIndex }}
    >
      <div
        ref={contentRef}
        className="carina-window-content pointer-events-auto"
        style={floatingStyle(definition, maximized, isMobile)}
        onMouseDown={handleFocus}
      >
        <div ref={headerRef} className="carina-window-header">
          <h2 className="carina-window-title">{definition.title}</h2>
          <div className="carina-window-controls">
            <IconButton label="Minimize" size="sm" onClick={onMinimize}>
              <Minus className="h-3.5 w-3.5" />
            </IconButton>
            {maximized ? (
              <IconButton label="Restore size" size="sm" onClick={onRestoreSize}>
                <Minimize2 className="h-3.5 w-3.5" />
              </IconButton>
            ) : (
              <IconButton label="Maximize" size="sm" onClick={onMaximize}>
                <Expand className="h-3.5 w-3.5" />
              </IconButton>
            )}
            <IconButton label="Close" size="sm" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>
        <div className="carina-window-body">{children}</div>
      </div>
    </div>
  );
}

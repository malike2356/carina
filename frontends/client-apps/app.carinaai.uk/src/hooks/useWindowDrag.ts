'use client';

import { useEffect } from 'react';
import { attachWindowDrag } from '@/lib/window-manager/window-drag';
import type { WorkspaceWindowId } from '@/lib/window-manager/types';

export interface UseWindowDragOptions {
  windowId: WorkspaceWindowId;
  enabled?: boolean;
}

export function useWindowDrag(
  modalRef: React.RefObject<HTMLElement | null>,
  contentRef: React.RefObject<HTMLElement | null>,
  headerRef: React.RefObject<HTMLElement | null>,
  options: UseWindowDragOptions,
) {
  const { windowId, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;
    const modal = modalRef.current;
    const content = contentRef.current;
    const header = headerRef.current;
    if (!modal || !content || !header) return;

    modal.dataset.windowId = windowId;
    return attachWindowDrag({
      modal,
      content,
      header,
      storageKey: windowId,
    });
  }, [enabled, modalRef, contentRef, headerRef, windowId]);
}

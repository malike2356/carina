import { attachWindowResize } from './window-resize';

const MOVE_THRESHOLD = 4;

export interface WindowDragOptions {
  modal: HTMLElement;
  content: HTMLElement;
  header: HTMLElement;
  skipSelector?: string;
  mobileSkip?: number;
  storageKey?: string;
  onDragEnd?: (rect: DOMRect) => void;
  onDockChange?: (side: 'left' | 'right' | null) => void;
}

export function attachWindowDrag(options: WindowDragOptions): () => void {
  const {
    modal,
    content,
    header,
    skipSelector = 'button, input, select, textarea, a',
    mobileSkip = 768,
    storageKey,
  } = options;

  header.style.cursor = 'move';
  header.style.userSelect = 'none';

  const detachResize = attachWindowResize(content, {
    modal,
    mobileSkip,
    storageKey: storageKey ? `carina-winsize-${storageKey}` : null,
    isLocked: () => modal.classList.contains('carina-window-fullscreen'),
  });

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let movedDuringDrag = false;

  function startDrag(cx: number, cy: number) {
    dragging = true;
    modal.classList.add('carina-window-dragging');
    const rect = content.getBoundingClientRect();
    startX = cx;
    startY = cy;
    startLeft = rect.left;
    startTop = rect.top;
    content.style.position = 'fixed';
    content.style.left = `${startLeft}px`;
    content.style.top = `${startTop}px`;
    content.style.transform = 'none';
    content.style.margin = '0';
  }

  function onMove(cx: number, cy: number) {
    if (!dragging) return;
    if (Math.abs(cx - startX) > MOVE_THRESHOLD || Math.abs(cy - startY) > MOVE_THRESHOLD) {
      movedDuringDrag = true;
    }
    content.style.left = `${startLeft + cx - startX}px`;
    content.style.top = `${startTop + cy - startY}px`;
  }

  function onEnd(cx: number, cy: number) {
    if (!dragging) return;
    dragging = false;
    modal.classList.remove('carina-window-dragging');
    options.onDragEnd?.(content.getBoundingClientRect());
  }

  function onMouseDown(e: MouseEvent) {
    if (mobileSkip > 0 && window.innerWidth <= mobileSkip) return;
    if ((e.target as HTMLElement | null)?.closest?.(skipSelector)) return;
    e.preventDefault();
    movedDuringDrag = false;
    startDrag(e.clientX, e.clientY);

    const move = (ev: MouseEvent) => onMove(ev.clientX, ev.clientY);
    const up = (ev: MouseEvent) => {
      onEnd(ev.clientX, ev.clientY);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      if (movedDuringDrag) {
        const swallow = (clickEv: Event) => {
          clickEv.stopPropagation();
          clickEv.preventDefault();
        };
        header.addEventListener('click', swallow, { capture: true, once: true });
      }
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  header.addEventListener('mousedown', onMouseDown);

  return () => {
    header.removeEventListener('mousedown', onMouseDown);
    detachResize();
  };
}

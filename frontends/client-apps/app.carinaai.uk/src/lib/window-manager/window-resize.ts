const EDGE = 7;
const MIN_W = 320;
const MIN_H = 200;
const INTERACTIVE =
  'button, input, select, textarea, a, [contenteditable=""], [contenteditable="true"]';

export interface WindowResizeOptions {
  modal?: HTMLElement | null;
  mobileSkip?: number;
  minWidth?: number;
  minHeight?: number;
  isLocked?: () => boolean;
  storageKey?: string | null;
  onResizeEnd?: (rect: DOMRect) => void;
}

export function attachWindowResize(
  content: HTMLElement,
  options: WindowResizeOptions = {},
): () => void {
  const mobileSkip = options.mobileSkip ?? 768;
  const minW = options.minWidth ?? MIN_W;
  const minH = options.minHeight ?? MIN_H;
  const isLocked = options.isLocked ?? (() => false);
  const storageKey = options.storageKey ?? null;

  const skip = () => (mobileSkip > 0 && window.innerWidth <= mobileSkip) || isLocked();

  function edgesAt(cx: number, cy: number) {
    const r = content.getBoundingClientRect();
    const within =
      cy >= r.top - EDGE &&
      cy <= r.bottom + EDGE &&
      cx >= r.left - EDGE &&
      cx <= r.right + EDGE;
    if (!within) return { l: false, r: false, t: false, b: false, rect: r };
    const onY = cy >= r.top - EDGE && cy <= r.bottom + EDGE;
    const onX = cx >= r.left - EDGE && cx <= r.right + EDGE;
    return {
      l: Math.abs(cx - r.left) <= EDGE && onY,
      r: Math.abs(cx - r.right) <= EDGE && onY,
      t: Math.abs(cy - r.top) <= EDGE && onX,
      b: Math.abs(cy - r.bottom) <= EDGE && onX,
      rect: r,
    };
  }

  function cursorFor(e: { l: boolean; r: boolean; t: boolean; b: boolean }) {
    if ((e.l && e.t) || (e.r && e.b)) return 'nwse-resize';
    if ((e.r && e.t) || (e.l && e.b)) return 'nesw-resize';
    if (e.l || e.r) return 'ew-resize';
    if (e.t || e.b) return 'ns-resize';
    return '';
  }

  let hoverCursor = false;
  function clearHoverCursor() {
    if (hoverCursor) {
      content.style.cursor = '';
      hoverCursor = false;
    }
  }

  let resizing = false;
  let active: { l: boolean; r: boolean; t: boolean; b: boolean } | null = null;
  let startRect: { left: number; top: number; width: number; height: number } | null = null;
  let startX = 0;
  let startY = 0;

  function begin(cx: number, cy: number, edges: { l: boolean; r: boolean; t: boolean; b: boolean }) {
    resizing = true;
    active = edges;
    content.style.animation = 'none';
    content.classList.add('carina-window-resizing');
    const r = content.getBoundingClientRect();
    startRect = { left: r.left, top: r.top, width: r.width, height: r.height };
    startX = cx;
    startY = cy;
    content.style.position = 'fixed';
    content.style.margin = '0';
    content.style.transform = 'none';
    content.style.left = `${r.left}px`;
    content.style.top = `${r.top}px`;
    content.style.width = `${r.width}px`;
    content.style.height = `${r.height}px`;
    content.style.maxWidth = 'none';
    content.style.maxHeight = 'none';
    document.body.classList.add('carina-window-resizing-active');
    document.body.style.cursor = cursorFor(edges);
  }

  function move(cx: number, cy: number) {
    if (!resizing || !active || !startRect) return;
    const dx = cx - startX;
    const dy = cy - startY;
    let { left, top, width, height } = startRect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (active.r) width = startRect.width + dx;
    if (active.b) height = startRect.height + dy;
    if (active.l) {
      width = startRect.width - dx;
      left = startRect.left + dx;
    }
    if (active.t) {
      height = startRect.height - dy;
      top = startRect.top + dy;
    }
    if (width < minW) {
      if (active.l) left = startRect.left + (startRect.width - minW);
      width = minW;
    }
    if (height < minH) {
      if (active.t) top = startRect.top + (startRect.height - minH);
      height = minH;
    }
    if (active.l && left < 0) {
      width += left;
      left = 0;
    }
    if (active.t && top < 0) {
      height += top;
      top = 0;
    }
    if (left + width > vw) width = Math.max(minW, vw - left);
    if (top + height > vh) height = Math.max(minH, vh - top);
    content.style.left = `${left}px`;
    content.style.top = `${top}px`;
    content.style.width = `${width}px`;
    content.style.height = `${height}px`;
  }

  function end() {
    if (!resizing) return;
    resizing = false;
    content.classList.remove('carina-window-resizing');
    document.body.classList.remove('carina-window-resizing-active');
    document.body.style.cursor = '';
    clearHoverCursor();
    const r = content.getBoundingClientRect();
    options.onResizeEnd?.(r);
  }

  function onHover(ev: MouseEvent) {
    if (resizing) return;
    if (skip()) {
      clearHoverCursor();
      return;
    }
    const target = ev.target as HTMLElement | null;
    if (target?.closest?.(INTERACTIVE)) {
      clearHoverCursor();
      return;
    }
    const c = cursorFor(edgesAt(ev.clientX, ev.clientY));
    if (c) {
      content.style.cursor = c;
      hoverCursor = true;
    } else {
      clearHoverCursor();
    }
  }

  function armFrom(target: EventTarget | null, cx: number, cy: number) {
    if (skip()) return false;
    const el = target as HTMLElement | null;
    if (el?.closest?.(INTERACTIVE)) return false;
    const edges = edgesAt(cx, cy);
    if (!(edges.l || edges.r || edges.t || edges.b)) return false;
    begin(cx, cy, edges);
    return true;
  }

  function onMouseDown(ev: MouseEvent) {
    if (ev.button !== 0) return;
    if (!armFrom(ev.target, ev.clientX, ev.clientY)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const onMouseUp = () => {
      end();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (e.buttons === 0) {
        onMouseUp();
        return;
      }
      move(e.clientX, e.clientY);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  content.addEventListener('mousedown', onMouseDown, true);
  content.addEventListener('mousemove', onHover);
  content.addEventListener('mouseleave', clearHoverCursor);

  return () => {
    content.removeEventListener('mousedown', onMouseDown, true);
    content.removeEventListener('mousemove', onHover);
    content.removeEventListener('mouseleave', clearHoverCursor);
    clearHoverCursor();
  };
}

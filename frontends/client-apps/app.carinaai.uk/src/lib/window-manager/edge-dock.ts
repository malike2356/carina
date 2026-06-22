const DOCK_EDGE_PX = 60;
const UNDOCK_PULL_PX = 80;
const DEFAULT_DOCK_WIDTH = 420;

export type DockSide = 'left' | 'right';

export interface EdgeDockController {
  onMove: (cx: number, cy: number) => boolean;
  hovering: () => boolean;
  commit: () => void;
  release: () => void;
  isDocked: () => boolean;
  undock: () => void;
}

export interface EdgeDockOptions {
  side: DockSide;
  storageKey?: string;
  defaultWidth?: number;
  onDockChange?: (docked: boolean, width: number) => void;
}

export function attachEdgeDock(
  modal: HTMLElement,
  content: HTMLElement,
  options: EdgeDockOptions,
): EdgeDockController {
  const side = options.side;
  const storageKey = options.storageKey ?? `carina-dock-${side}-${modal.dataset.windowId ?? 'window'}`;
  const defaultWidth = options.defaultWidth ?? DEFAULT_DOCK_WIDTH;
  let hover = false;

  function readWidth() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null') as { w?: number } | null;
      if (saved?.w) return Math.max(280, Math.min(saved.w, window.innerWidth - 120));
    } catch {
      // ignore
    }
    return defaultWidth;
  }

  function applyDock(width: number) {
    modal.classList.add(side === 'left' ? 'carina-window-left-docked' : 'carina-window-right-docked');
    modal.classList.remove(side === 'left' ? 'carina-window-right-docked' : 'carina-window-left-docked');
    content.style.position = 'fixed';
    content.style.margin = '0';
    content.style.transform = 'none';
    content.style.top = '0';
    content.style.bottom = '0';
    content.style.height = '100vh';
    content.style.maxHeight = 'none';
    content.style.width = `${width}px`;
    content.style.maxWidth = 'none';
    if (side === 'left') {
      content.style.left = '0';
      content.style.right = 'auto';
      document.documentElement.style.setProperty('--carina-left-dock-w', `${width}px`);
    } else {
      content.style.right = '0';
      content.style.left = 'auto';
      document.documentElement.style.setProperty('--carina-right-dock-w', `${width}px`);
    }
    options.onDockChange?.(true, width);
  }

  function clearDockStyles() {
    modal.classList.remove('carina-window-left-docked', 'carina-window-right-docked');
    if (side === 'left') {
      document.documentElement.style.setProperty('--carina-left-dock-w', '0px');
    } else {
      document.documentElement.style.setProperty('--carina-right-dock-w', '0px');
    }
    options.onDockChange?.(false, 0);
  }

  return {
    onMove(cx, cy) {
      if (modal.classList.contains(`carina-window-${side}-docked`)) {
        const pull =
          side === 'right'
            ? cx < window.innerWidth - UNDOCK_PULL_PX
            : cx > UNDOCK_PULL_PX;
        if (pull) {
          this.undock();
          return true;
        }
        return false;
      }
      const near =
        side === 'right'
          ? window.innerWidth - cx <= DOCK_EDGE_PX
          : cx <= DOCK_EDGE_PX;
      hover = near;
      return false;
    },
    hovering() {
      return hover;
    },
    commit() {
      hover = false;
      const width = readWidth();
      applyDock(width);
      try {
        localStorage.setItem(storageKey, JSON.stringify({ w: width }));
      } catch {
        // ignore
      }
    },
    release() {
      hover = false;
    },
    isDocked() {
      return modal.classList.contains(`carina-window-${side}-docked`);
    },
    undock() {
      clearDockStyles();
      const r = content.getBoundingClientRect();
      content.style.position = 'fixed';
      content.style.left = `${Math.max(16, r.left)}px`;
      content.style.top = `${Math.max(16, r.top)}px`;
      content.style.width = `${r.width}px`;
      content.style.height = `${r.height}px`;
      content.style.right = 'auto';
      content.style.bottom = 'auto';
    },
  };
}

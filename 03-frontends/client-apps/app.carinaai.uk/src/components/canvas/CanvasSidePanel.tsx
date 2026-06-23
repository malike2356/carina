'use client';

import { useCallback, useRef } from 'react';
import { Download, ExternalLink, GripVertical, X } from 'lucide-react';
import { ArtifactCanvas } from '@/components/chat/ArtifactCanvas';
import { IconButton } from '@/components/ui/IconButton';
import {
  clampWidth,
  stashCanvasPopout,
  useCanvasPanel,
  type CanvasPanelPayload,
} from '@/lib/canvas-panel';

export function CanvasSidePanel() {
  const { state, closePanel, setWidth } = useCanvasPanel();
  const dragging = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!state.open) return;
      event.preventDefault();
      dragging.current = true;
      const startX = event.clientX;
      const startWidth = state.widthPx;

      function onMove(moveEvent: PointerEvent) {
        if (!dragging.current) return;
        const delta = startX - moveEvent.clientX;
        setWidth(clampWidth(startWidth + delta));
      }

      function onUp() {
        dragging.current = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      }

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [setWidth, state.open, state.widthPx],
  );

  if (!state.open) return null;

  const payload: CanvasPanelPayload = {
    content: state.content,
    language: state.language,
    title: state.title,
  };

  function openPopout() {
    stashCanvasPopout(payload);
    window.open('/canvas', '_blank', 'noopener,noreferrer');
  }

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${state.title.replace(/\s+/g, '-').toLowerCase() || 'artifact'}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-border bg-surface"
      style={{ width: state.widthPx }}
      aria-label="Canvas panel"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize canvas panel"
        className="absolute inset-y-0 left-0 z-10 flex w-2 -translate-x-1/2 cursor-col-resize items-center justify-center"
        onPointerDown={onResizePointerDown}
      >
        <GripVertical className="h-4 w-4 text-text-muted opacity-60" />
      </div>

      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{state.title}</p>
          <p className="text-[10px] uppercase tracking-wide text-text-muted">{state.language}</p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Download canvas image" onClick={downloadPng}>
            <Download className="h-4 w-4" />
          </IconButton>
          <IconButton label="Open canvas in new tab" onClick={openPopout}>
            <ExternalLink className="h-4 w-4" />
          </IconButton>
          <IconButton label="Close canvas panel" onClick={closePanel}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="h-full min-h-[320px]">
          <ArtifactCanvas
            ref={canvasRef}
            content={state.content}
            language={state.language}
            showPanelAction={false}
            className="h-full min-h-[320px]"
          />
        </div>
      </div>
    </aside>
  );
}

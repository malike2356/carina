'use client';

import { useEffect, useMemo, useRef } from 'react';

type ArtifactNode = {
  id: string;
  label: string;
  x?: number;
  y?: number;
};

type ArtifactEdge = {
  from: string;
  to: string;
  label?: string;
};

export type ArtifactSpec = {
  title?: string;
  subtitle?: string;
  description?: string;
  summary?: string;
  items?: Array<string | { label?: string; value?: string; detail?: string }>;
  nodes?: ArtifactNode[];
  edges?: ArtifactEdge[];
  accent?: string;
};

function parseArtifactSpec(content: string): ArtifactSpec | null {
  try {
    const parsed = JSON.parse(content) as ArtifactSpec;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function nodePosition(
  node: ArtifactNode,
  index: number,
  total: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = typeof node.x === 'number' ? node.x : 12 + ((index % 3) * (width - 24)) / 2;
  const y = typeof node.y === 'number' ? node.y : 16 + (total > 3 ? Math.floor(index / 3) * 42 : 0);
  return {
    x: Math.min(width - 12, Math.max(12, x)),
    y: Math.min(height - 14, Math.max(14, y)),
  };
}

export function ArtifactCanvas({ content }: { content: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spec = useMemo(() => parseArtifactSpec(content), [content]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const render = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(180, Math.floor(rect.height));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#0b1220');
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 14px Inter, system-ui, sans-serif';
      ctx.fillText(spec?.title ?? 'Artifact preview', 16, 26);

      if (spec?.subtitle) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.fillText(spec.subtitle, 16, 46);
      }

      if (spec?.summary) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px Inter, system-ui, sans-serif';
        wrapText(ctx, spec.summary, 16, 68, width - 32, 18);
      } else if (spec?.description) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px Inter, system-ui, sans-serif';
        wrapText(ctx, spec.description, 16, 68, width - 32, 18);
      }

      if (spec?.nodes?.length) {
        drawGraph(ctx, spec, width, height);
      } else if (spec?.items?.length) {
        drawItems(ctx, spec.items, width, height);
      } else if (!spec?.summary && !spec?.description) {
        drawFallback(ctx, content, width, height);
      }
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(container);
    window.addEventListener('resize', render);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', render);
    };
  }, [content, spec]);

  return (
    <div ref={containerRef} className="my-3 overflow-hidden rounded-lg border border-border bg-surface">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

function drawItems(ctx: CanvasRenderingContext2D, items: ArtifactSpec['items'], width: number, height: number) {
  if (!items?.length) return;
  const startY = 92;
  let y = startY;
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px Inter, system-ui, sans-serif';

  for (const item of items.slice(0, 8)) {
    const text = typeof item === 'string'
      ? item
      : [item.label, item.value, item.detail].filter(Boolean).join(' - ');
    wrapText(ctx, `• ${text}`, 16, y, width - 32, 18);
    y += 22;
    if (y > height - 24) break;
  }
}

function drawGraph(ctx: CanvasRenderingContext2D, spec: ArtifactSpec, width: number, height: number) {
  const nodes = spec.nodes ?? [];
  const edges = spec.edges ?? [];
  const positions = new Map<string, { x: number; y: number }>();
  const top = 90;
  const usableHeight = Math.max(100, height - top - 20);

  nodes.forEach((node, index) => {
    positions.set(node.id, nodePosition(node, index, nodes.length, width, usableHeight));
  });

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px Inter, system-ui, sans-serif';

  for (const edge of edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;
    ctx.beginPath();
    ctx.moveTo(from.x, top + from.y);
    ctx.lineTo(to.x, top + to.y);
    ctx.stroke();
    if (edge.label) {
      const labelX = (from.x + to.x) / 2;
      const labelY = top + (from.y + to.y) / 2 - 4;
      ctx.fillText(edge.label, labelX, labelY);
    }
  }

  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const boxWidth = Math.min(180, Math.max(100, node.label.length * 7 + 24));
    const boxHeight = 30;
    const x = Math.max(12, Math.min(width - boxWidth - 12, pos.x - boxWidth / 2));
    const y = top + Math.max(10, Math.min(usableHeight - boxHeight - 10, pos.y - boxHeight / 2));

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = spec.accent ?? '#22c55e';
    roundRect(ctx, x, y, boxWidth, boxHeight, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    const textWidth = ctx.measureText(node.label).width;
    const textX = x + Math.max(12, (boxWidth - textWidth) / 2);
    ctx.fillText(node.label, textX, y + 19);
  }
}

function drawFallback(ctx: CanvasRenderingContext2D, content: string, width: number, height: number) {
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px Inter, system-ui, sans-serif';
  wrapText(
    ctx,
    content.slice(0, 500).replace(/\s+/g, ' ').trim() || 'Artifact content',
    16,
    96,
    width - 32,
    18,
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = '';
  let offsetY = 0;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + offsetY);
      line = word;
      offsetY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) ctx.fillText(line, x, y + offsetY);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

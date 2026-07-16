'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AgentOsShell } from '@/components/agent-os/AgentOsShell';
import { ListSkeleton } from '@/components/ui/Skeleton';

type GraphNode = {
  id: string;
  label: string;
  kind: string;
  size?: number;
  href?: string;
};

type GraphEdge = { source: string; target: string };

export default function MemoryGalaxyPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    try {
      localStorage.setItem('carina-agent-os-galaxy-opened', '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/agent-os/memory/graph');
        if (!res.ok) throw new Error('Failed');
        const data = (await res.json()) as { nodes?: GraphNode[]; edges?: GraphEdge[] };
        if (!cancelled) {
          setNodes(data.nodes ?? []);
          setEdges(data.edges ?? []);
        }
      } catch {
        if (!cancelled) {
          setNodes([]);
          setEdges([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const count = Math.max(nodes.length, 1);
    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / count;
      const radius = 40 + Math.min(180, count * 8);
      map.set(node.id, {
        x: 220 + radius * Math.cos(angle),
        y: 180 + radius * Math.sin(angle),
      });
    });
    return map;
  }, [nodes]);

  return (
    <AgentOsShell
      title="Memory Galaxy"
      description="Shared workspace brain: capture, store, read, visualize. All workers share this memory."
    >
      {loading ? (
        <ListSkeleton rows={4} />
      ) : !nodes.length ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-text-muted">No memory yet.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            <Link href="/chat" className="inline-flex min-h-11 items-center text-sm text-accent hover:underline">
              Open chat
            </Link>
            <Link href="/knowledge" className="inline-flex min-h-11 items-center text-sm text-accent hover:underline">
              Upload knowledge
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded border border-border px-3 text-xs" onClick={() => setScale((s) => Math.min(2, s + 0.2))}>
              Zoom in
            </button>
            <button type="button" className="min-h-11 rounded border border-border px-3 text-xs" onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}>
              Zoom out
            </button>
            <span className="inline-flex min-h-11 items-center text-xs text-text-muted">
              {nodes.length} nodes · {edges.length} links
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <svg viewBox="0 0 440 360" className="h-[360px] w-full" style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
              {edges.map((edge, index) => {
                const a = positions.get(edge.source);
                const b = positions.get(edge.target);
                if (!a || !b) return null;
                return (
                  <line
                    key={`${edge.source}-${edge.target}-${index}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth={1}
                  />
                );
              })}
              {nodes.map((node) => {
                const pos = positions.get(node.id);
                if (!pos) return null;
                const r = Math.max(10, Math.min(22, (node.size ?? 28) / 2));
                return (
                  <g key={node.id} className="cursor-pointer" onClick={() => setSelected(node)}>
                    <circle cx={pos.x} cy={pos.y} r={r} className="fill-accent/30 stroke-accent" strokeWidth={1.5} />
                    <text x={pos.x} y={pos.y + r + 12} textAnchor="middle" className="fill-text-muted text-[9px]">
                      {node.label.slice(0, 18)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          {selected ? (
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium text-text-primary">{selected.label}</p>
              <p className="mt-1 text-xs text-text-muted">{selected.kind}</p>
              {selected.href ? (
                <Link href={selected.href} className="mt-2 inline-flex min-h-11 items-center text-sm text-accent hover:underline">
                  Open
                </Link>
              ) : null}
              <button type="button" className="ml-3 inline-flex min-h-11 items-center text-xs text-text-muted" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          ) : null}
        </div>
      )}
    </AgentOsShell>
  );
}

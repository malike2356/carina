import { useEffect, useMemo, useState } from 'react';
import { getArtifacts, type ArtifactSummary } from '../../lib/gateway-client.js';
import { openCanvasWindow } from '../../lib/canvas-window.js';
import { sessionTitle } from '../../lib/artifacts-store.js';

const TYPE_LABELS: Record<ArtifactSummary['type'], string> = {
  html: 'HTML',
  svg: 'SVG',
  markdown: 'Markdown',
  code: 'Code',
  image: 'Image',
  data: 'Data',
};

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ArtifactSummary['type']>('all');

  useEffect(() => {
    void getArtifacts().then(setArtifacts);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return artifacts.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.sessionId.toLowerCase().includes(q);
    });
  }, [artifacts, query, typeFilter]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-lg font-semibold text-zinc-100">Artifacts</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artifacts"
          className="ml-auto px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg"
        >
          <option value="all">All types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No artifacts yet. Code blocks from chat appear here automatically.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((artifact) => (
            <article key={artifact.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{TYPE_LABELS[artifact.type]}</p>
                  <h2 className="text-sm font-medium text-zinc-100 mt-1">{artifact.title}</h2>
                </div>
                <span className="text-[10px] text-zinc-600">{artifact.size} B</span>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                {sessionTitle(artifact.sessionId)} | {new Date(artifact.createdAt).toLocaleString()}
              </p>
              <button
                type="button"
                onClick={() => void openCanvasWindow(artifact)}
                className="mt-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded px-2 py-1"
              >
                Open in Canvas
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

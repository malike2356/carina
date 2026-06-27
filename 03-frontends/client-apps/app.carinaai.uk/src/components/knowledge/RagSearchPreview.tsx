'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

interface RagResult {
  id: string;
  source: string;
  pack: string;
  content: string;
}

interface SearchResponse {
  results: RagResult[];
}

export function RagSearchPreview() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RagResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch(
        `/api/knowledge/search?q=${encodeURIComponent(query.trim())}&limit=5`,
      );
      if (!res.ok) {
        setResults([]);
        setSearched(true);
        return;
      }
      const data = (await res.json()) as SearchResponse;
      setResults(data.results ?? []);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  function snippet(content: string): string {
    const trimmed = content.slice(0, 220);
    const lastSpace = trimmed.lastIndexOf(' ');
    return lastSpace > 150 ? trimmed.slice(0, lastSpace) + '...' : trimmed + '...';
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-text">Search Preview</h2>
        <p className="mt-0.5 text-xs text-text-muted">
          Verify that ingested content is retrievable before relying on it in a session.
        </p>
      </div>

      <div className="p-5">
        <form onSubmit={(e) => { void handleSearch(e); }} className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the knowledge base..."
            className="flex-1 rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="flex items-center gap-1.5 rounded-md bg-elevated border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:text-text disabled:opacity-40"
          >
            {loading ? <Spinner /> : <Search className="h-3.5 w-3.5" />}
            Search
          </button>
        </form>

        {!searched && !loading && (
          <p className="mt-4 text-center text-xs text-text-muted">
            Enter a query to preview what Carina will retrieve.
          </p>
        )}

        {searched && results.length === 0 && (
          <p className="mt-4 text-center text-xs text-text-muted">
            No results found for this query.
          </p>
        )}

        {results.length > 0 && (
          <div className="mt-4 space-y-3">
            {results.map((r, i) => (
              <div
                key={r.id ?? i}
                className="rounded-md border border-border bg-elevated/40 p-3"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="font-mono text-xs text-text-muted truncate max-w-xs">{r.source}</span>
                  <span className="ml-auto shrink-0 rounded-full bg-elevated px-2 py-0.5 text-xs text-text-muted">
                    {r.pack}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-text-secondary">{snippet(r.content)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

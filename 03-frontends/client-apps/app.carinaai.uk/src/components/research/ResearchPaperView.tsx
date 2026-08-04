'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Pencil, Printer, Save } from 'lucide-react';
import { CarinaEditor } from '@/components/editor';
import { looksLikeHtml } from '@/components/editor/tiptap-extensions';
import {
  htmlContainsLiteralMarkdown,
  normalizeDocumentHtml,
} from '@/components/editor/markdown-normalize';
import { Button } from '@/components/ui/button';
import {
  CITATION_STYLES,
  citationStyleLabel,
  formatReferenceEntry,
  parseCitationStyle,
  referencesHeading,
  type CitationStyleId,
} from '@/lib/research-citation-styles';
import { sanitizeCarinaProse } from '@/lib/writing-style';
import { cn } from '@/lib/utils';
import './research-paper.css';

export type ResearchPaperSource = {
  url: string;
  title: string;
  snippet: string;
};

type ResearchPaperViewProps = {
  jobId: string;
  query: string;
  mode: string;
  rounds: number;
  citationStyle?: string | null;
  createdAt: string;
  content: string;
  sources: ResearchPaperSource[];
  onSaved?: (next: { output: string; citationStyle: CitationStyleId }) => void;
};

const paperComponents: Components = {
  h1: ({ children }) => <h1 className="research-paper-title">{children}</h1>,
  h2: ({ children }) => <h2 className="research-paper-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="research-paper-h3">{children}</h3>,
  h4: ({ children }) => <h4 className="research-paper-h3">{children}</h4>,
  p: ({ children }) => <p className="research-paper-p">{children}</p>,
  ul: ({ children }) => <ul className="research-paper-ul">{children}</ul>,
  ol: ({ children }) => <ol className="research-paper-ol research-paper-ref-list">{children}</ol>,
  li: ({ children }) => <li className="research-paper-li">{children}</li>,
  strong: ({ children }) => <strong className="research-paper-strong">{children}</strong>,
  em: ({ children }) => <em className="research-paper-em">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="research-paper-link">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="research-paper-quote">{children}</blockquote>,
  hr: () => <hr className="research-paper-hr" />,
};

function hasReferencesHeading(text: string, style: CitationStyleId): boolean {
  const lower = text.toLowerCase();
  const headings = [
    referencesHeading(style),
    'References',
    'Works Cited',
    'Bibliography',
    'Reference List',
  ];
  return headings.some((heading) => {
    const h = heading.toLowerCase();
    return (
      lower.includes(`## ${h}`)
      || lower.includes(`<h2>${h}</h2>`)
      || lower.includes(`<h2>${h}</h2>`.toLowerCase())
      || new RegExp(`<h[1-4][^>]*>\\s*${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h[1-4]>`, 'i').test(text)
    );
  });
}

export function ResearchPaperView({
  jobId,
  query,
  mode,
  rounds,
  citationStyle,
  createdAt,
  content,
  sources,
  onSaved,
}: ResearchPaperViewProps) {
  const savedStyle = parseCitationStyle(citationStyle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => normalizeDocumentHtml(content));
  const [selectedStyle, setSelectedStyle] = useState<CitationStyleId>(savedStyle);
  const [saving, setSaving] = useState(false);
  const [applyingStyle, setApplyingStyle] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  useEffect(() => {
    setDraft(normalizeDocumentHtml(content));
    setEditing(false);
    setSaveError(null);
    setStatusNote(null);
    setSelectedStyle(parseCitationStyle(citationStyle));
  }, [jobId, content, citationStyle]);

  const sanitized = useMemo(() => {
    const cleaned = sanitizeCarinaProse(content, { preserveWhitespace: true });
    if (looksLikeHtml(cleaned) && htmlContainsLiteralMarkdown(cleaned)) {
      return normalizeDocumentHtml(cleaned);
    }
    return cleaned;
  }, [content]);
  const contentIsHtml = looksLikeHtml(sanitized);
  void query;
  void mode;
  void rounds;
  void createdAt;
  const bibliography = useMemo(
    () =>
      [...sources]
        .sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }))
        .map((source, index) => ({
          source,
          entry: formatReferenceEntry(savedStyle, source, index),
        })),
    [sources, savedStyle],
  );
  const styleDirty = selectedStyle !== savedStyle;
  const hasSources = sources.length > 0;
  const showFallbackRefs =
    hasSources && !hasReferencesHeading(sanitized, savedStyle);

  async function saveEdits() {
    setSaving(true);
    setSaveError(null);
    setStatusNote(null);
    try {
      const cleaned = sanitizeCarinaProse(draft, { preserveWhitespace: true });
      const response = await fetch(`/api/research/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output: cleaned }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSaveError(data.error ?? 'Could not save edits');
        return;
      }
      onSaved?.({
        output: data.data?.output ?? cleaned,
        citationStyle: parseCitationStyle(data.data?.citationStyle ?? savedStyle),
      });
      setDraft(normalizeDocumentHtml(data.data?.output ?? cleaned));
      setEditing(false);
      setStatusNote('Edits saved');
    } catch {
      setSaveError('Could not save edits');
    } finally {
      setSaving(false);
    }
  }

  async function applyCitationStyle(force = false) {
    if (!hasSources) {
      setSaveError('This paper has no saved web sources. Run a new research job to gather citable sources.');
      return;
    }
    if (!force && !styleDirty) {
      setStatusNote('Already using this citation style. Click Apply again to rebuild the reference list.');
      // Still allow rebuild when user insists via force.
    }

    setApplyingStyle(true);
    setSaveError(null);
    setStatusNote(null);
    try {
      const response = await fetch(`/api/research/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citationStyle: selectedStyle,
          reformatCitations: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSaveError(data.error ?? 'Could not update citation style');
        return;
      }
      const nextStyle = parseCitationStyle(data.data?.citationStyle ?? selectedStyle);
      const nextOutput = String(data.data?.output ?? content);
      onSaved?.({ output: nextOutput, citationStyle: nextStyle });
      setDraft(normalizeDocumentHtml(nextOutput));
      setSelectedStyle(nextStyle);
      setEditing(false);
      setStatusNote(`References rebuilt as ${citationStyleLabel(nextStyle)}`);
    } catch {
      setSaveError('Could not update citation style');
    } finally {
      setApplyingStyle(false);
    }
  }

  function printPaper() {
    window.print();
  }

  return (
    <div className="research-paper-shell">
      <div className="research-paper-ribbon print:hidden">
        {editing ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || applyingStyle}
              onClick={() => {
                setDraft(normalizeDocumentHtml(content));
                setEditing(false);
                setSaveError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={saving || applyingStyle} onClick={() => void saveEdits()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? 'Saving' : 'Save edits'}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={applyingStyle} onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={printPaper}>
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>

        <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-[#5f6368]">
          <span className="hidden sm:inline">Citation</span>
          <select
            value={selectedStyle}
            disabled={applyingStyle || editing || !hasSources}
            onChange={(event) => setSelectedStyle(parseCitationStyle(event.target.value))}
            aria-label="Citation style"
          >
            {CITATION_STYLES.map((style) => (
              <option key={style.id} value={style.id}>
                {style.shortLabel}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          size="sm"
          disabled={applyingStyle || editing || !hasSources}
          onClick={() => void applyCitationStyle(true)}
        >
          {applyingStyle ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {applyingStyle ? 'Updating' : styleDirty ? 'Apply style' : 'Rebuild refs'}
        </Button>

        {!hasSources ? (
          <p className="research-paper-ribbon-note is-error">
            No saved web sources on this paper, so citation style cannot be rebuilt. Start a new research job for citable URLs.
          </p>
        ) : null}
        {saveError ? <p className="research-paper-ribbon-note is-error">{saveError}</p> : null}
        {statusNote ? <p className="research-paper-ribbon-note is-ok">{statusNote}</p> : null}
      </div>

      <div className="research-paper-scroll">
        <article
          id="research-paper-print-root"
          className={cn('research-paper-page', editing && 'research-paper-page-editing')}
        >
          {editing ? (
            <CarinaEditor
              value={draft}
              onChange={setDraft}
              engine="tiptap"
              defaultEngine="tiptap"
              showEngineSwitch={false}
              showToolbar
              pageLayout
              contentFormat="html"
              toolbarDensity="full"
              minHeight="70vh"
              placeholder="Write your research paper..."
            />
          ) : contentIsHtml ? (
            <div
              className="research-paper-html"
              dangerouslySetInnerHTML={{ __html: sanitized }}
            />
          ) : (
            <>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={paperComponents}>
                {sanitized}
              </ReactMarkdown>

              {showFallbackRefs ? (
                <section className="research-paper-refs">
                  <h2 className="research-paper-h2">{referencesHeading(savedStyle)}</h2>
                  <div className="research-paper-ref-stack">
                    {bibliography.map(({ source, entry }) => (
                      <p key={source.url} className="research-paper-ref-hanging">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="research-paper-link"
                        >
                          {entry}
                        </a>
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </article>
      </div>
    </div>
  );
}

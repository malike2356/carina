'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, Link2, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

type Tab = 'file' | 'text' | 'url';
type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

interface UploadResult {
  chunksInserted: number;
  source: string;
  alreadyIngested?: boolean;
  title?: string;
}

interface KnowledgeUploadPanelProps {
  onIngested?: () => void;
}

const ACCEPTED_EXTENSIONS = ['.md', '.txt', '.pdf', '.docx'];
const MAX_TEXT_CHARS = 100_000;

export function KnowledgeUploadPanel({ onIngested }: KnowledgeUploadPanelProps) {
  const { push: toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>('file');
  const [pack, setPack] = useState('user-resources');
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [url, setUrl] = useState('');

  function resetState() {
    setStatus('idle');
    setResult(null);
    setErrorMsg(null);
  }

  function pickFile(f: File) {
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setErrorMsg(`File type not allowed. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`);
      return;
    }
    setFile(f);
    resetState();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  async function submitFile() {
    if (!file) return;
    setStatus('uploading');
    setResult(null);
    setErrorMsg(null);
    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch('/api/knowledge/upload/file', {
        method: 'POST',
        headers: {
          'x-filename': file.name,
          'x-pack': pack,
          'content-type': 'application/octet-stream',
        },
        body: buffer,
      });
      const data = (await res.json()) as UploadResult & { error?: string };
      if (!res.ok) {
        const msg = data.error ?? 'Upload failed';
        setStatus('error');
        setErrorMsg(msg);
        toast(msg, 'error');
        return;
      }
      setStatus('done');
      setResult(data);
      if (data.alreadyIngested) {
        toast('Already ingested. Delete the source first to re-ingest.', 'info');
      } else {
        toast(`Done. ${data.chunksInserted} chunks ingested.`, 'success');
        onIngested?.();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setStatus('error');
      setErrorMsg(msg);
      toast(msg, 'error');
    }
  }

  async function submitText() {
    if (!textContent.trim() || !textTitle.trim()) return;
    setStatus('uploading');
    setResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/knowledge/upload/text', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: textContent, title: textTitle, pack }),
      });
      const data = (await res.json()) as UploadResult & { error?: string };
      if (!res.ok) {
        const msg = data.error ?? 'Upload failed';
        setStatus('error');
        setErrorMsg(msg);
        toast(msg, 'error');
        return;
      }
      setStatus('done');
      setResult(data);
      if (data.alreadyIngested) {
        toast('Already ingested. Delete the source first to re-ingest.', 'info');
      } else {
        toast(`Done. ${data.chunksInserted} chunks ingested.`, 'success');
        setTextContent('');
        setTextTitle('');
        onIngested?.();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setStatus('error');
      setErrorMsg(msg);
      toast(msg, 'error');
    }
  }

  async function submitUrl() {
    if (!url.startsWith('https://')) return;
    setStatus('uploading');
    setResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/knowledge/upload/url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, pack }),
      });
      const data = (await res.json()) as UploadResult & { error?: string };
      if (!res.ok) {
        const msg = data.error ?? 'Fetch failed';
        setStatus('error');
        setErrorMsg(msg);
        toast(msg, 'error');
        return;
      }
      setStatus('done');
      setResult(data);
      if (data.alreadyIngested) {
        toast('Already ingested. Delete the source first to re-ingest.', 'info');
      } else {
        toast(`Done. ${data.chunksInserted} chunks ingested${data.title ? ` from "${data.title}"` : ''}.`, 'success');
        setUrl('');
        onIngested?.();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fetch failed';
      setStatus('error');
      setErrorMsg(msg);
      toast(msg, 'error');
    }
  }

  const isUploading = status === 'uploading';
  const canSubmitFile = !!file && !isUploading;
  const canSubmitText = !!textContent.trim() && !!textTitle.trim() && !isUploading;
  const canSubmitUrl = url.startsWith('https://') && !isUploading;

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-text">Add Knowledge</h2>
        <p className="mt-0.5 text-xs text-text-muted">
          Upload a file, paste text, or provide a URL to grow the RAG knowledge base.
        </p>
      </div>

      <div className="flex border-b border-border">
        {([
          { id: 'file' as Tab, label: 'File', icon: Upload },
          { id: 'text' as Tab, label: 'Paste Text', icon: FileText },
          { id: 'url' as Tab, label: 'URL', icon: Link2 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); resetState(); }}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors',
              tab === id
                ? 'border-b-2 border-accent text-text'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {tab === 'file' && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
                dragOver
                  ? 'border-accent bg-accent/5'
                  : 'border-border hover:border-border-hover hover:bg-elevated/30',
              )}
            >
              <Upload className="mb-2 h-8 w-8 text-text-muted" />
              {file ? (
                <p className="text-sm font-medium text-text">{file.name}</p>
              ) : (
                <p className="text-sm text-text-muted">
                  Drop a file here, or <span className="text-accent">click to browse</span>
                </p>
              )}
              <p className="mt-1 text-xs text-text-muted">
                {ACCEPTED_EXTENSIONS.join('  ')} - max 10 MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(',')}
                className="hidden"
                onChange={onFileChange}
              />
            </div>
          </>
        )}

        {tab === 'text' && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Title</label>
              <input
                type="text"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="e.g. Product FAQ, Company Policy"
                className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary">Content</label>
                <span className={cn(
                  'text-xs',
                  textContent.length > MAX_TEXT_CHARS * 0.9 ? 'text-amber-400' : 'text-text-muted',
                )}>
                  {textContent.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()}
                </span>
              </div>
              <textarea
                rows={8}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Paste your knowledge content here..."
                className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none resize-y"
              />
            </div>
          </>
        )}

        {tab === 'url' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-xs text-text-muted">
              HTML pages are stripped to plain text. Direct PDF or DOCX URLs are also supported.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-text-secondary">Pack</label>
            <input
              type="text"
              value={pack}
              onChange={(e) => setPack(e.target.value || 'user-resources')}
              placeholder="user-resources"
              className="w-28 rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <button
            onClick={() => {
              if (tab === 'file') void submitFile();
              else if (tab === 'text') void submitText();
              else void submitUrl();
            }}
            disabled={
              (tab === 'file' && !canSubmitFile) ||
              (tab === 'text' && !canSubmitText) ||
              (tab === 'url' && !canSubmitUrl)
            }
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-40"
          >
            {isUploading ? 'Ingesting...' : tab === 'url' ? 'Fetch and Ingest' : 'Ingest'}
          </button>
        </div>

        {status === 'done' && result && !result.alreadyIngested && (
          <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-300">
            Done. {result.chunksInserted} chunk{result.chunksInserted !== 1 ? 's' : ''} ingested from{' '}
            <span className="font-mono">{result.source}</span>.
          </div>
        )}
        {status === 'done' && result?.alreadyIngested && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Already ingested. Delete the existing source first to re-ingest.
          </div>
        )}
        {status === 'error' && errorMsg && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}

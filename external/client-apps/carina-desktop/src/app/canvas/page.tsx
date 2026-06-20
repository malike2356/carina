import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getArtifact } from '../../lib/gateway-client.js';
import MarkdownContent from '../../components/chat/MarkdownContent.js';
import { saveTextWithDialog } from '../../lib/fs-dialogs.js';

export default function CanvasPage() {
  const [params] = useSearchParams();
  const artifactId = params.get('id');
  const [artifact, setArtifact] = useState<Awaited<ReturnType<typeof getArtifact>>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artifactId) {
      setLoading(false);
      return;
    }
    void getArtifact(artifactId).then((item) => {
      setArtifact(item);
      setLoading(false);
    });
  }, [artifactId]);

  const content = artifact?.content ?? '';

  const dataUrl = useMemo(() => {
    if (artifact?.type !== 'image' || !content) return '';
    if (content.startsWith('data:')) return content;
    return `data:image/png;base64,${content}`;
  }, [artifact?.type, content]);

  async function handleDownload() {
    if (!artifact) return;
    const ext = artifact.type === 'markdown' ? 'md' : artifact.type === 'html' ? 'html' : artifact.type;
    await saveTextWithDialog(`${artifact.title}.${ext}`, content);
  }

  async function handleClose() {
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().close();
    } catch {
      window.close();
    }
  }

  if (loading) return <div className="p-4 text-sm text-zinc-500">Loading artifact...</div>;
  if (!artifact) return <div className="p-4 text-sm text-zinc-500">Artifact not found.</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <h1 className="text-sm font-medium flex-1 truncate">{artifact.title}</h1>
        <button type="button" onClick={() => navigator.clipboard.writeText(content)} className="text-xs border border-zinc-700 rounded px-2 py-1">Copy</button>
        <button type="button" onClick={() => void handleDownload()} className="text-xs border border-zinc-700 rounded px-2 py-1">Download</button>
        <button type="button" onClick={() => artifactId && void getArtifact(artifactId).then(setArtifact)} className="text-xs border border-zinc-700 rounded px-2 py-1">Refresh</button>
        <button type="button" onClick={() => void handleClose()} className="text-xs border border-zinc-700 rounded px-2 py-1">Close</button>
      </header>
      <main className="flex-1 overflow-auto p-4">
        {artifact.type === 'html' && (
          <iframe title={artifact.title} srcDoc={content} sandbox="" className="w-full h-[70vh] rounded-lg border border-zinc-800 bg-white" />
        )}
        {artifact.type === 'svg' && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4" dangerouslySetInnerHTML={{ __html: content }} />
        )}
        {artifact.type === 'markdown' && <MarkdownContent content={content} />}
        {artifact.type === 'code' && (
          <pre className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-xs overflow-auto"><code>{content}</code></pre>
        )}
        {artifact.type === 'image' && dataUrl && (
          <img src={dataUrl} alt={artifact.title} className="max-w-full rounded-lg border border-zinc-800" />
        )}
        {artifact.type === 'data' && (
          <pre className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-xs overflow-auto">{content}</pre>
        )}
      </main>
    </div>
  );
}

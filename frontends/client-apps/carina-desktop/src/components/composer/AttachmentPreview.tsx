import type { Attachment } from '../../lib/composer-types.js';

interface Props {
  attachment: Attachment;
  onRemove: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentPreview({ attachment, onRemove }: Props) {
  return (
    <div className="relative flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs">
      {attachment.kind === 'image' ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="h-10 w-10 rounded object-cover"
        />
      ) : attachment.kind === 'url' ? (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-zinc-400">
          {attachment.favicon ? (
            <img src={attachment.favicon} alt="" className="h-4 w-4" />
          ) : (
            'URL'
          )}
        </div>
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-zinc-400">
          FILE
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-zinc-200">
          {attachment.kind === 'url' ? attachment.title ?? attachment.url : attachment.name}
        </p>
        <p className="truncate text-zinc-500">
          {attachment.kind === 'url'
            ? attachment.url
            : formatSize(attachment.size)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        aria-label="Remove attachment"
      >
        x
      </button>
    </div>
  );
}

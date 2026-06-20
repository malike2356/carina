import { useState } from 'react';

interface Props {
  content: string;
  isStreaming?: boolean;
}

export default function ThinkingBlock({ content, isStreaming }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-zinc-700 rounded-md mb-2 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 text-left"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>{'>'}</span>
        <span>{isStreaming ? 'Thinking...' : 'Reasoning'}</span>
        {isStreaming && <span className="ml-auto animate-pulse text-zinc-600">...</span>}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 text-xs text-zinc-500 font-mono whitespace-pre-wrap border-t border-zinc-700">
          {content || (isStreaming ? 'Working through the request...' : 'No reasoning captured.')}
        </div>
      )}
    </div>
  );
}

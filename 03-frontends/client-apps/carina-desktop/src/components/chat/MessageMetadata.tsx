import { useState } from 'react';

interface Props {
  timestamp: number;
  model?: string;
  onCopy: () => void;
}

export default function MessageMetadata({ timestamp, model, onCopy }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
      <span>{time}</span>
      {model && <span className="text-zinc-700">{model}</span>}
      <button type="button" onClick={handleCopy} className="hover:text-zinc-400">
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

import { useState } from 'react';
import type { ToolCall } from '../../store/chat.js';

interface Props {
  toolCall: ToolCall;
}

function statusLabel(status: ToolCall['status']): string {
  if (status === 'running') return 'Running';
  if (status === 'error') return 'Error';
  return 'Done';
}

function statusClass(status: ToolCall['status']): string {
  if (status === 'running') return 'text-yellow-400';
  if (status === 'error') return 'text-red-400';
  return 'text-green-400';
}

export default function ToolCallBlock({ toolCall }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-zinc-700 rounded-md mb-1 overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left"
      >
        <span className="text-zinc-400 font-mono">{toolCall.name}</span>
        <span className={`ml-auto ${statusClass(toolCall.status)}`}>
          {statusLabel(toolCall.status)}
        </span>
        {toolCall.durationMs !== undefined && (
          <span className="text-zinc-600">{toolCall.durationMs}ms</span>
        )}
        <span className={`transition-transform ${open ? 'rotate-90' : ''} text-zinc-600`}>{'>'}</span>
      </button>
      {open && (
        <div className="border-t border-zinc-700 divide-y divide-zinc-800">
          <div className="px-3 py-2">
            <p className="text-zinc-600 mb-1 uppercase tracking-wide text-[10px]">Args</p>
            <pre className="text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
          {toolCall.result !== undefined && (
            <div className="px-3 py-2">
              <p className="text-zinc-600 mb-1 uppercase tracking-wide text-[10px]">Result</p>
              <pre className={`overflow-x-auto whitespace-pre-wrap break-all ${toolCall.status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>
                {typeof toolCall.result === 'string'
                  ? toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

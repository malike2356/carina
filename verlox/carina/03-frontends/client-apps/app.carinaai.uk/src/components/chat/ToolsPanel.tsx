'use client';

import { useEffect, useRef } from 'react';
import { BookOpen, Globe, Image, Lightbulb, Pencil } from 'lucide-react';

export interface ChatTool {
  id: string;
  name: string;
  shortName: string;
  icon: React.ReactNode;
}

export const CHAT_TOOLS: ChatTool[] = [
  { id: 'create-image', name: 'Create an image', shortName: 'Image', icon: <Image className="h-3.5 w-3.5" /> },
  { id: 'search-web', name: 'Search the web', shortName: 'Search', icon: <Globe className="h-3.5 w-3.5" /> },
  { id: 'write-code', name: 'Write or code', shortName: 'Write', icon: <Pencil className="h-3.5 w-3.5" /> },
  {
    id: 'deep-research',
    name: 'Run deep research',
    shortName: 'Deep research',
    icon: <BookOpen className="h-3.5 w-3.5" />,
  },
  {
    id: 'think-longer',
    name: 'Think for longer',
    shortName: 'Think',
    icon: <Lightbulb className="h-3.5 w-3.5" />,
  },
];

interface ToolsPanelProps {
  onClose: () => void;
  onSelectTool: (tool: ChatTool) => void;
  selectedToolId: string | null;
}

export function ToolsPanel({ onClose, onSelectTool, selectedToolId }: ToolsPanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-50 mb-2 w-52 rounded-lg border border-border bg-overlay shadow-xl"
    >
      {CHAT_TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => {
            onSelectTool(tool);
            onClose();
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors hover:bg-elevated hover:text-text-primary ${
            selectedToolId === tool.id
              ? 'bg-elevated text-accent'
              : 'text-text-secondary'
          }`}
        >
          <span className={selectedToolId === tool.id ? 'text-accent' : 'text-accent/70'}>{tool.icon}</span>
          {tool.name}
        </button>
      ))}
    </div>
  );
}

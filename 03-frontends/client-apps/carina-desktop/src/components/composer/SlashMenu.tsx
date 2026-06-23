import { useEffect, useRef, useState } from 'react';
import type { GatewaySlashCommand } from '../../lib/gateway-client.js';

interface Props {
  query: string;
  commands: GatewaySlashCommand[];
  onSelect: (command: GatewaySlashCommand) => void;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<GatewaySlashCommand['category'], string> = {
  builtin: 'Built-in',
  skill: 'Skill',
  quick: 'Quick',
};

export default function SlashMenu({ query, commands, onSelect, onClose }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, commands.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, Math.max(commands.length - 1, 0)));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      }
      if (event.key === 'Enter' && commands[activeIndex]) {
        event.preventDefault();
        onSelect(commands[activeIndex]);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, commands, onClose, onSelect]);

  if (commands.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-500 shadow-xl">
        No commands match &quot;{query}&quot;
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
    >
      {commands.map((command, index) => (
        <button
          key={command.trigger}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(command)}
          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
            index === activeIndex ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          <span className="font-mono text-indigo-300">{command.trigger}</span>
          <span className="flex-1 truncate text-zinc-400">{command.description}</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
            {CATEGORY_LABEL[command.category]}
          </span>
        </button>
      ))}
    </div>
  );
}

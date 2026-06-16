'use client';

import { useEffect, useRef } from 'react';
import { FileText, Paperclip, Wand2 } from 'lucide-react';

interface AttachPanelProps {
  onClose: () => void;
  onAttachFiles: () => void;
  onAttachNote: () => void;
  onInjectPrompt: () => void;
}

export function AttachPanel({
  onClose,
  onAttachFiles,
  onAttachNote,
  onInjectPrompt,
}: AttachPanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }

    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [onClose]);

  const options = [
    { icon: <Paperclip className="h-3.5 w-3.5" />, label: 'Attach files', action: onAttachFiles },
    { icon: <FileText className="h-3.5 w-3.5" />, label: 'Note as context', action: onAttachNote },
    { icon: <Wand2 className="h-3.5 w-3.5" />, label: 'Inject prompt', action: onInjectPrompt },
  ];

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-50 mb-2 w-44 rounded-lg border border-border bg-overlay shadow-xl"
    >
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => {
            option.action();
            onClose();
          }}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
        >
          <span className="text-accent">{option.icon}</span>
          {option.label}
        </button>
      ))}
    </div>
  );
}

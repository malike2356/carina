import { FileText, StickyNote, X } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import type { ContextPin } from './types';

export function ContextChips({
  pins,
  onRemove,
}: {
  pins: ContextPin[];
  onRemove: (id: string) => void;
}) {
  if (pins.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pb-2">
      {pins.map((pin) => (
        <div
          key={pin.id}
          className="flex max-w-full items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-1 text-xs text-text-secondary"
        >
          {pin.pinType === 'note' ? (
            <StickyNote className="h-3 w-3 shrink-0 text-accent" />
          ) : (
            <FileText className="h-3 w-3 shrink-0 text-accent" />
          )}
          <span className="truncate">{pin.label}</span>
          <IconButton label={`Remove ${pin.label}`} size="sm" onClick={() => onRemove(pin.id)}>
            <X className="h-2.5 w-2.5" />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

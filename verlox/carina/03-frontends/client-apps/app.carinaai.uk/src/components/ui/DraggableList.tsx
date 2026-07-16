'use client';

import { useState, type ReactNode } from 'react';

export interface DraggableItem {
  id: string;
}

export function DraggableList<T extends DraggableItem>({
  items,
  onReorder,
  renderItem,
  className = '',
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, dragging: boolean) => ReactNode;
  className?: string;
}) {
  const [dragId, setDragId] = useState<string | null>(null);

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const fromIndex = items.findIndex((item) => item.id === fromId);
    const toIndex = items.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorder(next);
  }

  return (
    <div className={className}>
      {items.map((item) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => setDragId(item.id)}
          onDragEnd={() => setDragId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragId) reorder(dragId, item.id);
            setDragId(null);
          }}
          className={dragId === item.id ? 'opacity-60' : ''}
        >
          {renderItem(item, dragId === item.id)}
        </div>
      ))}
    </div>
  );
}

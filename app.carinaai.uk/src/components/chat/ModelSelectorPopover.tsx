'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Model {
  provider: string;
  model: string;
  label: string;
}

interface ModelSelectorPopoverProps {
  selectedProvider: string;
  selectedModel: string;
  disabled?: boolean;
  onSelect: (provider: string, model: string, label: string) => void;
}

export function ModelSelectorPopover({
  selectedProvider,
  selectedModel,
  disabled,
  onSelect,
}: ModelSelectorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/models')
      .then((response) => response.json())
      .then((data: { data?: Model[] }) => {
        if (data.data) setModels(data.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function outside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const filtered = models.filter(
    (model) =>
      model.label.toLowerCase().includes(search.toLowerCase()) ||
      model.provider.toLowerCase().includes(search.toLowerCase()),
  );

  const currentLabel = models.find(
    (model) => model.provider === selectedProvider && model.model === selectedModel,
  )?.label ?? (selectedProvider ? `${selectedProvider} / ${selectedModel}` : 'Select model');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-text-secondary transition-colors hover:border-border hover:bg-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="max-w-[140px] truncate">{currentLabel}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg border border-border bg-overlay shadow-xl">
          <div className="p-2">
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search models..."
              className="w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-text-muted">
                {models.length === 0 ? 'No keys configured. Add keys in Settings.' : 'No models match.'}
              </p>
            )}
            {filtered.map((model) => (
              <button
                key={`${model.provider}-${model.model}`}
                type="button"
                onClick={() => {
                  onSelect(model.provider, model.model, model.label);
                  setOpen(false);
                  setSearch('');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-elevated"
              >
                <Check
                  className={cn(
                    'h-3 w-3 shrink-0',
                    model.provider === selectedProvider && model.model === selectedModel
                      ? 'text-accent'
                      : 'opacity-0',
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-text-primary">{model.label}</p>
                  <p className="truncate text-text-muted">{model.provider}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

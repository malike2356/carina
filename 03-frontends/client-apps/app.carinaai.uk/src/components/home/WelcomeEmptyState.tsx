'use client';

import { useProductSurface } from '@/hooks/useProductSurface';

const SUGGESTIONS: Record<string, string[]> = {
  aiva: [
    'Help me draft a reply to a client email',
    'Book an appointment for next Tuesday at 2pm',
    'Follow up with James about the proposal',
    'Summarise the documents I uploaded last week',
  ],
  cloud: [
    'Help me draft a reply to a client email',
    'Summarise the documents I uploaded last week',
    'Research the top contractors in my area',
    'Set a reminder to follow up with James on Thursday',
  ],
};

type WelcomeEmptyStateProps = {
  onSuggestionClick: (text: string) => void;
};

export function WelcomeEmptyState({ onSuggestionClick }: WelcomeEmptyStateProps) {
  const surface = useProductSurface();
  const suggestions = SUGGESTIONS[surface] ?? SUGGESTIONS.cloud;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-text-primary">
        Your agent is ready.
      </h2>
      <p className="mt-2 max-w-sm text-sm text-text-muted">
        Start a conversation and it will remember what matters, build skills over time, and get
        better at working with you.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestionClick(s)}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-text-secondary transition-colors hover:border-accent/40 hover:bg-elevated hover:text-text-primary"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

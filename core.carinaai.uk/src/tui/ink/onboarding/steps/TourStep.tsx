import React from 'react';
import { Box, Text } from 'ink';
import { SelectList } from '../components/SelectList.js';
import { StepChrome } from '../components/StepChrome.js';
import type { TourChoice } from '../types.js';

const TOUR_OPTIONS = [
  { label: 'Yes; show me everything (2 min quickstart)', value: 'yes' as const, hint: 'Recommended' },
  { label: 'No; take me straight to chat', value: 'no' as const, hint: 'Skip the tour' },
  { label: 'Later; remind me next time', value: 'later' as const, hint: 'Soft nudge on next launch' },
];

export function TourStep({
  onNext,
}: {
  onNext: (choice: TourChoice) => void;
}) {
  return (
    <StepChrome
      step={6}
      title="Almost done! Want the full tour?"
      hint="A quick map of what Carina can do. Optional, but useful on day one."
    >
      <SelectList items={TOUR_OPTIONS} onSelect={onNext} />
    </StepChrome>
  );
}

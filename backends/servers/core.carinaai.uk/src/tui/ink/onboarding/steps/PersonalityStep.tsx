import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { SelectList } from '../components/SelectList.js';
import { StepChrome } from '../components/StepChrome.js';
import { PERSONALITY_PRESETS } from '../copy.js';
import type { PersonalityPreset } from '../types.js';

export function PersonalityStep({
  onNext,
}: {
  onNext: (personality: PersonalityPreset) => void;
}) {
  const [preview, setPreview] = useState(PERSONALITY_PRESETS[0]!.preview);

  return (
    <StepChrome
      step={5}
      title="How should I talk?"
      hint={'Every agent has a voice. Pick a starting personality.\nYou can customize this anytime in SOUL.md.'}
    >
      <SelectList
        items={PERSONALITY_PRESETS.map((preset) => ({
          label: preset.label,
          value: preset.value,
          hint: preset.hint,
        }))}
        onSelect={(value) => {
          const preset = PERSONALITY_PRESETS.find((p) => p.value === value);
          if (preset) setPreview(preset.preview);
          onNext(value);
        }}
      />
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Preview:</Text>
        <Text color="#e6edf3">{`"${preview}"`}</Text>
      </Box>
    </StepChrome>
  );
}

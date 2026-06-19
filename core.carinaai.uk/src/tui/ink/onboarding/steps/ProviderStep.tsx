import React, { useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { SelectList } from '../components/SelectList.js';
import { StepChrome } from '../components/StepChrome.js';
import { ONBOARDING_MODELS, ONBOARDING_PROVIDERS } from '../types.js';

export function ProviderStep({
  onNext,
}: {
  onNext: (provider: string, model: string) => void;
}) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const models = useMemo(() => {
    if (!selectedProvider) return [];
    const list = ONBOARDING_MODELS[selectedProvider] ?? ['default'];
    return list.map((model) => ({ label: model, value: model }));
  }, [selectedProvider]);

  if (!selectedProvider) {
    return (
      <StepChrome
        step={2}
        title="Choose your AI engine."
        hint={'I can run on different AI providers. Pick one to start.\nYou can add more later, and I will fall back if one goes down.'}
      >
        <SelectList
          items={ONBOARDING_PROVIDERS.map((p) => ({
            label: p.label,
            value: p.value,
            hint: p.hint,
          }))}
          onSelect={setSelectedProvider}
        />
      </StepChrome>
    );
  }

  const providerName = ONBOARDING_PROVIDERS.find((p) => p.value === selectedProvider)?.label
    ?? selectedProvider;

  return (
    <StepChrome
      step={2}
      title={`Default model for ${providerName}`}
      hint="Pick the model you want to start with. You can switch anytime."
    >
      <SelectList
        items={models}
        onSelect={(model) => onNext(selectedProvider, model)}
      />
      <Box marginTop={1}>
        <Text dimColor>Press Esc in a future step to re-run setup if you need a different provider.</Text>
      </Box>
    </StepChrome>
  );
}

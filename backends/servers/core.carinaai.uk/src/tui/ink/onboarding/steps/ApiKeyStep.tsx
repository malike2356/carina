import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { StepChrome } from '../components/StepChrome.js';
import { SpinnerLine } from '../components/SpinnerLine.js';
import { API_KEY_ERRORS } from '../copy.js';
import { ONBOARDING_PROVIDERS } from '../types.js';
import { validateOnboardingProvider } from '../validate-provider.js';

const KEY_HELP: Record<string, string> = {
  anthropic: 'Find yours at console.anthropic.com/account/keys',
  openai: 'Find yours at platform.openai.com/api-keys',
  deepseek: 'Find yours at platform.deepseek.com/api_keys',
  gemini: 'Find yours at aistudio.google.com/app/apikey',
  groq: 'Find yours at console.groq.com/keys',
};

export function ApiKeyStep({
  provider,
  model,
  onNext,
}: {
  provider: string;
  model: string;
  onNext: (apiKey: string) => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [verified, setVerified] = useState(false);

  const providerName = ONBOARDING_PROVIDERS.find((p) => p.value === provider)?.label ?? provider;

  async function handleKeySubmit(key: string) {
    if (validating || verified) return;
    setValidating(true);
    setError(null);
    try {
      const ok = await validateOnboardingProvider(provider, key, model);
      if (ok) {
        setVerified(true);
        setTimeout(() => onNext(key), 450);
      } else {
        setError(API_KEY_ERRORS.invalid);
      }
    } catch {
      setError(API_KEY_ERRORS.network);
    } finally {
      setValidating(false);
    }
  }

  return (
    <StepChrome
      step={3}
      title={`API key for ${providerName}`}
      hint={'Your key is stored on your machine only.\nI never send it anywhere except to your chosen provider.'}
    >
      <Text dimColor>{KEY_HELP[provider] ?? ''}</Text>
      <Box marginTop={1}>
        <Text color="#58a6ff">{' > '}</Text>
        <TextInput
          mask="*"
          value={apiKey}
          onChange={setApiKey}
          onSubmit={handleKeySubmit}
          placeholder="Paste your API key here..."
        />
        {verified && (
          <Text color="#3fb950">{`  ${API_KEY_ERRORS.verified}`}</Text>
        )}
      </Box>
      {validating && (
        <Box marginTop={1}>
          <SpinnerLine message={API_KEY_ERRORS.validating} />
        </Box>
      )}
      {error && (
        <Box marginTop={1}>
          <Text color="#f85149">{error}</Text>
        </Box>
      )}
    </StepChrome>
  );
}

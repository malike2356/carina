import React, { useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import Gradient from 'ink-gradient';
import { CARINA_LOGO } from '../onboarding/branding.js';
import { personalityLabel } from '../onboarding/copy.js';
import { getActiveSkin } from '../../skins/skin-store.js';

export interface BannerProps {
  version: string;
  model: string;
  sessionId: string;
  workspaceName?: string;
  provider?: string;
  onDone: () => void;
}

function readBannerContext() {
  return {
    workspace: process.env.CARINA_OPERATOR_NAME?.trim() || 'My Workspace',
    provider: process.env.DEFAULT_PROVIDER?.trim() || process.env.CARINA_ACTIVE_PROVIDER?.trim() || 'local',
    profile: personalityLabel(
      (process.env.CARINA_VOICE_PRESET as 'direct' | 'warm' | 'technical' | 'custom' | undefined) ?? null,
    ),
  };
}

export function Banner({
  version,
  model,
  sessionId,
  workspaceName,
  provider,
  onDone,
}: BannerProps) {
  const skin = getActiveSkin();
  const ctx = useMemo(() => readBannerContext(), []);

  useInput(() => {
    onDone();
  });

  useEffect(() => {
    const timer = setTimeout(onDone, 3200);
    return () => clearTimeout(timer);
  }, [onDone]);

  const workspace = workspaceName ?? ctx.workspace;
  const providerLabel = provider ?? ctx.provider;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box flexDirection="column" alignItems="center">
        {skin.bannerGradient ? (
          <Gradient name={skin.bannerGradient as 'rainbow'}>
            <Text>{CARINA_LOGO.split('\n').slice(0, 3).join('\n')}</Text>
          </Gradient>
        ) : (
          <Text color={skin.bannerColor}>{CARINA_LOGO.split('\n').slice(0, 3).join('\n')}</Text>
        )}
        <Box marginTop={1}>
          <Text bold color={skin.accent}>{`C A R I N A${' '.repeat(18)}`}</Text>
          <Text dimColor>{`v${version}`}</Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          {'Workspace  '}
          <Text color={skin.accent}>{workspace}</Text>
        </Text>
        <Text dimColor>
          {'Model      '}
          <Text color={skin.accent}>{model}</Text>
          <Text dimColor>{`  ·  Session ${sessionId.slice(0, 8)}`}</Text>
        </Text>
        <Text dimColor>
          {'Provider   '}
          <Text color="#e6edf3">{providerLabel}</Text>
        </Text>
        <Text dimColor>
          {'Profile    '}
          <Text color="#e6edf3">{ctx.profile}</Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Type a message, or /help for commands.</Text>
      </Box>
    </Box>
  );
}

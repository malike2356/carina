import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Gradient from 'ink-gradient';
import {
  CARINA_LOGO,
  SETUP_DURATION,
  SETUP_INTRO,
  TAGLINE,
  TAGLINE_QUOTE,
  WELCOME_HEADLINE,
  WELCOME_MARK,
} from '../branding.js';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  const [taglineChars, setTaglineChars] = useState(0);
  const [showBody, setShowBody] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setTaglineChars(i);
      if (i >= TAGLINE.length) {
        clearInterval(interval);
        setTimeout(() => setShowBody(true), 300);
        setTimeout(() => setShowPrompt(true), 900);
      }
    }, 28);
    return () => clearInterval(interval);
  }, []);

  useInput((input, key) => {
    if (!showPrompt) return;
    if (key.return || input === ' ') onNext();
  });

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1} paddingX={2}>
      <Text bold color="#8b949e">{WELCOME_HEADLINE}</Text>
      <Box marginTop={1}>
        <Text dimColor>{WELCOME_MARK}</Text>
      </Box>
      <Box marginTop={1}>
        <Gradient name="rainbow">
          <Text>{CARINA_LOGO}</Text>
        </Gradient>
      </Box>
      <Box marginTop={1}>
        <Text bold color="#e6edf3">{TAGLINE.slice(0, taglineChars)}</Text>
        {taglineChars < TAGLINE.length && <Text color="#58a6ff">|</Text>}
      </Box>
      {showBody && (
        <Box marginTop={1} flexDirection="column" alignItems="center">
          <Text dimColor>{`"${TAGLINE_QUOTE}"`}</Text>
          <Box marginTop={1}>
            <Text color="#e6edf3">{SETUP_INTRO}</Text>
          </Box>
          <Text dimColor>{SETUP_DURATION}</Text>
        </Box>
      )}
      {showPrompt && (
        <Box marginTop={2}>
          <Text dimColor>[ </Text>
          <Text color="#58a6ff" bold>Press Enter to begin</Text>
          <Text dimColor> ]</Text>
        </Box>
      )}
    </Box>
  );
}

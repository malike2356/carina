import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { ChatMessage } from '../hooks/useMessages.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ToolCallBlock } from './ToolCallBlock.js';
import { InlineMarkdown } from './InlineMarkdown.js';
import { getActiveSkin } from '../../skins/skin-store.js';

interface Props {
  message: ChatMessage;
}

export function StreamingMessage({ message }: Props) {
  const skin = getActiveSkin();
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setCursorVisible((v) => !v), 250);
    return () => clearInterval(t);
  }, []);

  const textContent = message.parts
    .filter((p) => p.kind === 'text')
    .map((p) => p.content)
    .join('');

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={skin.accent} bold>{skin.responsePrefix}</Text>
      {message.parts.map((part, idx) => {
        if (part.kind === 'thinking') {
          return (
            <ThinkingBlock
              key={idx}
              content={part.content}
              isComplete={part.complete}
            />
          );
        }
        if (part.kind === 'tool') {
          return (
            <ToolCallBlock
              key={idx}
              toolName={part.toolName}
              args={part.args}
              result={part.result}
              duration={part.duration}
              isRunning={part.isRunning}
            />
          );
        }
        return null;
      })}
      {textContent && (
        <Box flexDirection="column">
          <InlineMarkdown content={textContent} />
          <Text color={skin.accent}>{cursorVisible ? skin.spinner.frames[0] : ' '}</Text>
        </Box>
      )}
      {!textContent && message.parts.length === 0 && (
        <Text dimColor>{cursorVisible ? '|' : ' '}</Text>
      )}
    </Box>
  );
}

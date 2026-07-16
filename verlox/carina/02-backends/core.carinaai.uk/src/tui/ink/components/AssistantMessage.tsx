import React from 'react';
import { Box, Text } from 'ink';
import type { ChatMessage } from '../hooks/useMessages.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ToolCallBlock } from './ToolCallBlock.js';
import { InlineMarkdown } from './InlineMarkdown.js';
import { getActiveSkin } from '../../skins/skin-store.js';

interface Props {
  message: ChatMessage;
}

export function AssistantMessage({ message }: Props) {
  const skin = getActiveSkin();
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
              isError={part.isError}
            />
          );
        }
        if (part.content.trim()) {
          return (
            <Box key={idx} flexDirection="column">
              <InlineMarkdown content={part.content} />
            </Box>
          );
        }
        return null;
      })}
    </Box>
  );
}

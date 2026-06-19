import React from 'react';
import { Box, Text } from 'ink';
import { marked } from 'marked';
import type { Token, Tokens } from 'marked';

export interface InlineMarkdownProps {
  content: string;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<Text key={key++}>{text.slice(last, match.index)}</Text>);
    }
    const token = match[0]!;
    if (token.startsWith('**')) {
      parts.push(<Text key={key++} bold>{token.slice(2, -2)}</Text>);
    } else if (token.startsWith('`')) {
      parts.push(<Text key={key++} color="green">{token.slice(1, -1)}</Text>);
    } else if (token.startsWith('*')) {
      parts.push(<Text key={key++} dimColor>{token.slice(1, -1)}</Text>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    parts.push(<Text key={key++}>{text.slice(last)}</Text>);
  }
  return parts.length > 0 ? parts : text;
}

function renderToken(token: Token, key: number): React.ReactNode {
  switch (token.type) {
    case 'heading': {
      const t = token as Tokens.Heading;
      return (
        <Text key={key} bold color="cyan">
          {t.text}
          {'\n'}
        </Text>
      );
    }
    case 'paragraph': {
      const t = token as Tokens.Paragraph;
      return (
        <Text key={key} wrap="wrap">
          {renderInline(t.text)}
          {'\n'}
        </Text>
      );
    }
    case 'code': {
      const t = token as Tokens.Code;
      return (
        <Box key={key} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginY={1}>
          {t.lang ? <Text dimColor>{t.lang}</Text> : null}
          <Text wrap="wrap">{t.text}</Text>
        </Box>
      );
    }
    case 'list': {
      const t = token as Tokens.List;
      return (
        <Box key={key} flexDirection="column">
          {t.items.map((item, i) => (
            <Text key={i} wrap="wrap">
              {'  '}
              <Text color="cyan">{t.ordered ? `${i + 1}.` : '-'}</Text>
              {' '}
              {renderInline(item.text)}
            </Text>
          ))}
        </Box>
      );
    }
    case 'blockquote': {
      const t = token as Tokens.Blockquote;
      return (
        <Box key={key} borderStyle="single" borderColor="gray" paddingX={1} marginY={1}>
          <Text dimColor wrap="wrap">{t.text}</Text>
        </Box>
      );
    }
    case 'hr':
      return <Text key={key} dimColor>{`${'─'.repeat(40)}\n`}</Text>;
    case 'space':
      return null;
    default:
      return <Text key={key} wrap="wrap">{('raw' in token ? String(token.raw) : '')}</Text>;
  }
}

export function InlineMarkdown({ content }: InlineMarkdownProps) {
  const tokens = marked.lexer(content, { gfm: true });
  return (
    <Box flexDirection="column">
      {tokens.map((token, i) => renderToken(token, i))}
    </Box>
  );
}

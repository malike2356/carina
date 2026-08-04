import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { colors } from '../theme/colors.js';
import { FuzzySlashMenu } from './FuzzySlashMenu.js';
import { HistorySearch } from './HistorySearch.js';
import { buildSlashCatalog, type SlashCommand } from '../slash-catalog.js';
import { useInputHistory } from '../hooks/use-input-history.js';

interface Props {
  onSubmit: (text: string) => void;
  onClear?: () => void;
  onSlashCommand?: (command: string) => boolean;
  onExternalEditor?: (draft: string) => void;
  onDraftChange?: (draft: string) => void;
  disabled?: boolean;
}

export function InputBar({
  onSubmit,
  onClear,
  onSlashCommand,
  onExternalEditor,
  onDraftChange,
  disabled = false,
}: Props) {
  const [value, setValue] = useState('');
  const [multiline, setMultiline] = useState(false);
  const [lines, setLines] = useState<string[]>(['']);
  const slashCommands = useMemo(() => buildSlashCatalog(), []);
  const history = useInputHistory();

  const slashQuery = value.startsWith('/') ? value.slice(1) : '';
  const showSlashMenu = !disabled && value.startsWith('/') && !history.searchMode;
  const composerDraft = multiline ? lines.join('\n') : value;

  useEffect(() => {
    onDraftChange?.(composerDraft);
  }, [composerDraft, onDraftChange]);

  useEffect(() => {
    if (history.currentEntry !== null && !history.searchMode) {
      setValue(history.currentEntry);
    }
  }, [history.currentEntry, history.searchMode]);

  const submitText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    history.pushToHistory(trimmed);
    history.resetHistoryIndex();
    if (trimmed.startsWith('/') && onSlashCommand?.(trimmed)) {
      setValue('');
      setMultiline(false);
      setLines(['']);
      return;
    }
    onSubmit(trimmed);
    setValue('');
    setMultiline(false);
    setLines(['']);
  }, [history, onSlashCommand, onSubmit]);

  useInput((input, key) => {
    if (disabled) return;
    if (history.searchMode) return;
    if (showSlashMenu) return;

    if (key.ctrl && key.shift && input.toLowerCase() === 'r') {
      history.setSearchMode(true);
      history.setSearchQuery('');
      return;
    }
    if (key.ctrl && input === 'e' && onExternalEditor) {
      onExternalEditor(value);
      setValue('');
      return;
    }
    if (key.ctrl && input === 'j') {
      setMultiline((prev) => !prev);
      if (!multiline) setLines([value || '']);
      return;
    }
    if (multiline && key.return && key.ctrl) {
      submitText(lines.join('\n'));
      return;
    }
    if (multiline && key.return && !key.ctrl) {
      setLines((prev) => [...prev, '']);
      return;
    }
    if (key.upArrow) {
      history.navigateHistory('up');
      return;
    }
    if (key.downArrow) {
      history.navigateHistory('down');
      if (history.historyIndex <= 0) setValue('');
      return;
    }
    if (key.ctrl && input === 'l') {
      onClear?.();
    }
  });

  const handleSingleSubmit = (text: string) => {
    if (multiline) return;
    submitText(text);
  };

  const updateMultiline = (index: number, next: string) => {
    setLines((prev) => prev.map((line, i) => (i === index ? next : line)));
  };

  if (disabled) {
    return (
      <Box paddingX={1} borderStyle="single" borderColor={colors.dim}>
        <Text dimColor>Carina is responding...</Text>
      </Box>
    );
  }

  if (history.searchMode) {
    return (
      <HistorySearch
        query={history.searchQuery}
        onQueryChange={history.setSearchQuery}
        results={history.searchResults}
        onSelect={(entry) => {
          history.setSearchMode(false);
          setValue(entry);
          history.resetHistoryIndex();
        }}
        onClose={() => history.setSearchMode(false)}
      />
    );
  }

  return (
    <Box flexDirection="column">
      {showSlashMenu && (
        <FuzzySlashMenu
          query={slashQuery}
          commands={slashCommands}
          onSelect={(cmd: SlashCommand) => {
            setValue(cmd.insert);
          }}
          onClose={() => setValue('')}
        />
      )}
      {multiline ? (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
          <Text dimColor>Multi-line mode (Ctrl+Enter to send, Ctrl+J to exit)</Text>
          {lines.map((line, i) => (
            <Box key={i}>
              <Text dimColor>{i === lines.length - 1 ? '>' : ' '} </Text>
              {i === lines.length - 1 ? (
                <TextInput
                  value={line}
                  onChange={(v) => updateMultiline(i, v)}
                  onSubmit={() => setLines((prev) => [...prev, ''])}
                />
              ) : (
                <Text wrap="wrap">{line}</Text>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        <Box flexDirection="column" paddingX={1} borderStyle="single" borderColor={colors.primary}>
          <Box>
            <Text color={colors.accent}>{'> '}</Text>
            <TextInput
              value={value}
              onChange={(v) => {
                setValue(v);
                history.resetHistoryIndex();
              }}
              onSubmit={handleSingleSubmit}
              placeholder="Message Carina... (/ for commands)"
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

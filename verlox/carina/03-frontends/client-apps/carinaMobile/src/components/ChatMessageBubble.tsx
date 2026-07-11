import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '@/api/types';
import { colors, radii, spacing } from '@/theme/tokens';

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
          {message.content || (message.status === 'streaming' ? '...' : '')}
        </Text>
        {!isUser && message.provider ? (
          <Text style={styles.meta}>{message.provider}</Text>
        ) : null}
        {!isUser && message.inferenceType === 'local' ? (
          <Text style={styles.onDevice}>on-device</Text>
        ) : null}
        {!isUser && message.toolsUsed && message.toolsUsed.length > 0 ? (
          <Text style={styles.tools}>{message.toolsUsed.join(' · ')}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowUser: {
    alignItems: 'flex-end',
  },
  rowAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  bubbleUser: {
    backgroundColor: colors.inkLift,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleAssistant: {
    backgroundColor: colors.inkMid,
    borderWidth: 1,
    borderColor: colors.borderDim,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  textUser: {
    color: colors.white,
  },
  textAssistant: {
    color: colors.offWhite,
  },
  meta: {
    color: colors.silverMid,
    fontSize: 11,
  },
  onDevice: {
    color: colors.tealLight,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  tools: {
    color: colors.tealLight,
    fontSize: 11,
  },
});

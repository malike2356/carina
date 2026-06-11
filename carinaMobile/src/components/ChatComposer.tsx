import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

interface ChatComposerProps {
  text: string;
  onChangeText: (value: string) => void;
  onSend: (text: string) => void;
  onStop?: () => void;
  streaming?: boolean;
  disabled?: boolean;
  voiceAvailable?: boolean;
  voiceListening?: boolean;
  onVoicePress?: () => void;
}

export function ChatComposer({
  text,
  onChangeText,
  onSend,
  onStop,
  streaming,
  disabled,
  voiceAvailable,
  voiceListening,
  onVoicePress,
}: ChatComposerProps) {
  function handleSend() {
    const value = text.trim();
    if (!value || disabled || streaming) return;
    onSend(value);
    onChangeText('');
  }

  return (
    <View style={styles.wrap}>
      {voiceAvailable ? (
        <Pressable
          style={[styles.voiceBtn, voiceListening && styles.voiceBtnActive]}
          onPress={onVoicePress}
          accessibilityRole="button"
          accessibilityLabel={voiceListening ? 'Stop voice input' : 'Start voice input'}
          accessibilityHint="Dictate a message to Carina"
        >
          <Text style={[styles.voiceText, voiceListening && styles.voiceTextActive]}>
            {voiceListening ? 'Stop' : 'Mic'}
          </Text>
        </Pressable>
      ) : null}
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={onChangeText}
        placeholder="Message Carina..."
        placeholderTextColor={colors.silverMid}
        multiline
        maxLength={8000}
        editable={!disabled && !streaming && !voiceListening}
        accessibilityLabel="Message composer"
        accessibilityHint="Type a message for Carina"
      />
      {streaming ? (
        <Pressable
          style={styles.stopBtn}
          onPress={onStop}
          accessibilityRole="button"
          accessibilityLabel="Stop generating response"
        >
          <Text style={styles.stopText}>Stop</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.sendBtn, (!text.trim() || disabled) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || disabled}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          {disabled ? (
            <ActivityIndicator color={colors.ink} size="small" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderDim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.inkMid,
  },
  voiceBtn: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    minWidth: 44,
    alignItems: 'center',
  },
  voiceBtnActive: {
    borderColor: colors.amber,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
  },
  voiceText: {
    color: colors.silver,
    fontSize: 11,
    fontWeight: '700',
  },
  voiceTextActive: {
    color: colors.amber,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.white,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minWidth: 64,
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  stopBtn: {
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minWidth: 64,
    alignItems: 'center',
  },
  stopText: {
    color: colors.amber,
    fontWeight: '600',
    fontSize: 14,
  },
});

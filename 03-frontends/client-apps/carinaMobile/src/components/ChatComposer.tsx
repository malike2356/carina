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
  placeholder?: string;
  voiceAvailable?: boolean;
  voiceBlockedReason?: string | null;
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
  placeholder = 'Message Carina...',
  voiceAvailable = false,
  voiceBlockedReason,
  voiceListening,
  onVoicePress,
}: ChatComposerProps) {
  function handleSend() {
    const value = text.trim();
    if (!value || disabled || streaming) return;
    onSend(value);
    onChangeText('');
  }

  const showVoice = Boolean(onVoicePress);

  return (
    <View style={styles.wrap}>
      {showVoice ? (
        <Pressable
          style={[
            styles.voiceBtn,
            voiceListening && styles.voiceBtnActive,
            !voiceAvailable && styles.voiceBtnDisabled,
          ]}
          onPress={onVoicePress}
          disabled={!voiceAvailable && !voiceListening}
          accessibilityRole="button"
          accessibilityLabel={
            !voiceAvailable
              ? 'Voice input unavailable'
              : voiceListening
                ? 'Stop voice input'
                : 'Start voice input'
          }
          accessibilityHint={
            voiceBlockedReason ?? 'Dictate a message to Carina'
          }
        >
          <Text
            style={[
              styles.voiceText,
              voiceListening && styles.voiceTextActive,
              !voiceAvailable && styles.voiceTextDisabled,
            ]}
          >
            {voiceListening ? 'Stop' : 'Mic'}
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.inputCol}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.silverMid}
          multiline
          maxLength={8000}
          editable={!disabled && !streaming && !voiceListening}
          accessibilityLabel="Message composer"
          accessibilityHint="Type a message for Carina"
        />
        {showVoice && !voiceAvailable && voiceBlockedReason ? (
          <Text style={styles.voiceHint}>{voiceBlockedReason}</Text>
        ) : null}
      </View>
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
  inputCol: {
    flex: 1,
    gap: spacing.xs,
  },
  voiceBtn: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBtnActive: {
    borderColor: colors.amber,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
  },
  voiceBtnDisabled: {
    opacity: 0.45,
  },
  voiceText: {
    color: colors.silver,
    fontSize: 11,
    fontWeight: '700',
  },
  voiceTextActive: {
    color: colors.amber,
  },
  voiceTextDisabled: {
    color: colors.silverMid,
  },
  voiceHint: {
    color: colors.silverMid,
    fontSize: 11,
    lineHeight: 14,
    paddingHorizontal: spacing.xs,
  },
  input: {
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
    minHeight: 44,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: 44,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopText: {
    color: colors.amber,
    fontWeight: '600',
    fontSize: 14,
  },
});

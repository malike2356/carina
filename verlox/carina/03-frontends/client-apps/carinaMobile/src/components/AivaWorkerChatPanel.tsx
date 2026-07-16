import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AivaEmployeeMessage, AivaWorkerDetail } from '@/api/aiva-client';
import { colors, radii, spacing } from '@/theme/tokens';

function roleTitle(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) return 'AI worker';
  const first = trimmed.split(/[.!?\n]/)[0]?.trim() || trimmed;
  return first.length > 72 ? `${first.slice(0, 72)}...` : first;
}

type AivaWorkerChatPanelProps = {
  worker: AivaWorkerDetail;
  messages: AivaEmployeeMessage[];
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  busy?: boolean;
};

export function AivaWorkerChatPanel({
  worker,
  messages,
  message,
  onMessageChange,
  onSend,
  busy = false,
}: AivaWorkerChatPanelProps) {
  const listRef = useRef<FlatList<AivaEmployeeMessage>>(null);
  const title = roleTitle(worker.roleDescription);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length, busy]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{worker.name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.name} numberOfLines={1}>
            {worker.name}
          </Text>
          <Text style={styles.role} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.avatar, styles.emptyAvatar]}>
              <Text style={styles.avatarText}>{worker.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text style={styles.emptyTitle}>Welcome to your team</Text>
            <Text style={styles.emptyBody}>
              {worker.name} is ready to help. Start a conversation below, just like you would with a
              colleague on WhatsApp or email.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.sender === 'user';
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.content}</Text>
              <Text style={[styles.bubbleMeta, mine && styles.bubbleMetaMine]}>
                {mine ? 'You' : worker.name}
              </Text>
            </View>
          );
        }}
        ListFooterComponent={
          busy ? (
            <View style={styles.typing}>
              <ActivityIndicator color={colors.tealLight} size="small" />
              <Text style={styles.typingText}>{worker.name} is working...</Text>
            </View>
          ) : null
        }
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={onMessageChange}
          placeholder={`Message ${worker.name}`}
          placeholderTextColor={colors.silverMid}
          multiline
          editable={!busy}
        />
        <Pressable
          style={[styles.sendBtn, (busy || !message.trim()) && styles.sendDisabled]}
          onPress={onSend}
          disabled={busy || !message.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDim,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.inkLift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAvatar: { width: 56, height: 56, marginBottom: spacing.sm },
  avatarText: { color: colors.tealLight, fontWeight: '700', fontSize: 16 },
  headerBody: { flex: 1, minWidth: 0 },
  name: { color: colors.white, fontSize: 16, fontWeight: '600' },
  role: { color: colors.silverMid, fontSize: 12, marginTop: 2 },
  list: { flex: 1 },
  listContent: { paddingVertical: spacing.md, gap: spacing.sm, flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  emptyTitle: { color: colors.white, fontSize: 16, fontWeight: '600', marginBottom: spacing.xs },
  emptyBody: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.teal,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.inkMid,
    borderWidth: 1,
    borderColor: colors.borderDim,
  },
  bubbleText: { color: colors.white, fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: colors.white },
  bubbleMeta: { color: colors.silverMid, fontSize: 11, marginTop: 4 },
  bubbleMetaMine: { color: 'rgba(255,255,255,0.75)' },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  typingText: { color: colors.silverMid, fontSize: 12 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderDim,
    paddingTop: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.white,
    backgroundColor: colors.inkMid,
    fontSize: 15,
  },
  sendBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
  sendText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});

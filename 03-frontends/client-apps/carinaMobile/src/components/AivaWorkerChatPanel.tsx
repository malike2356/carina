import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const title = roleTitle(worker.roleDescription);
  /** Android uses adjustNothing; pad composer by keyboard height (same as main Chat tab). */
  const [androidKeyboardPad, setAndroidKeyboardPad] = useState(0);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  };

  useEffect(() => {
    if (messages.length === 0 && !busy) return;
    scrollToEnd();
  }, [messages.length, busy]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const liftComposer = (event: { endCoordinates?: { height?: number; screenY?: number } }) => {
      if (Platform.OS !== 'android') return;
      const height = Math.round(event.endCoordinates?.height ?? 0);
      const screenY = event.endCoordinates?.screenY ?? 0;
      const fromScreen = Math.max(0, Math.round(Dimensions.get('screen').height - screenY));
      const pad = Math.max(height, fromScreen);
      setAndroidKeyboardPad(pad > 0 ? pad : 0);
    };

    const show = Keyboard.addListener(showEvent, (event) => {
      liftComposer(event);
      scrollToEnd();
    });
    const change =
      Platform.OS === 'android'
        ? Keyboard.addListener('keyboardDidChangeFrame', liftComposer)
        : null;
    const hide = Keyboard.addListener(hideEvent, () => {
      setAndroidKeyboardPad(0);
    });
    return () => {
      show.remove();
      change?.remove();
      hide.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 72 : 0}
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={scrollToEnd}
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
            <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={styles.bubbleText}>{item.content}</Text>
              </View>
              <Text style={styles.bubbleMeta}>{mine ? 'You' : worker.name}</Text>
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

      <View
        style={[
          styles.composerSafe,
          Platform.OS === 'android' && androidKeyboardPad > 0
            ? { paddingBottom: androidKeyboardPad }
            : { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={onMessageChange}
            placeholder={`Message ${worker.name}`}
            placeholderTextColor={colors.silverMid}
            multiline
            editable={!busy}
            onFocus={scrollToEnd}
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
    flexGrow: 0,
    flexShrink: 0,
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
  row: { maxWidth: '85%', gap: 4 },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    maxWidth: '100%',
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: {
    backgroundColor: colors.inkLift,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.inkMid,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: colors.white, fontSize: 14, lineHeight: 20 },
  bubbleMeta: { color: colors.silverMid, fontSize: 11 },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  typingText: { color: colors.silverMid, fontSize: 12 },
  composerSafe: {
    flexGrow: 0,
    flexShrink: 0,
  },
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
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.white,
    backgroundColor: colors.inkMid,
    fontSize: 15,
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  sendDisabled: { opacity: 0.45 },
  sendText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});

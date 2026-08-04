import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChatMessage } from '@/api/types';
import { ConnectionStatusChip } from '@/components/ConnectionStatusChip';
import { ChatComposer } from '@/components/ChatComposer';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { CommandPalette } from '@/components/CommandPalette';
import { ProviderBadge } from '@/components/ProviderBadge';
import { ProviderPicker } from '@/components/ProviderPicker';
import { ScoutStatusChip } from '@/components/ScoutStatusChip';
import { SuggestedPrompts } from '@/components/SuggestedPrompts';
import { ToolActivityStrip } from '@/components/ToolActivityStrip';
import { filterSlashCommands } from '@/config/commands';
import { useCarinaConfig } from '@/hooks/useCarinaConfig';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';
import { SessionDrawer } from '@/components/SessionDrawer';
import { useChatSession } from '@/hooks/useChatSession';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useScoutStatus } from '@/hooks/useScoutStatus';
import { useSessionActions } from '@/hooks/useSessionActions';
import { useSessionIndex } from '@/hooks/useSessionIndex';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useLocalModel } from '@/hooks/useLocalModel';
import { isLocalModelReady } from '@/lib/local-inference';
import { loadChatMessages } from '@/lib/chat-session';
import { hapticLight } from '@/lib/haptics';
import { deriveSessionMeta } from '@/lib/session-registry';
import { shareSession } from '@/lib/share-session';
import { useAuth } from '@/store/auth-store';
import { colors, spacing } from '@/theme/tokens';

export default function ChatScreen() {
  const { sessionId: linkedSessionId, pendingVoice } = useLocalSearchParams<{
    sessionId?: string;
    pendingVoice?: string;
  }>();
  const { instance, gatewayAuth, client } = useAuth();
  const { providers, loading: providerLoading, reload: reloadProviders, error: providerError } =
    useCarinaConfig();
  const {
    ready,
    messages,
    streaming,
    streamError,
    chatAccess,
    activeTools,
    sendMessage,
    runCommand,
    cancel,
    startNewChat,
    switchSession,
    deleteSession,
    sessionId,
  } = useChatSession();
  const { sessions, loading: sessionsLoading, reload: reloadSessions } = useSessionIndex();
  const { renameSession, togglePin } = useSessionActions(reloadSessions);
  const { status: connectionStatus } = useConnectionStatus(
    instance?.baseUrl,
    gatewayAuth ?? undefined,
  );
  const scoutStatus = useScoutStatus();
  const { isReady: localModelReady } = useLocalModel();

  const offlineLocalReady =
    connectionStatus === 'offline' && (localModelReady || isLocalModelReady());
  const composerPlaceholder = offlineLocalReady
    ? 'Message Carina (on-device)...'
    : 'Message Carina...';

  const [composerText, setComposerText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [switchingProvider, setSwitchingProvider] = useState(false);
  /** Android: lift only the composer by the gap between window bottom and keyboard top. */
  const [androidKeyboardPad, setAndroidKeyboardPad] = useState(0);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const insets = useSafeAreaInsets();

  const providerLabel = providerError
    ? 'Provider issue'
    : providerLoading
      ? 'Loading'
      : providers?.active || 'No keys';

  const commandMatches = filterSlashCommands(composerText);
  const { queue, flushing, flush } = useOfflineQueue(
    useCallback(async (text: string) => sendMessage(text, { fromQueue: true }), [sendMessage]),
  );

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      if (Platform.OS === 'android') {
        const windowHeight = Dimensions.get('window').height;
        const fromScreen = Math.round(windowHeight - event.endCoordinates.screenY);
        const fromHeight = Math.round(event.endCoordinates.height);
        setAndroidKeyboardPad(Math.max(0, fromScreen > 0 ? fromScreen : fromHeight));
      }
      scrollToEnd();
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setAndroidKeyboardPad(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scrollToEnd]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const liftComposer = (event: { endCoordinates?: { height?: number; screenY?: number } }) => {
      if (Platform.OS !== 'android') return;
      // Prefer reported keyboard height. windowHeight - screenY is often a small
      // false positive on RN 0.76 + edge-to-edge, which left the composer covered.
      const height = Math.round(event.endCoordinates?.height ?? 0);
      const screenY = event.endCoordinates?.screenY ?? 0;
      const fromScreen = Math.max(
        0,
        Math.round(Dimensions.get('screen').height - screenY),
      );
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
  }, [scrollToEnd]);

  const handleVoiceTranscript = useCallback((text: string) => {
    setComposerText((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  }, []);
  const {
    available: voiceAvailable,
    blockedReason: voiceBlockedReason,
    listening: voiceListening,
    error: voiceError,
    toggle: toggleVoice,
  } = useVoiceInput(handleVoiceTranscript);

  const handleSend = useCallback(
    async (text: string) => {
      setComposerText('');
      void hapticLight();
      await sendMessage(text);
      scrollToEnd();
    },
    [sendMessage, scrollToEnd],
  );

  const handleSelectCommand = useCallback(
    (command: string) => {
      setComposerText(command);
    },
    [],
  );

  useEffect(() => {
    if (linkedSessionId && typeof linkedSessionId === 'string' && ready) {
      void switchSession(linkedSessionId);
    }
  }, [linkedSessionId, ready, switchSession]);

  useEffect(() => {
    if (!ready || !pendingVoice || typeof pendingVoice !== 'string') return;
    const text = pendingVoice.trim();
    if (!text) return;
    void sendMessage(text);
    scrollToEnd();
  }, [pendingVoice, ready, scrollToEnd, sendMessage]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToEnd();
    }
  }, [messages.length, scrollToEnd]);

  const handleNewChat = useCallback(async () => {
    await startNewChat();
    setDrawerOpen(false);
    await reloadSessions();
  }, [reloadSessions, startNewChat]);

  const handleSelectSession = useCallback(
    async (id: string) => {
      await switchSession(id);
      setDrawerOpen(false);
      scrollToEnd();
    },
    [scrollToEnd, switchSession],
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteSession(id);
      await reloadSessions();
    },
    [deleteSession, reloadSessions],
  );

  const handleShareSession = useCallback(
    async (id: string) => {
      void hapticLight();
      const stored = await loadChatMessages(id);
      const meta = sessions.find((item) => item.id === id) ?? deriveSessionMeta(id, stored);
      await shareSession(meta, stored);
    },
    [sessions],
  );

  const handleProviderSelect = useCallback(
    async (provider: string) => {
      if (!client) return;
      setSwitchingProvider(true);
      try {
        await client.switchProvider(provider);
        await reloadProviders();
        setPickerOpen(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('Provider switch failed', msg);
      } finally {
        setSwitchingProvider(false);
      }
    },
    [client, reloadProviders],
  );

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.tealLight} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable
              style={styles.sessionsBtn}
              onPress={() => {
                void reloadSessions();
                setDrawerOpen(true);
              }}
            >
              <Text style={styles.sessionsText}>Sessions</Text>
            </Pressable>
            <Pressable style={styles.newChatBtn} onPress={() => void handleNewChat()}>
              <Text style={styles.newChatText}>New</Text>
            </Pressable>
          </View>
          <View style={styles.statusRow}>
            <ConnectionStatusChip
              status={connectionStatus}
              localModelReady={offlineLocalReady}
              onPress={() => router.push('/instance')}
            />
            <ScoutStatusChip status={scoutStatus} />
            <ProviderBadge
              label={providerLabel}
              loading={providerLoading}
              onPress={() => setPickerOpen(true)}
            />
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatMessageBubble message={item} />}
          contentContainerStyle={messages.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <SuggestedPrompts
              onSelect={(prompt) => void handleSend(prompt)}
              disabled={streaming}
            />
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={scrollToEnd}
        />

        {streamError ? <Text style={styles.error}>{streamError}</Text> : null}
        {voiceError ? <Text style={styles.error}>{voiceError}</Text> : null}
        {chatAccess?.mode === 'mini' ? (
          <View style={styles.accessBanner}>
            <Text style={styles.accessTitle}>Mini mode active</Text>
            <Text style={styles.accessText}>
              Free messages used: {chatAccess.freeMessagesUsed} / {chatAccess.freeMessagesLimit}.
              Add BYOK or subscribe for full model access.
            </Text>
            <Pressable style={styles.accessButton} onPress={() => router.push('/usage')}>
              <Text style={styles.accessButtonText}>Open usage</Text>
            </Pressable>
          </View>
        ) : null}

        <ToolActivityStrip tools={activeTools} />
        <OfflineQueueBanner
          count={queue.length}
          flushing={flushing}
          onFlush={() => void flush()}
        />
        <CommandPalette commands={commandMatches} onSelect={handleSelectCommand} />
        <View
          style={[
            styles.composerSafe,
            Platform.OS === 'android' && androidKeyboardPad > 0
              ? { paddingBottom: androidKeyboardPad }
              : { paddingBottom: insets.bottom },
          ]}
        >
          <ChatComposer
            text={composerText}
            onChangeText={setComposerText}
            onSend={(text) => void handleSend(text)}
            onStop={cancel}
            streaming={streaming}
            disabled={!ready || streaming}
            placeholder={composerPlaceholder}
            voiceAvailable={voiceAvailable}
            voiceBlockedReason={voiceBlockedReason}
            voiceListening={voiceListening}
            onVoicePress={() => void toggleVoice()}
          />
        </View>
      </KeyboardAvoidingView>

      <ProviderPicker
        visible={pickerOpen}
        providers={providers?.providers ?? []}
        active={providers?.active ?? ''}
        loading={providerLoading}
        switching={switchingProvider}
        onClose={() => setPickerOpen(false)}
        onSelect={(name) => void handleProviderSelect(name)}
      />

      <SessionDrawer
        visible={drawerOpen}
        sessions={sessions}
        activeSessionId={sessionId}
        loading={sessionsLoading}
        onClose={() => setDrawerOpen(false)}
        onSelect={(id) => void handleSelectSession(id)}
        onNewChat={() => void handleNewChat()}
        onDelete={(id) => void handleDeleteSession(id)}
        onRename={(id, title) => void renameSession(id, title)}
        onTogglePin={(id, pinned) => void togglePin(id, pinned)}
        onShare={(id) => void handleShareSession(id)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDim,
    gap: spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sessionsBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingRight: spacing.sm,
  },
  sessionsText: {
    color: colors.tealLight,
    fontSize: 13,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  newChatBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  newChatText: {
    color: colors.tealLight,
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    paddingVertical: spacing.sm,
    flexGrow: 1,
  },
  emptyList: {
    flexGrow: 1,
  },
  bannerWarn: {
    color: colors.amber,
    fontSize: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    lineHeight: 16,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  accessBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.amberDeep,
    borderRadius: 10,
    backgroundColor: colors.inkMid,
    gap: spacing.xs,
  },
  accessTitle: {
    color: colors.amber,
    fontSize: 13,
    fontWeight: '700',
  },
  accessText: {
    color: colors.silver,
    fontSize: 12,
    lineHeight: 17,
  },
  accessButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.teal,
  },
  accessButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  composerSafe: {
    backgroundColor: colors.inkMid,
  },
});

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ChatSessionMeta } from '@/api/types';
import { displaySessionTitle } from '@/lib/session-registry';
import { colors, radii, spacing } from '@/theme/tokens';
import { SessionRenameModal } from './SessionRenameModal';

interface SessionDrawerProps {
  visible: boolean;
  sessions: ChatSessionMeta[];
  activeSessionId: string;
  loading?: boolean;
  onClose: () => void;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onDelete: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onTogglePin: (sessionId: string, pinned: boolean) => void;
  onShare: (sessionId: string) => void;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function SessionDrawer({
  visible,
  sessions,
  activeSessionId,
  loading,
  onClose,
  onSelect,
  onNewChat,
  onDelete,
  onRename,
  onTogglePin,
  onShare,
}: SessionDrawerProps) {
  const [renaming, setRenaming] = useState<ChatSessionMeta | null>(null);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.root}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={styles.panel}>
            <View style={styles.header}>
              <Text style={styles.title}>Sessions</Text>
              <Pressable style={styles.newBtn} onPress={onNewChat}>
                <Text style={styles.newBtnText}>New chat</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color={colors.tealLight} style={styles.loader} />
            ) : sessions.length === 0 ? (
              <Text style={styles.empty}>No saved chats yet. Start a conversation on the Chat tab.</Text>
            ) : (
              <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {sessions.map((session) => {
                  const active = session.id === activeSessionId;
                  const label = displaySessionTitle(session);
                  return (
                    <Pressable
                      key={session.id}
                      style={[styles.row, active && styles.rowActive]}
                      onPress={() => onSelect(session.id)}
                      onLongPress={() => setRenaming(session)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open session ${label}`}
                    >
                      <View style={styles.rowBody}>
                        <View style={styles.titleRow}>
                          {session.pinned ? <Text style={styles.pin}>Pinned</Text> : null}
                          <Text
                            style={[styles.rowTitle, active && styles.rowTitleActive]}
                            numberOfLines={1}
                          >
                            {label}
                          </Text>
                        </View>
                        <Text style={styles.rowPreview} numberOfLines={2}>
                          {session.preview}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {formatRelativeTime(session.updatedAt)} · {session.messageCount} messages
                        </Text>
                      </View>
                      <View style={styles.actions}>
                        <Pressable
                          onPress={() => onTogglePin(session.id, !session.pinned)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={session.pinned ? `Unpin session ${label}` : `Pin session ${label}`}
                        >
                          <Text style={styles.pinAction}>{session.pinned ? 'Unpin' : 'Pin'}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onShare(session.id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Share session ${label}`}
                        >
                          <Text style={styles.shareAction}>Share</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setRenaming(session)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Rename session ${label}`}
                        >
                          <Text style={styles.renameAction}>Rename</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onDelete(session.id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete session ${label}`}
                        >
                          <Text style={styles.deleteText}>Delete</Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <SessionRenameModal
        visible={renaming !== null}
        initialTitle={renaming ? displaySessionTitle(renaming) : ''}
        onClose={() => setRenaming(null)}
        onSave={(title) => {
          if (renaming) {
            onRename(renaming.id, title);
          }
          setRenaming(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  panel: {
    width: '82%',
    maxWidth: 360,
    backgroundColor: colors.ink,
    borderLeftWidth: 1,
    borderLeftColor: colors.borderDim,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '600',
  },
  newBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  newBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  loader: {
    marginTop: spacing.xl,
  },
  empty: {
    color: colors.silver,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.inkMid,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowActive: {
    borderColor: colors.teal,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pin: {
    color: colors.amber,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  rowTitle: {
    color: colors.offWhite,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  rowTitleActive: {
    color: colors.tealLight,
  },
  rowPreview: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  rowMeta: {
    color: colors.silverMid,
    fontSize: 11,
  },
  actions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  pinAction: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: '600',
  },
  shareAction: {
    color: colors.offWhite,
    fontSize: 11,
    fontWeight: '600',
  },
  renameAction: {
    color: colors.tealLight,
    fontSize: 11,
    fontWeight: '600',
  },
  deleteText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '600',
  },
});

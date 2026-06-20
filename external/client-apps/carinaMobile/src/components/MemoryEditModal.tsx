import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { EpisodicMemory } from '@/api/types';
import { colors, radii, spacing } from '@/theme/tokens';

interface MemoryEditModalProps {
  visible: boolean;
  memory: EpisodicMemory | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (id: string, content: string) => void;
}

export function MemoryEditModal({
  visible,
  memory,
  saving,
  onClose,
  onSave,
}: MemoryEditModalProps) {
  const [content, setContent] = useState('');

  useEffect(() => {
    setContent(memory?.content ?? '');
  }, [memory]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Edit memory</Text>
          <Text style={styles.category}>{memory?.category ?? ''}</Text>
          <TextInput
            style={styles.input}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            placeholder="Memory content"
            placeholderTextColor={colors.silverMid}
          />
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={() => memory && onSave(memory.id, content.trim())}
              disabled={saving || !content.trim() || !memory}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.inkMid,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderDim,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  category: {
    color: colors.tealLight,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelText: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 72,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

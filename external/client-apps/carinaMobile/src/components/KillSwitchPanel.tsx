import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { KillSwitchStatus } from '@/api/types';
import { colors, radii, spacing } from '@/theme/tokens';

interface KillSwitchPanelProps {
  status: KillSwitchStatus | null;
  enabled: boolean;
  triggering: boolean;
  onTrigger: (reason: string) => Promise<void>;
}

export function KillSwitchPanel({
  status,
  enabled,
  triggering,
  onTrigger,
}: KillSwitchPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const triggered = status?.triggered ?? false;

  async function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Reason is required');
      return;
    }
    setError(null);
    try {
      await onTrigger(trimmed);
      setConfirmOpen(false);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Kill switch</Text>
      <Text style={styles.subtitle}>
        Stops tools and conversation immediately. Carina Cloud + Scout required.
      </Text>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={[styles.statusValue, triggered && styles.statusTriggered]}>
          {triggered ? 'TRIGGERED' : status?.armed === false ? 'DISARMED' : 'ARMED'}
        </Text>
      </View>

      {status?.reason ? (
        <Text style={styles.reason}>Reason: {status.reason}</Text>
      ) : null}

      {!enabled ? (
        <Text style={styles.hint}>Pair Labyrinth Scout on Carina Cloud to enable.</Text>
      ) : (
        <Pressable
          style={[styles.dangerBtn, (triggered || triggering) && styles.dangerBtnDisabled]}
          onPress={() => setConfirmOpen(true)}
          disabled={triggered || triggering}
        >
          {triggering ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.dangerText}>Trigger kill switch</Text>
          )}
        </Pressable>
      )}

      <Modal visible={confirmOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Confirm kill switch</Text>
            <Text style={styles.modalBody}>
              This suspends your monitored Carina instances. Type a reason for the audit log.
            </Text>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (required)"
              placeholderTextColor={colors.silverMid}
              multiline
              maxLength={500}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setConfirmOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={() => void handleConfirm()}>
                <Text style={styles.confirmText}>Trigger</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(245, 166, 35, 0.06)',
    gap: spacing.sm,
  },
  title: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  subtitle: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    color: colors.silverMid,
    fontSize: 12,
  },
  statusValue: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  statusTriggered: {
    color: colors.danger,
  },
  reason: {
    color: colors.offWhite,
    fontSize: 12,
  },
  hint: {
    color: colors.silverMid,
    fontSize: 12,
  },
  dangerBtn: {
    backgroundColor: colors.danger,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  dangerBtnDisabled: {
    opacity: 0.5,
  },
  dangerText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 22, 30, 0.8)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalSheet: {
    backgroundColor: colors.inkMid,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  modalTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    color: colors.silver,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.white,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cancelText: {
    color: colors.silver,
  },
  confirmBtn: {
    backgroundColor: colors.danger,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  confirmText: {
    color: colors.white,
    fontWeight: '700',
  },
});

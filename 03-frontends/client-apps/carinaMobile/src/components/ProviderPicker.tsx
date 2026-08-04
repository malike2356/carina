import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

interface ProviderPickerProps {
  visible: boolean;
  providers: string[];
  active: string;
  loading?: boolean;
  switching?: boolean;
  onClose: () => void;
  onSelect: (provider: string) => void;
}

export function ProviderPicker({
  visible,
  providers,
  active,
  loading,
  switching,
  onClose,
  onSelect,
}: ProviderPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Switch provider</Text>
          <Text style={styles.subtitle}>Chooses which API key Cloud chat uses</Text>

          {loading ? (
            <ActivityIndicator color={colors.tealLight} style={styles.loader} />
          ) : (
            <ScrollView style={styles.list}>
              {providers.map((name) => {
                const selected = name === active;
                return (
                  <Pressable
                    key={name}
                    style={[styles.option, selected && styles.optionActive]}
                    onPress={() => onSelect(name)}
                    disabled={switching || selected}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextActive]}>
                      {name}
                    </Text>
                    {selected ? <Text style={styles.activeTag}>Active</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {switching ? (
            <Text style={styles.switching}>Switching provider...</Text>
          ) : null}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 22, 30, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.inkMid,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.silver,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  list: {
    maxHeight: 280,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderDim,
  },
  optionActive: {
    borderColor: colors.teal,
    backgroundColor: 'rgba(26, 95, 122, 0.12)',
  },
  optionText: {
    color: colors.offWhite,
    fontSize: 15,
    textTransform: 'capitalize',
  },
  optionTextActive: {
    color: colors.tealLight,
    fontWeight: '600',
  },
  activeTag: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  switching: {
    color: colors.silver,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  closeBtn: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  closeText: {
    color: colors.tealLight,
    fontSize: 14,
    fontWeight: '600',
  },
});

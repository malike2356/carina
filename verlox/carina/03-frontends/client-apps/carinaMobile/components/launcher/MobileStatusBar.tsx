import { StyleSheet, Text, View } from 'react-native';
import { useLauncherStatus } from '../../hooks/useLauncherStatus';

export function MobileStatusBar() {
  const { scoutProtected, version } = useLauncherStatus();

  return (
    <View style={styles.bar}>
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: scoutProtected ? '#16c97e' : '#4a6a8a' }]} />
        <Text style={[styles.label, scoutProtected && styles.protected]}>
          Scout {scoutProtected ? 'Protected' : 'Not paired'}
        </Text>
      </View>
      <Text style={styles.label}>Encrypted</Text>
      <Text style={[styles.label, styles.right]}>{version}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#060c18',
    borderTopWidth: 1,
    borderTopColor: '#1a2b45',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 11, color: '#6b8aaa' },
  protected: { color: '#16c97e' },
  right: { marginLeft: 'auto' },
});

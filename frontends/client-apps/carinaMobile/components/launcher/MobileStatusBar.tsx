import { StyleSheet, Text, View } from 'react-native';

export function MobileStatusBar() {
  return (
    <View style={styles.bar}>
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: '#16c97e' }]} />
        <Text style={styles.label}>Scout Protected</Text>
      </View>
      <Text style={styles.label}>Encrypted</Text>
      <Text style={[styles.label, styles.right]}>Carina</Text>
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
  right: { marginLeft: 'auto' },
});

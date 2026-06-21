import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

export function MobileContinueButton() {
  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(tabs)/chat');
  };

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => void handlePress()}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Continue work"
    >
      <Text style={styles.label}>CONTINUE WORK  &gt;</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#00d4ff',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#060c18',
  },
});

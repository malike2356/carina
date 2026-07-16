import { Image, StyleSheet, Text, View } from 'react-native';

export function MobileLogoBlock() {
  return (
    <View style={styles.wrap}>
      <Image
        source={require('../../assets/logo/carina-wordmark.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Carina logo"
      />
      <Text style={styles.tagline}>ONE MEMORY. ONE AGENT. EVERYWHERE.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, paddingTop: 16 },
  logo: { width: 240, height: 80 },
  tagline: {
    fontSize: 9,
    fontWeight: '600',
    color: '#4a6a8a',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});

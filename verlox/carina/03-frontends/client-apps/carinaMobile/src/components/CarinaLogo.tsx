import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface CarinaLogoProps {
  size?: 'sm' | 'md';
}

export function CarinaLogo({ size = 'md' }: CarinaLogoProps) {
  return (
    <View style={styles.row}>
      <Image
        source={require('../../assets/logo/carina-wordmark.png')}
        style={[styles.wordmark, size === 'sm' && styles.wordmarkSm]}
        resizeMode="contain"
        accessibilityLabel="Carina logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmark: {
    width: 160,
    height: 52,
  },
  wordmarkSm: {
    width: 105,
    height: 34,
  },
});

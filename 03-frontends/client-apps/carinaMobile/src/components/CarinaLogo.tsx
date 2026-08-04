import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface CarinaLogoProps {
  size?: 'sm' | 'md';
}

/** Hub mark from 01-devends/icon-logos/logos. */
export function CarinaLogo({ size = 'md' }: CarinaLogoProps) {
  return (
    <View style={styles.row}>
      <Image
        source={require('../../assets/logo/carina-logo.png')}
        style={[styles.mark, size === 'sm' && styles.markSm]}
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
  mark: {
    width: 48,
    height: 48,
  },
  markSm: {
    width: 32,
    height: 32,
  },
});

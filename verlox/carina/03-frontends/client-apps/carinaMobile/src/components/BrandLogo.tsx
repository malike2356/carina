import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface BrandLogoProps {
  size?: 'sm' | 'md';
  /** Retained for compatibility with older call sites. */
  product?: 'aiva' | 'carina';
}

/**
 * App chrome brand mark. Uses the Carina wordmark without the legacy hub/star.
 */
export function BrandLogo({ size = 'md' }: BrandLogoProps) {
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

/** @deprecated Prefer BrandLogo; kept for existing imports. */
export function CarinaLogo(props: BrandLogoProps) {
  return <BrandLogo {...props} />;
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

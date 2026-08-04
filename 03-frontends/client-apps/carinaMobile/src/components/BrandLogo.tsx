import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface BrandLogoProps {
  size?: 'sm' | 'md';
  /** Retained for compatibility with older call sites. */
  product?: 'aiva' | 'carina';
}

/**
 * App chrome brand mark from 01-devends/icon-logos/logos (hub mark).
 */
export function BrandLogo({ size = 'md' }: BrandLogoProps) {
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

/** @deprecated Prefer BrandLogo; kept for existing imports. */
export function CarinaLogo(props: BrandLogoProps) {
  return <BrandLogo {...props} />;
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

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/theme/tokens';

interface CarinaLogoProps {
  size?: 'sm' | 'md';
}

export function CarinaLogo({ size = 'md' }: CarinaLogoProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.wordmark, size === 'sm' && styles.wordmarkSm]}>
        Carina<Text style={styles.dot}>.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: typography.serif,
    fontSize: 28,
    fontWeight: '500',
    color: colors.white,
  },
  wordmarkSm: {
    fontSize: 22,
  },
  dot: {
    color: colors.amber,
  },
});

import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme/tokens';
import { CarinaLogo } from './CarinaLogo';

interface ScreenShellProps extends ViewProps {
  title: string;
  subtitle?: string;
  scroll?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  children: React.ReactNode;
}

export function ScreenShell({
  title,
  subtitle,
  scroll = true,
  showBack = false,
  onBack,
  children,
  style,
  ...rest
}: ScreenShellProps) {
  const handleBack = onBack ?? (() => router.back());

  const body = (
    <>
      {showBack ? (
        <Pressable
          style={styles.backRow}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={[styles.body, !scroll && styles.bodyFlex]}>{children}</View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <CarinaLogo size="sm" />
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, style]}
          keyboardShouldPersistTaps="handled"
          {...rest}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.content, style]} {...rest}>
          {body}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDim,
  },
  content: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  backRow: {
    marginBottom: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingRight: spacing.md,
  },
  backText: {
    color: colors.tealLight,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontFamily: typography.serif,
    fontSize: 26,
    fontWeight: '500',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.silver,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  body: {
    gap: spacing.md,
  },
  bodyFlex: {
    flex: 1,
  },
});

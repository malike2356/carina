import '@/widgets/register-widget';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppLockOverlay } from '@/components/AppLockOverlay';
import { useAppLock } from '@/hooks/useAppLock';
import { useDeepLinks } from '@/hooks/useDeepLinks';
import { useLocalModelLifecycle } from '@/hooks/useLocalModelLifecycle';
import { useMobileUpdateCheck } from '@/hooks/useMobileUpdateCheck';
import { useNotificationSetup } from '@/hooks/useNotificationSetup';
import { AppLockProvider } from '@/store/app-lock-store';
import { AuthProvider } from '@/store/auth-store';
import { colors, spacing } from '@/theme/tokens';

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Root render failed', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorRoot}>
          <Text style={styles.errorTitle}>Carina failed to start</Text>
          <Text style={styles.errorBody}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootShell() {
  useDeepLinks();
  useNotificationSetup();
  useLocalModelLifecycle();
  useMobileUpdateCheck();
  const { locked, unlock } = useAppLock();

  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ink, flex: 1 },
        }}
      />
      <AppLockOverlay visible={locked} onUnlock={() => void unlock()} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <RootErrorBoundary>
          <AuthProvider>
            <AppLockProvider>
              <StatusBar style="light" />
              <RootShell />
            </AppLockProvider>
          </AuthProvider>
        </RootErrorBoundary>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  errorRoot: {
    flex: 1,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  errorBody: {
    color: colors.silverMid,
    fontSize: 14,
    lineHeight: 20,
  },
});

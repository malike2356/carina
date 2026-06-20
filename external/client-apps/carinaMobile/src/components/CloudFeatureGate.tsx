import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CloudFeatureId } from '@/lib/cloud-features';
import { useCloudFeatureAccess } from '@/hooks/useCloudFeatureAccess';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

interface CloudFeatureGateProps {
  feature: CloudFeatureId;
  children: ReactNode;
}

export function CloudFeatureGate({ feature, children }: CloudFeatureGateProps) {
  const access = useCloudFeatureAccess(feature);
  const { instance } = useAuth();

  if (access.available) {
    return <>{children}</>;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{access.featureLabel} requires Carina Cloud</Text>
      <Text style={styles.reason}>{access.reason}</Text>
      <View style={styles.actions}>
        <Pressable style={styles.btn} onPress={() => router.push('/instance')}>
          <Text style={styles.btnText}>Gateway settings</Text>
        </Pressable>
        {instance?.mode === 'cloud' ? (
          <Pressable style={styles.btnPrimary} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.btnPrimaryText}>Sign in</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  title: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  reason: {
    color: colors.silver,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  btnText: {
    color: colors.tealLight,
    fontWeight: '600',
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  btnPrimaryText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
});

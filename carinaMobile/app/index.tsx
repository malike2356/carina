import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/store/auth-store';
import { colors } from '@/theme/tokens';

export default function Index() {
  const { ready, user, instance } = useAuth();

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.tealLight} />
      </View>
    );
  }

  if (!instance?.baseUrl) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (instance.mode === 'cloud' && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)/chat" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
});

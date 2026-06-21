import { Redirect } from 'expo-router';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { useAuth } from '@/store/auth-store';
import { colors } from '@/theme/tokens';
import { MobileLauncher } from '../components/launcher/MobileLauncher';

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

  return (
    <SafeAreaView style={styles.root}>
      <MobileLauncher />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  root: {
    flex: 1,
    backgroundColor: '#060c18',
  },
});

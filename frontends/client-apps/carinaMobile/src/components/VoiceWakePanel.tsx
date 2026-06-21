import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import { useVoiceCapture } from '@/hooks/useVoiceCapture';
import { useVoiceWake } from '@/hooks/useVoiceWake';
import { loadVoiceWakeSettings } from '@/lib/voice-wake-settings';
import { colors, radii, spacing } from '@/theme/tokens';

export function VoiceWakePanel() {
  const [captureMode, setCaptureMode] = useState(false);
  const [settings, setSettings] = useState({ enabled: true, privacyStart: 22, privacyEnd: 7, wakeCount: 0 });
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void loadVoiceWakeSettings().then(setSettings);
  }, []);

  const { transcript, isRecording, error: captureError, startCapture, stopCapture } = useVoiceCapture();

  const onWake = useCallback(() => {
    setCaptureMode(true);
    void startCapture();
  }, [startCapture]);

  const { isListening, error: wakeError, wakeCount, engine } = useVoiceWake({
    enabled: settings.enabled,
    privacyHoursStart: settings.privacyStart,
    privacyHoursEnd: settings.privacyEnd,
    initialWakeCount: settings.wakeCount,
    onWake,
  });

  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
    return undefined;
  }, [isRecording, pulseAnim]);

  const handleSend = useCallback(async () => {
    if (!transcript.trim()) return;
    await stopCapture();
    setCaptureMode(false);
    router.push({
      pathname: '/(tabs)/chat',
      params: { pendingVoice: transcript.trim() },
    });
  }, [stopCapture, transcript]);

  const handleCancel = useCallback(async () => {
    await stopCapture();
    setCaptureMode(false);
  }, [stopCapture]);

  if (captureMode) {
    return (
      <ScreenShell title="Listening" subtitle="Speak your request, then send to Carina.">
        <View style={styles.center}>
          <Animated.View style={[styles.orb, styles.orbActive, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.transcript}>{transcript || 'Listening...'}</Text>
          {captureError ? <Text style={styles.error}>{captureError}</Text> : null}
          <Pressable style={styles.primaryBtn} onPress={() => void handleSend()}>
            <Text style={styles.primaryBtnText}>Send to Carina</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => void handleCancel()}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Voice wake"
      subtitle='Say "Hey Carina" for hands-free queries. Audio stays on-device.'
    >
      <View style={styles.center}>
        <View style={[styles.orb, isListening && styles.orbListening]} />
        <Text style={styles.label}>
          {settings.enabled
            ? (isListening ? 'Listening for "Hey Carina"' : 'Starting wake listener...')
            : 'Wake word disabled in settings'}
        </Text>
        <Text style={styles.meta}>
          Engine: {engine === 'porcupine' ? 'on-device keyword' : engine === 'speech' ? 'speech phrase' : 'inactive'}
        </Text>
        <Text style={styles.meta}>Wake count: {wakeCount}</Text>
        {wakeError ? <Text style={styles.error}>{wakeError}</Text> : null}
        {!process.env.EXPO_PUBLIC_PICOVOICE_KEY ? (
          <Text style={styles.hint}>
            Tip: set EXPO_PUBLIC_PICOVOICE_KEY for dedicated on-device wake word in production builds.
          </Text>
        ) : null}
        <Pressable style={styles.secondaryBtn} onPress={() => router.push('/voice-settings')}>
          <Text style={styles.secondaryBtnText}>Voice settings</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => {
            setCaptureMode(true);
            void startCapture();
          }}
        >
          <Text style={styles.secondaryBtnText}>Tap to speak (fallback)</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  orb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.inkLift,
    borderWidth: 2,
    borderColor: colors.borderDim,
  },
  orbListening: {
    backgroundColor: colors.teal,
    borderColor: colors.tealLight,
  },
  orbActive: {
    backgroundColor: colors.tealMid,
    borderColor: colors.tealLight,
  },
  label: {
    color: colors.offWhite,
    fontSize: 16,
    textAlign: 'center',
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
  },
  hint: {
    color: colors.silverMid,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  transcript: {
    color: colors.white,
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.teal,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  secondaryBtnText: {
    color: colors.tealLight,
    fontSize: 14,
  },
});

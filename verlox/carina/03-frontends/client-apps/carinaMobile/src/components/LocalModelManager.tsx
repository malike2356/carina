import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type { LocalModelId } from '@/config/local-model';
import { useLocalModel } from '@/hooks/useLocalModel';
import { colors, radii, spacing } from '@/theme/tokens';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export function LocalModelManager() {
  const {
    loading,
    downloadProgress,
    isReady,
    nativeOk,
    nativeReason,
    enabled,
    autoDownload,
    wifiOnly,
    modelName,
    catalog,
    startDownload,
    deleteModel,
    selectModel,
    cancelDownload,
    toggleEnabled,
    toggleAutoDownload,
    toggleWifiOnly,
  } = useLocalModel();

  const downloadingId = downloadProgress.modelId;
  const isBusy =
    downloadProgress.state === 'downloading' || downloadProgress.state === 'verifying';
  const pct =
    downloadProgress.totalBytes > 0
      ? Math.min(
          100,
          Math.round((downloadProgress.bytesDownloaded / downloadProgress.totalBytes) * 100),
        )
      : 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.tealLight} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {!nativeOk ? (
        <View style={styles.warnCard}>
          <Text style={styles.warnTitle}>Runtime not in this install</Text>
          <Text style={styles.warnBody}>
            {nativeReason ??
              'Mini model inference is not linked in this APK. Rebuild with New Architecture and llama.rn enabled.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Mini models</Text>
        <Text style={styles.subtitle}>
          Download Llama 1B, Qwen 1.5B, and/or Gemma 2B, then pick which one is active for offline chat.
        </Text>

        {catalog.map(({ entry, downloaded, active }) => {
          const rowDownloading = isBusy && downloadingId === entry.id;
          const status = rowDownloading
            ? downloadProgress.state === 'verifying'
              ? 'Verifying...'
              : `Downloading ${pct}% (${formatBytes(downloadProgress.bytesDownloaded)} / ${formatBytes(downloadProgress.totalBytes)})`
            : active && isReady
              ? 'Active and ready'
              : active && downloaded && !nativeOk
                ? 'Installed; runtime missing in this APK'
                : active && downloaded
                  ? 'Selected; not loaded'
                  : downloaded
                    ? 'Installed'
                    : 'Not installed';

          return (
            <View
              key={entry.id}
              style={[styles.modelRow, active && styles.modelRowActive]}
            >
              <Pressable
                style={styles.modelSelect}
                onPress={() => void selectModel(entry.id)}
                disabled={rowDownloading}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Select ${entry.displayName}`}
              >
                <View style={[styles.radio, active && styles.radioOn]} />
                <View style={styles.modelText}>
                  <Text style={styles.title}>{entry.displayName}</Text>
                  <Text style={styles.meta}>
                    {entry.downloadLabel} · {entry.blurb}
                  </Text>
                  <Text style={styles.meta}>{status}</Text>
                </View>
              </Pressable>

              {rowDownloading ? (
                <View style={styles.progressBlock}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                  <Pressable style={styles.secondaryBtn} onPress={() => void cancelDownload()}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actions}>
                  {!downloaded ? (
                    <Pressable
                      style={[styles.primaryBtn, isBusy && styles.disabled]}
                      disabled={isBusy}
                      onPress={() => void startDownload(entry.id as LocalModelId)}
                    >
                      <Text style={styles.primaryBtnText}>Download</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.secondaryBtn}
                      onPress={() => void deleteModel(entry.id as LocalModelId)}
                    >
                      <Text style={styles.secondaryBtnText}>Delete</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {downloadProgress.state === 'error' && downloadingId === entry.id ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>
                    {downloadProgress.error ?? 'Download failed'}
                  </Text>
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => void startDownload(entry.id as LocalModelId)}
                  >
                    <Text style={styles.primaryBtnText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        {modelName ? <Text style={styles.meta}>Loaded: {modelName}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Settings</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.value}>Enable local AI</Text>
            <Text style={styles.meta}>Use on-device model when offline.</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={(value) => void toggleEnabled(value)}
            trackColor={{ false: colors.inkLift, true: colors.teal }}
            thumbColor={colors.white}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.value}>Auto-download</Text>
            <Text style={styles.meta}>
              Download the selected catalog model on first visit if none are installed.
            </Text>
          </View>
          <Switch
            value={autoDownload}
            onValueChange={(value) => void toggleAutoDownload(value)}
            trackColor={{ false: colors.inkLift, true: colors.teal }}
            thumbColor={colors.white}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.value}>Wi-Fi only</Text>
            <Text style={styles.meta}>Avoid cellular data for large downloads.</Text>
          </View>
          <Switch
            value={wifiOnly}
            onValueChange={(value) => void toggleWifiOnly(value)}
            trackColor={{ false: colors.inkLift, true: colors.teal }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>About</Text>
        <Text style={styles.about}>
          Local AI runs a small language model on your device. No internet is required. Responses stay
          private. Quality is lower than Carina Cloud or a self-hosted gateway.
        </Text>
        <Text style={styles.about}>
          Local AI cannot run tools, code, cron jobs, or subagents. For full capabilities, connect
          online.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  warnCard: {
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  warnTitle: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: '700',
  },
  warnBody: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.inkLift,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderDim,
    padding: spacing.md,
    gap: spacing.md,
  },
  modelRow: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.inkMid,
  },
  modelRowActive: {
    borderColor: colors.teal,
  },
  modelSelect: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.silverMid,
    marginTop: 2,
  },
  radioOn: {
    borderColor: colors.tealLight,
    backgroundColor: colors.teal,
  },
  modelText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionLabel: {
    color: colors.silverMid,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  value: {
    color: colors.offWhite,
    fontSize: 14,
  },
  meta: {
    color: colors.silverMid,
    fontSize: 12,
    lineHeight: 16,
  },
  about: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    alignItems: 'flex-start',
  },
  primaryBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryBtn: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  secondaryBtnText: {
    color: colors.tealLight,
    fontSize: 14,
  },
  progressBlock: {
    gap: spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.inkLift,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.tealLight,
  },
  errorBox: {
    gap: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  disabled: {
    opacity: 0.5,
  },
  center: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});

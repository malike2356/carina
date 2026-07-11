const { withInfoPlist, withAndroidManifest } = require('@expo/config-plugins');

function withVoiceWake(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.NSMicrophoneUsageDescription =
      'Carina listens for the wake phrase "Hey Carina" to enable hands-free assistance.';
    cfg.modResults.NSSpeechRecognitionUsageDescription =
      'Carina converts your voice to text for hands-free queries.';
    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const permissions = manifest['uses-permission'] ?? [];
    const needed = ['android.permission.RECORD_AUDIO', 'android.permission.INTERNET'];
    for (const perm of needed) {
      if (!permissions.find((p) => p.$['android:name'] === perm)) {
        permissions.push({ $: { 'android:name': perm } });
      }
    }
    manifest['uses-permission'] = permissions;
    return cfg;
  });

  return config;
}

module.exports = withVoiceWake;

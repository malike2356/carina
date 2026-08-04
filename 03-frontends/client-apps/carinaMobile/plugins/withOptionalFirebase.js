/**
 * Remove FirebaseInitProvider when google-services.json is not configured.
 * expo-notifications pulls in firebase-messaging, which otherwise crashes
 * the process at startup before React Native mounts.
 */
const { withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function hasGoogleServices(config) {
  const configured = config.android?.googleServicesFile;
  if (!configured || typeof configured !== 'string') return false;
  const resolved = path.isAbsolute(configured)
    ? configured
    : path.resolve(config._internal?.projectRoot || process.cwd(), configured);
  return fs.existsSync(resolved);
}

function withOptionalFirebase(config) {
  if (hasGoogleServices(config)) {
    return config;
  }

  // Avoid pointing the Google Services plugin at a missing file.
  if (config.android) {
    delete config.android.googleServicesFile;
  }

  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) return cfg;

    const providers = application.provider;
    if (!Array.isArray(providers)) return cfg;

    application.provider = providers.filter((provider) => {
      const name = provider?.$?.['android:name'] || '';
      return !name.includes('FirebaseInitProvider');
    });

    return cfg;
  });
}

module.exports = withOptionalFirebase;

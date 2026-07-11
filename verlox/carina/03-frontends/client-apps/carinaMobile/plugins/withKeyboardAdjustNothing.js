const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Force adjustNothing so JS can pad the chat composer by keyboard height.
 * adjustResize is unreliable with Expo Router tabs on RN 0.76+.
 */
function withKeyboardAdjustNothing(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const app = manifest.manifest.application?.[0];
    const activities = app?.activity ?? [];
    for (const activity of activities) {
      const name = activity.$?.['android:name'] ?? '';
      // Main app activity and Expo / ReactActivity hosts used by EAS builds.
      if (
        name === '.MainActivity'
        || name.endsWith('.MainActivity')
        || name.endsWith('.ReactActivity')
        || name.includes('expo.modules')
      ) {
        activity.$['android:windowSoftInputMode'] = 'adjustNothing';
      }
    }
    return mod;
  });
}

module.exports = withKeyboardAdjustNothing;

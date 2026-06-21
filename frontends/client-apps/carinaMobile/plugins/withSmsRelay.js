const { withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

function addSmsRelayReceiver(androidManifest) {
  const application = androidManifest.manifest.application?.[0];
  if (!application) return androidManifest;

  const permissions = [
    'android.permission.RECEIVE_SMS',
    'android.permission.READ_SMS',
    'android.permission.READ_CALL_LOG',
  ];
  if (!androidManifest.manifest['uses-permission']) {
    androidManifest.manifest['uses-permission'] = [];
  }
  const existing = new Set(
    androidManifest.manifest['uses-permission'].map((entry) => entry.$['android:name']),
  );
  for (const permission of permissions) {
    if (!existing.has(permission)) {
      androidManifest.manifest['uses-permission'].push({ $: { 'android:name': permission } });
    }
  }

  if (!application.receiver) application.receiver = [];
  const hasSmsReceiver = application.receiver.some(
    (entry) => entry.$?.['android:name'] === '.SmsReceiver',
  );
  if (!hasSmsReceiver) {
    application.receiver.push({
      $: {
        'android:name': '.SmsReceiver',
        'android:permission': 'android.permission.BROADCAST_SMS',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          $: { 'android:priority': '999' },
          action: [{ $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } }],
        },
      ],
    });
  }

  return androidManifest;
}

module.exports = createRunOncePlugin((config) => {
  return withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = addSmsRelayReceiver(modConfig.modResults);
    return modConfig;
  });
}, 'withSmsRelay');

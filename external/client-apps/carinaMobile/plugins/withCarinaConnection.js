const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withMainApplication,
  withInfoPlist,
  withXcodeProject,
  createRunOncePlugin,
} = require('@expo/config-plugins');

const PLUGIN_ROOT = path.join(__dirname, 'carina-connection');
const ANDROID_PACKAGE = 'uk.carinaai.mobile';

function copyIfMissing(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
  }
}

function ensureAndroidNativeFiles(projectRoot) {
  const targetDir = path.join(
    projectRoot,
    'android',
    'app',
    'src',
    'main',
    'java',
    'uk',
    'carinaai',
    'mobile',
  );
  const files = fs.readdirSync(path.join(PLUGIN_ROOT, 'android'));
  for (const file of files) {
    copyIfMissing(path.join(PLUGIN_ROOT, 'android', file), path.join(targetDir, file));
  }
}

const VISION_IOS_FILES = [
  'CarinaBackgroundConnection.swift',
  'CarinaBackgroundConnection.m',
  'CarinaVisionModule.swift',
  'CarinaVisionModule.m',
  'CarinaMotionModule.swift',
  'CarinaMotionModule.m',
  'NotificationRelayManager.swift',
  'NotificationRelayModule.swift',
  'NotificationRelayModule.m',
];

function ensureIosNativeFiles(projectRoot) {
  const targetDir = path.join(projectRoot, 'ios', 'Carina');
  for (const file of VISION_IOS_FILES) {
    copyIfMissing(path.join(PLUGIN_ROOT, 'ios', file), path.join(targetDir, file));
  }
}

function addAndroidPermissions(androidManifest) {
  const permissions = [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.CAMERA',
    'android.permission.ACTIVITY_RECOGNITION',
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
  return androidManifest;
}

function addAndroidService(androidManifest) {
  const application = androidManifest.manifest.application?.[0];
  if (!application) return androidManifest;
  if (!application.service) application.service = [];

  const hasService = application.service.some(
    (entry) => entry.$?.['android:name'] === '.CarinaConnectionService',
  );
  if (!hasService) {
    application.service.push({
      $: {
        'android:name': '.CarinaConnectionService',
        'android:foregroundServiceType': 'connectedDevice',
        'android:exported': 'false',
      },
    });
  }

  if (!application.receiver) application.receiver = [];
  const hasReceiver = application.receiver.some(
    (entry) => entry.$?.['android:name'] === '.BootReceiver',
  );
  if (!hasReceiver) {
    application.receiver.push({
      $: {
        'android:name': '.BootReceiver',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }],
        },
      ],
    });
  }

  const hasActivityReceiver = application.receiver.some(
    (entry) => entry.$?.['android:name'] === '.CarinaActivityReceiver',
  );
  if (!hasActivityReceiver) {
    application.receiver.push({
      $: {
        'android:name': '.CarinaActivityReceiver',
        'android:exported': 'false',
      },
    });
  }

  return androidManifest;
}

function withCarinaConnectionAndroid(config) {
  config = withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = addAndroidPermissions(modConfig.modResults);
    modConfig.modResults = addAndroidService(modConfig.modResults);
    return modConfig;
  });

  config = withAppBuildGradle(config, (modConfig) => {
    if (!modConfig.modResults.contents.includes('okhttp:4.12.0')) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        /}\s*$/,
        '\n    implementation("com.squareup.okhttp3:okhttp:4.12.0")\n}\n',
      );
    }
    if (!modConfig.modResults.contents.includes('play-services-location:21.2.0')) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        /}\s*$/,
        '\n    implementation("com.google.android.gms:play-services-location:21.2.0")\n}\n',
      );
    }
    if (!modConfig.modResults.contents.includes('work-runtime-ktx:2.9.0')) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        /}\s*$/,
        '\n    implementation("androidx.work:work-runtime-ktx:2.9.0")\n}\n',
      );
    }
    return modConfig;
  });

  config = withMainApplication(config, (modConfig) => {
    ensureAndroidNativeFiles(modConfig.modRequest.projectRoot);
    let contents = modConfig.modResults.contents;
    if (!contents.includes('CarinaConnectionPackage')) {
      contents = contents.replace(
        'import expo.modules.ReactNativeHostWrapper',
        'import expo.modules.ReactNativeHostWrapper\nimport uk.carinaai.mobile.CarinaConnectionPackage',
      );
      contents = contents.replace(
        'val packages = PackageList(this).packages',
        'val packages = PackageList(this).packages.toMutableList()\n            packages.add(CarinaConnectionPackage())',
      );
      if (contents.includes('return packages')) {
        contents = contents.replace(
          /val packages = PackageList\(this\)\.packages(?:\.toMutableList\(\))?/,
          'val packages = PackageList(this).packages.toMutableList()',
        );
      }
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });

  return config;
}

function withCarinaConnectionIos(config) {
  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults.BGTaskSchedulerPermittedIdentifiers = ['com.carina.connection.refresh'];
    modConfig.modResults.NSCameraUsageDescription =
      'Carina uses the camera to provide visual context to the AI agent.';
    modConfig.modResults.NSMotionUsageDescription =
      'Carina uses motion data to understand your current activity context.';
    const modes = modConfig.modResults.UIBackgroundModes ?? [];
    if (!modes.includes('fetch')) {
      modConfig.modResults.UIBackgroundModes = [...modes, 'fetch'];
    }
    return modConfig;
  });

  config = withXcodeProject(config, (modConfig) => {
    ensureIosNativeFiles(modConfig.modRequest.projectRoot);
    const project = modConfig.modResults;
    const group = project.findPBXGroupKey({ name: 'Carina' });
    const target = project.getFirstTarget().uuid;

    for (const file of VISION_IOS_FILES) {
      if (!project.hasFile(`Carina/${file}`)) {
        project.addSourceFile(`Carina/${file}`, { target }, group);
      }
    }

    return modConfig;
  });

  return config;
}

module.exports = createRunOncePlugin((config) => {
  config = withCarinaConnectionAndroid(config);
  config = withCarinaConnectionIos(config);
  return config;
}, 'withCarinaConnection');

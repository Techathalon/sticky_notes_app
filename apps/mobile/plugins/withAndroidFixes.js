/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Custom Expo Config Plugin — withAndroidFixes
 *
 * Expo CNG regenerates the android/ folder on every fresh `expo run:android`.
 * This plugin re-applies three manual additions that would otherwise be lost:
 *
 *  1. AlarmMessagingService  → AndroidManifest.xml  (custom FCM handler for alarm notifications)
 *  2. OverlayPermissionPackage → MainApplication.kt (native module for "display over other apps")
 *  3. firebase-messaging SDK → android/app/build.gradle (needed to compile AlarmMessagingService)
 */

const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withMainApplication,
  withProjectBuildGradle,
  withDangerousMod,
} = require('expo/config-plugins');

// ─── 1. AndroidManifest — register AlarmMessagingService ─────────────────────

function addAlarmMessagingService(androidManifest) {
  const app = androidManifest.manifest.application[0];
  if (!app.service) app.service = [];

  const already = app.service.some(
    (s) => s.$['android:name'] === '.AlarmMessagingService'
  );
  if (!already) {
    app.service.push({
      $: {
        'android:name': '.AlarmMessagingService',
        'android:exported': 'false',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } },
          ],
        },
      ],
    });
  }
  return androidManifest;
}

function fixFirebaseMessagingMetaData(androidManifest) {
  const app = androidManifest.manifest.application[0];
  if (app['meta-data']) {
    for (const meta of app['meta-data']) {
      const name = meta.$?.['android:name'];
      if (name === 'com.google.firebase.messaging.default_notification_channel_id') {
        meta.$['tools:replace'] = 'android:value';
      } else if (name === 'com.google.firebase.messaging.default_notification_color') {
        meta.$['tools:replace'] = 'android:resource';
      } else if (name === 'com.google.firebase.messaging.default_notification_icon') {
        meta.$['tools:replace'] = 'android:resource';
      }
    }
  }
  return androidManifest;
}

// ─── 2. build.gradle — add firebase-messaging dependency ─────────────────────

const FIREBASE_MESSAGING_DEP =
  '    implementation("com.google.firebase:firebase-messaging:24.0.1")';

function addFirebaseMessagingDep(buildGradle) {
  if (buildGradle.includes('firebase-messaging')) return buildGradle; // already present
  return buildGradle.replace(
    /^(dependencies\s*\{)/m,
    `$1\n${FIREBASE_MESSAGING_DEP}`
  );
}

// ─── 3. MainApplication.kt — register OverlayPermissionPackage ───────────────

function addOverlayPermissionPackage(mainApplication) {
  if (mainApplication.includes('OverlayPermissionPackage')) return mainApplication; // already present
  return mainApplication.replace(
    'PackageList(this).packages.apply {',
    'PackageList(this).packages.apply {\n              add(OverlayPermissionPackage())'
  );
}

// ─── 4. Project build.gradle — add Notifee maven repository ──────────────────

const NOTIFEE_MAVEN_REPO = `    maven {
      url new File(["node", "--print", "require.resolve('@notifee/react-native/package.json')"].execute(null, rootDir).text.trim()).parentFile.absolutePath + "/android/libs"
    }`;

function addNotifeeMavenRepo(buildGradle) {
  if (buildGradle.includes('@notifee/react-native/package.json')) return buildGradle;
  return buildGradle.replace(
    /(allprojects\s*\{\s*repositories\s*\{)/m,
    `$1\n${NOTIFEE_MAVEN_REPO}`
  );
}
// ─── 5. Native Kotlin files — copy required services and modules ─────────────

function copyNativeKotlinFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const targetDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/java/com/stickynotes/app'
      );
      const sourceDir = path.join(__dirname, 'native-files');
      if (fs.existsSync(sourceDir)) {
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        for (const file of fs.readdirSync(sourceDir)) {
          if (file.endsWith('.kt') || file.endsWith('.java')) {
            fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
          }
        }
      }
      return cfg;
    },
  ]);
}

// ─── Compose ─────────────────────────────────────────────────────────────────

module.exports = function withAndroidFixes(config) {
  // 1. AndroidManifest
  config = withAndroidManifest(config, (c) => {
    c.modResults = addAlarmMessagingService(c.modResults);
    c.modResults = fixFirebaseMessagingMetaData(c.modResults);
    return c;
  });

  // 2. app/build.gradle
  config = withAppBuildGradle(config, (c) => {
    c.modResults.contents = addFirebaseMessagingDep(c.modResults.contents);
    return c;
  });

  // 3. MainApplication.kt
  config = withMainApplication(config, (c) => {
    c.modResults.contents = addOverlayPermissionPackage(c.modResults.contents);
    return c;
  });

  // 4. Project build.gradle
  config = withProjectBuildGradle(config, (c) => {
    c.modResults.contents = addNotifeeMavenRepo(c.modResults.contents);
    return c;
  });

  // 5. Copy native Kotlin files
  config = copyNativeKotlinFiles(config);

  return config;
};

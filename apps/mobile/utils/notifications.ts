import { Platform } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-var-requires
let N: typeof import('expo-notifications') | null = null;
try { N = require('expo-notifications'); } catch { /* not available in this environment */ }

// Show alerts + play sound for foreground notifications
N?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android 8+ requires a notification channel with high importance for alarm-style notifications
async function ensureChannel() {
  if (Platform.OS === 'android' && N) {
    try {
      // Delete first — Android locks channel settings after first creation,
      // so old sound/importance won't update without recreating.
      await N.deleteNotificationChannelAsync('default').catch(() => {});
      await N.setNotificationChannelAsync('default', {
        name: 'Task Reminders',
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0EA5E9',
        enableVibrate: true,
      });
    } catch {
      // silently ignore
    }
  }
}
ensureChannel();

export async function requestNotificationPermission(): Promise<boolean> {
  if (!N) return false;
  try {
    const { status: existing } = await N.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await N.requestPermissionsAsync({
      ios: {
        allowAlert: true,   // show notification banners (reminders, expense alerts)
        allowBadge: true,   // allow app icon badge count
        allowSound: true,   // play sounds for reminders and expense alerts
        allowProvisional: false,
      },
    });
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function requestAlarmPermission(): Promise<boolean> {
  if (!N) return false;
  // USE_EXACT_ALARM permission is Android-only — no iOS equivalent needed.
  if (Platform.OS !== 'android') return true;
  try {
    const { granted } = await N.requestPermissionsAsync({
      android: { alarm: true },
    });
    return granted;
  } catch {
    return false;
  }
}

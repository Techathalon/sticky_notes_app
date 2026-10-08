import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { requestNotificationPermission } from './notifications';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidLaunchActivityFlag,
  AndroidVisibility,
  EventType,
  TriggerType,
} from '@notifee/react-native';

// v2 — no sound on channel so Android does not play notification sound separately.
// All alarm sound comes from expo-audio in alarm-screen.tsx, which we fully control.
// Cannot modify existing channel after creation, so new ID forces Android to create fresh.
const ALARM_CHANNEL_ID = 'alarm_fullscreen_v2';

async function ensureAlarmChannel(): Promise<void> {
  await notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'Alarms',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    vibration: true,
    vibrationPattern: [300, 500],
    bypassDnd: true,
  });
}

/**
 * Schedule a local alarm that fires even when the app is killed or screen is off.
 * Uses Android AlarmManager.setExactAndAllowWhileIdle via notifee.
 * Android only — iOS relies on backend FCM.
 *
 * @param id       Unique string ID (use task/event DB id)
 * @param title    Task or event title shown on alarm
 * @param alarmAt  Exact Date when alarm should fire
 * @param type     'task' | 'event'
 */
/**
 * Check exact alarm permission (Android 12+) and battery optimization,
 * prompting the user to fix either if needed.
 * Call once when the user first enables an alarm.
 */
/**
 * Check battery optimization and prompt the user to disable it if active.
 * Exact alarm permission is handled separately by requestAlarmPermission() in notifications.ts.
 */
export async function checkAlarmSystemPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    // 1. Standard Android battery optimization — one-tap system dialog (no settings page needed).
    //    requestIgnoreBatteryOptimizations() resolves false if already granted (skip the wait).
    const dialogShown: boolean =
      await NativeModules.OverlayPermission.requestIgnoreBatteryOptimizations();
    if (dialogShown) {
      // Give the user a moment to respond to the system dialog before the next check.
      await new Promise<void>((r) => setTimeout(r, 1500));
    }

    // 2. OEM battery manager (Samsung, Xiaomi, Huawei, etc.) — cannot be auto-granted.
    //    Only show if battery optimization is STILL active — if the user already whitelisted
    //    the app (via the dialog above or manually), isBatteryOptimizationEnabled() returns
    //    false and we skip this modal so it never shows again.
    const stillOptimized = await notifee.isBatteryOptimizationEnabled();
    if (stillOptimized) {
      const powerInfo = await notifee.getPowerManagerInfo();
      if (powerInfo.activity) {
        const showModal = _showBatteryOptModal;
        if (showModal) {
          await new Promise<void>((resolve) => {
            showModal(resolve);
          });
        }
      }
    }
  } catch {
    // Non-critical — ignore if APIs unavailable
  }
}

export async function scheduleLocalAlarm(
  id: string,
  title: string,
  alarmAt: Date,
  type: 'task' | 'event' = 'task',
): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      const dismissedId = await AsyncStorage.getItem('lastDismissedAlarmId').catch(() => null);
      if (dismissedId === id) {
        await AsyncStorage.removeItem('lastDismissedAlarmId').catch(() => {});
      }
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: type === 'event' ? '📅 Event Alarm' : '⏰ Task Alarm',
          body: title,
          sound: 'alarm.wav',
          data: {
            alarmTitle: title,
            alarmType: type,
            alarmId: id,
            alarmAt: alarmAt.getTime().toString(),
            type: 'alarm',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: alarmAt,
        },
      });
      // console.log(`[AlarmManager] Scheduled local alarm on iOS: "${title}" at ${alarmAt.toLocaleTimeString()}`);
    } catch (err) {
      console.error('[AlarmManager] iOS scheduleLocalAlarm failed:', err);
    }
    return;
  }

  if (Platform.OS !== 'android') return;
  try {
    await ensureAlarmChannel();
    // Clear the dismissed-alarm guard ONLY for this specific alarm id, so rescheduling
    // one alarm does not accidentally re-arm stale pendingAlarmPress entries for OTHER alarms.
    const dismissedId = await AsyncStorage.getItem('lastDismissedAlarmId').catch(() => null);
    if (dismissedId === id) {
      await AsyncStorage.removeItem('lastDismissedAlarmId').catch(() => {});
    }
    await notifee.createTriggerNotification(
      {
        id,
        title: type === 'event' ? '📅 Event Alarm' : '⏰ Task Alarm',
        body: title,
        android: {
          channelId: ALARM_CHANNEL_ID,
          category: AndroidCategory.ALARM,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          vibrationPattern: [300, 500],
          largeIcon: 'ic_launcher',
          // Opens alarm screen automatically without user tap — wakes device from sleep/lock
          fullScreenAction: {
            id: 'default',
            launchActivity: 'default',
            launchActivityFlags: [AndroidLaunchActivityFlag.NO_USER_ACTION],
          },
          pressAction: { id: 'default', launchActivity: 'default' },
        },
        data: {
          alarmTitle: title,
          alarmType: type,
          alarmId: id,
          alarmAt: alarmAt.getTime().toString(),
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: alarmAt.getTime(),
        alarmManager: {
          allowWhileIdle: true, // fires even in Doze mode
        },
      },
    );
  } catch (err) {
    console.error('[AlarmManager] scheduleLocalAlarm failed:', err);
  }
}

/**
 * Cancel a previously scheduled local alarm.
 * Call when task/event alarm is toggled off, edited, or deleted.
 */
export async function cancelLocalAlarm(id: string): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Alarm may not exist — ignore
    }
    return;
  }

  if (Platform.OS !== 'android') return;

  try {
    await notifee.cancelTriggerNotification(id);
    // console.log('❌ Cancelling alarm from the alarm manager:', id);
    await notifee.getTriggerNotifications();
    // console.log('Remaining alarms from the alarm manager:', alarms.length);
  } catch {
    // Alarm may not exist — ignore
  }
}

/**
 * Cancel ALL pending local alarms.
 * Call when the user disables alarms globally in settings.
 */
export async function cancelAllLocalAlarms(): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (err) {
      console.error('[AlarmManager] cancelAllLocalAlarms failed on iOS:', err);
    }
    return;
  }

  if (Platform.OS !== 'android') return;
  try {
    await notifee.cancelAllNotifications();
    // console.log('❌ All local alarms cancelled');
  } catch (err) {
    console.error('[AlarmManager] cancelAllLocalAlarms failed:', err);
  }
}

/**
 * Register notifee foreground event handler.
 * Call once at app startup (_layout.tsx).
 * Returns unsubscribe function.
 */
export function registerNotifeeHandler(
  onAlarm: (title: string, type: string, alarmId: string, alarmAt: string) => void,
): () => void {
  if (Platform.OS !== 'android') return () => {};
  // console.log('FRONETND ALARM PAGE REGISTERED');
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.DELIVERED || type === EventType.PRESS) {
      const data = detail.notification?.data as
        | { alarmTitle?: string; alarmType?: string; alarmId?: string; alarmAt?: string }
        | undefined;
      if (data?.alarmTitle) {
        onAlarm(data.alarmTitle, data.alarmType ?? 'task', data.alarmId ?? '', data.alarmAt ?? '');
      }
    }
  });
}

// Module-level callbacks — registered by _layout.tsx so styled in-app modals can be shown
// from anywhere without needing React hooks in this utility file.
// Each accepts an onDismissed callback so the permission check can await user action.
let _showOverlayModal: ((onDismissed: () => void) => void) | null = null;
let _showFullScreenIntentModal: ((onDismissed: () => void) => void) | null = null;
let _showBatteryOptModal: ((onDismissed: () => void) => void) | null = null;

export function registerOverlayModalTrigger(fn: (onDismissed: () => void) => void) {
  _showOverlayModal = fn;
}
export function registerFullScreenIntentModalTrigger(fn: (onDismissed: () => void) => void) {
  _showFullScreenIntentModal = fn;
}
export function registerBatteryOptModalTrigger(fn: (onDismissed: () => void) => void) {
  _showBatteryOptModal = fn;
}

/**
 * Real check: uses the native OverlayPermissionModule (Settings.canDrawOverlays).
 * Falls back to false if the native module isn't available yet.
 */
async function canDrawOverlays(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return await NativeModules.OverlayPermission.canDrawOverlays();
  } catch {
    return false;
  }
}

/**
 * Check if USE_FULL_SCREEN_INTENT is granted (required on Android 14+ for alarm
 * screen to open automatically without user tap).
 * Uses native OverlayPermissionModule which calls NotificationManager.canUseFullScreenIntent().
 * Opens the exact settings page for this app so the user just has to toggle it ON.
 * Returns true if settings were opened (caller should skip further prompts this session).
 */
export async function checkAndPromptFullScreenIntent(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const granted: boolean = await NativeModules.OverlayPermission.canUseFullScreenIntent();
    if (granted) return false;
    const showModal = _showFullScreenIntentModal;
    if (showModal) {
      await new Promise<void>((resolve) => {
        showModal(resolve);
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if SYSTEM_ALERT_WINDOW (Display over other apps) is granted using
 * the native Settings.canDrawOverlays() API — accurate on all Android versions.
 * If not granted, shows the styled OverlayPermissionModal.
 */
export async function checkAndPromptOverlayPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const granted = await canDrawOverlays();
  if (granted) return;
  const showModal = _showOverlayModal;
  if (!showModal) return;
  await new Promise<void>((resolve) => {
    showModal(resolve);
  });
}

/**
 * Check ALL permissions needed for alarm screen to open automatically on time, in all situations:
 *   - Phone locked / screen off
 *   - User using another app
 *   - App killed
 *
 * USE_FULL_SCREEN_INTENT alone handles all three cases — SYSTEM_ALERT_WINDOW is not needed.
 * Battery optimization must also be OFF so Samsung/OEM does not delay alarm delivery.
 *
 * Call whenever user enables an alarm (task-editor / event-editor) AND on every app open.
 */
export async function checkAllAlarmPermissions(): Promise<void> {
  if (Platform.OS === 'ios') {
    await requestNotificationPermission();
    return;
  }
  if (Platform.OS !== 'android') return;
  // Only ask once — first time user sets an alarm (task, event, or settings toggle).
  // Flag is written BEFORE showing modals so "Later" also permanently counts as asked.
  // After this, no alarm permission modals will ever auto-appear again.
  try {
    const alreadyAsked = await AsyncStorage.getItem('alarmPermissionsAsked');
    if (alreadyAsked) return;
    await AsyncStorage.setItem('alarmPermissionsAsked', 'true');
  } catch {
    /* proceed if storage unavailable */
  }
  await checkAndPromptFullScreenIntent();
  await checkAlarmSystemPermissions();
  await checkAndPromptOverlayPermission();
}

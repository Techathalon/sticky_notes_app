// Firebase Admin SDK — sends push to both Android (FCM) and iOS (APNs via FCM)
import * as admin from 'firebase-admin';
import { env } from '../config';

let messaging: admin.messaging.Messaging | null = null;

function getMessaging(): admin.messaging.Messaging | null {
  if (messaging) return messaging;
  if (!env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as admin.ServiceAccount;
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    messaging = admin.messaging();
    return messaging;
  } catch (err) {
    console.error('[FCM] Failed to init Firebase Admin:', err);
    return null;
  }
}

/**
 * Send a push notification to one or more device tokens.
 * Works for both Android (FCM) and iOS (APNs via FCM).
 * Tokens should be FCM registration tokens obtained from the device.
 */
export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const msg = getMessaging();
  if (!msg || tokens.length === 0) return;
  try {
    await msg.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { ...data },
      // Android: high-priority delivery
      android: {
        priority: 'high',
        notification: { sound: 'default', icon: 'ic_launcher', color: '#6366F1' },
      },
      // iOS (APNs via FCM)
      apns: {
        payload: {
          aps: {
            sound: 'default',
            contentAvailable: true,
          },
        },
      },
    });
  } catch (err) {
    console.error('[FCM] sendPushNotification error:', err);
  }
}

/**
 * Send an alarm-type push notification.
 * On Android: uses MAX priority + fullScreenIntent channel so the alarm screen
 * opens even when the app is in the background or killed.
 * On iOS: shows a critical-style banner (user must tap to open alarm screen —
 * iOS does not allow auto full-screen takeover from push).
 * The mobile _layout.tsx checks data.alarmTitle and opens alarm-screen.
 */
export async function sendAlarmNotification(
  tokens: string[],
  alarmId: string,
  alarmTitle: string,
  alarmType: 'task' | 'event',
  alarmAt: string,
): Promise<void> {
  const msg = getMessaging();
  if (!msg || tokens.length === 0) return;
  try {
    await msg.sendEachForMulticast({
      tokens,
      // No 'notification' field → data-only message.
      // This ensures onMessageReceived fires in ALL app states (foreground/background/killed)
      // so AlarmMessagingService.kt can show a fullScreenIntent local notification.
      // alarmId is sent so AlarmMessagingService uses the same notification ID as notifee,
      // preventing a duplicate notification.
      data: { type: 'alarm', alarmId, alarmTitle, alarmType, alarmAt },
      android: { priority: 'high' }, // HIGH priority wakes device even in doze mode
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            contentAvailable: true, // silent push wakes iOS app
          },
        },
      },
    });
  } catch (err) {
    console.error('[FCM] sendAlarmNotification error:', err);
  }
}

/**
 * Tell ALL logged-in devices to schedule a local alarm immediately.
 * Sent right after a task/event with alarm is created or updated.
 * The receiving device's _layout.tsx calls scheduleLocalAlarm() on receipt.
 */
export async function sendScheduleAlarmToDevices(
  tokens: string[],
  alarmId: string,
  alarmTitle: string,
  alarmAt: string,
  alarmType: 'task' | 'event',
): Promise<void> {
  const msg = getMessaging();
  if (!msg || tokens.length === 0) return;
  try {
    await msg.sendEachForMulticast({
      tokens,
      data: { type: 'schedule_alarm', alarmId, alarmTitle, alarmAt, alarmType },
      android: { priority: 'high' },
      apns: {
        headers: { 'apns-priority': '5' },
        payload: { aps: { contentAvailable: true } },
      },
    });
  } catch (err) {
    console.error('[FCM] sendScheduleAlarmToDevices error:', err);
  }
}

/**
 * Silent data-only FCM — tells all devices to reload synced app settings from the backend.
 * No notification banner is shown.
 */
export async function sendSyncSettings(tokens: string[]): Promise<void> {
  const msg = getMessaging();
  if (!msg || tokens.length === 0) return;
  try {
    await msg.sendEachForMulticast({
      tokens,
      data: { type: 'sync_settings' },
      android: { priority: 'normal' },
      apns: {
        headers: { 'apns-priority': '5' },
        payload: { aps: { contentAvailable: true } },
      },
    });
  } catch (err) {
    console.error('[FCM] sendSyncSettings error:', err);
  }
}

/**
 * Tell ALL logged-in devices to cancel a previously scheduled local alarm.
 * Sent when a task/event alarm is turned off or deleted.
 */
export async function sendCancelAlarmToDevices(
  tokens: string[],
  alarmId: string,
): Promise<void> {
  const msg = getMessaging();
  if (!msg || tokens.length === 0) return;
  try {
    await msg.sendEachForMulticast({
      tokens,
      data: { type: 'cancel_alarm', alarmId },
      android: { priority: 'normal' },
      apns: {
        headers: { 'apns-priority': '5' },
        payload: { aps: { contentAvailable: true } },
      },
    });
  } catch (err) {
    console.error('[FCM] sendCancelAlarmToDevices error:', err);
  }
}

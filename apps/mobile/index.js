import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';

// Must be registered here (module root / headless JS entry point) — NOT inside a React component.
// This fires even when the app is in background or killed.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.DELIVERED || type === EventType.PRESS) {
    const data = detail.notification?.data;
    if (data?.alarmTitle) {
      // Check per-device alarm setting directly from AsyncStorage (no Zustand in headless JS).
      // Zustand persist stores as { state: { alarmsEnabled: bool, ... } } under this key.
      try {
        const raw = await AsyncStorage.getItem('notifications-preference');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.state?.alarmsEnabled === false) {
            // Also cancel the notifee notification so no banner appears.
            const notifId = detail.notification?.id;
            if (notifId) {
              await notifee.cancelNotification(notifId).catch(() => {});
            }
            return;
          }
        }
      } catch { /* if unreadable, allow alarm to show */ }

      // notification id === alarmId (set in scheduleLocalAlarm); also in data.alarmId as of current build
      const alarmId = data.alarmId ?? detail.notification?.id ?? '';
      const alarmAt = data.alarmAt ?? '';
      const payload = JSON.stringify({ title: data.alarmTitle, type: data.alarmType ?? 'task', alarmId, alarmAt });

      if (type === EventType.DELIVERED) {
        // Write AsyncStorage and launch the screen IN PARALLEL — do not await storage
        // before firing launchAlarmScreen, as that delay makes the alarm screen open late.
        const storageWrite = AsyncStorage.setItem('pendingAlarm', payload);
        // startActivity() is allowed from background when SYSTEM_ALERT_WINDOW is granted —
        // this handles screen-ON + using another app. fullScreenAction handles screen-off/locked.
        NativeModules.OverlayPermission?.launchAlarmScreen?.(
          data.alarmTitle,
          data.alarmType ?? 'task',
          alarmId,
          alarmAt
        )?.catch?.((e) => console.warn('[AlarmBg] launchAlarmScreen failed:', e));
        await storageWrite;
      } else if (type === EventType.PRESS) {
        // User explicitly tapped the notification banner (happens when Display-over-other-apps
        // is OFF so the alarm screen couldn't auto-open). Write to a SEPARATE key so the
        // AppState listener can navigate even if 'pendingAlarm' was already consumed by a
        // prior foreground event. PRESS fires after the app opens, so AppState retries for it.
        await AsyncStorage.setItem('pendingAlarmPress', payload);
      }
    }
  }
});

// Expo Router entry — must come after notifee registration
import 'expo-router/entry';

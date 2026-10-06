import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { useIsDark, useThemeHydrated } from '../store/themeStore';
import { useNotificationsStore } from '../store/notificationsStore';
import { requestNotificationPermission, requestAlarmPermission } from '../utils/notifications';
import notifee from '@notifee/react-native';
import { scheduleLocalAlarm, cancelLocalAlarm, registerNotifeeHandler, registerOverlayModalTrigger, registerFullScreenIntentModalTrigger, registerBatteryOptModalTrigger } from '../utils/alarmManager';
import { OverlayPermissionModal } from '../components/OverlayPermissionModal';
import { FullScreenIntentModal } from '../components/FullScreenIntentModal';
import { BatteryOptimizationModal } from '../components/BatteryOptimizationModal';
import { pushApi } from '../services/api';

SplashScreen.preventAutoHideAsync();

// Suppress FCM type='alarm' banners in foreground on Android — notifee local alarm already shows the UI.
// Also suppress all alarm-related notifications when the user has disabled alarms in settings.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { type?: string } | undefined;
    const alarmsEnabled = useNotificationsStore.getState().alarmsEnabled;
    const isAlarmNotification = data?.type === 'alarm' || data?.type === 'schedule_alarm';
    if (isAlarmNotification && !alarmsEnabled) {
      return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
    }
    if (Platform.OS === 'android' && data?.type === 'alarm') {
      return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
    }
    return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
  },
});

export default function RootLayout() {
  const { loadToken, isAuthenticated, isInitialized } = useAuthStore();
  const { setNotificationsEnabled, setAlarmsEnabled } = useNotificationsStore();
  const isDark = useIsDark();
  const themeHydrated = useThemeHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  // Set to true the moment we decide to navigate to alarm-screen, so the auth
  // redirect (which fires in the same tick via setTimeout(0)) doesn't overwrite it.
  const alarmNavigatingRef = useRef(false);
  // Alarm triggered while app was killed/background — held until navigation is ready
  const [pendingAlarm, setPendingAlarm] = useState<{ title: string; type: string; fromBackground: boolean; alarmId: string; alarmAt: string } | null>(null);
  const [showOverlayModal, setShowOverlayModal] = useState(false);
  const overlayDismissRef = useRef<(() => void) | null>(null);
  const [showFullScreenIntentModal, setShowFullScreenIntentModal] = useState(false);
  const fullScreenIntentDismissRef = useRef<(() => void) | null>(null);
  const [showBatteryOptModal, setShowBatteryOptModal] = useState(false);
  const batteryOptDismissRef = useRef<(() => void) | null>(null);

  // Register modal triggers so alarmManager.ts can open each one and await user action
  useEffect(() => {
    registerOverlayModalTrigger((onDismissed) => {
      overlayDismissRef.current = onDismissed;
      setShowOverlayModal(true);
    });
    registerFullScreenIntentModalTrigger((onDismissed) => {
      fullScreenIntentDismissRef.current = onDismissed;
      setShowFullScreenIntentModal(true);
    });
    registerBatteryOptModalTrigger((onDismissed) => {
      batteryOptDismissRef.current = onDismissed;
      setShowBatteryOptModal(true);
    });
  }, []);

  const [fontsLoaded] = useFonts({
    // Add custom fonts here if needed
  });

  // Run loadToken once on mount — restores session from SecureStore
  useEffect(() => {
    loadToken();
  }, []);

  // Detect alarm on cold start via two paths:
  //   1. Linking.getInitialURL() — app opened by AlarmMessagingService.kt fullScreenIntent deep link
  //   2. notifee.getInitialNotification() — app opened by notifee fullScreenAction (user pressed)
  // Both store to pendingAlarm so the navigation effect below can open alarm-screen once ready.
  useEffect(() => {
    // Path 1: deep link (stickynotes://alarm-screen?title=...&type=...)
    Linking.getInitialURL().then((url) => {
      if (url?.includes('alarm-screen')) {
        try {
          const parsed = new URL(url);
          const title = parsed.searchParams.get('title') ?? '';
          const type = parsed.searchParams.get('type') ?? 'task';
          const alarmId = parsed.searchParams.get('alarmId') ?? '';
          const alarmAt = parsed.searchParams.get('alarmAt') ?? '';
          if (title) setPendingAlarm({ title, type, fromBackground: true, alarmId, alarmAt });
        } catch {// ignore
          }
      }
    });

    // Path 2: notifee notification press (user tapped fullscreen notification)
    notifee.getInitialNotification().then((initial) => {
      const data = initial?.notification?.data as { alarmTitle?: string; alarmType?: string; alarmId?: string; alarmAt?: string } | undefined;
      if (data?.alarmTitle) {
        setPendingAlarm({ title: data.alarmTitle, type: data.alarmType ?? 'task', fromBackground: true, alarmId: data.alarmId ?? '', alarmAt: data.alarmAt ?? '' });
      }
    });

    // Path 3: notifee background event stored alarm while app was killed
    // (onBackgroundEvent in index.js writes to AsyncStorage when local alarm fires)
    AsyncStorage.getItem('pendingAlarm').then(async (stored) => {
      if (stored) {
        await AsyncStorage.removeItem('pendingAlarm');
        const alarm = JSON.parse(stored) as { title: string; type: string; alarmId?: string; alarmAt?: string };
        const dismissedId = await AsyncStorage.getItem('lastDismissedAlarmId').catch(() => null);
        if (dismissedId && dismissedId === (alarm.alarmId ?? '')) return;
        setPendingAlarm({ ...alarm, fromBackground: true, alarmId: alarm.alarmId ?? '', alarmAt: alarm.alarmAt ?? '' });
      }
    });

    // Path 3 retry — onBackgroundEvent (headless JS) may still be writing when the
    // activity starts. Re-read after 1s to catch the alarm if the first read was too early.
    setTimeout(() => {
      AsyncStorage.getItem('pendingAlarm').then(async (stored) => {
        if (stored) {
          await AsyncStorage.removeItem('pendingAlarm');
          const alarm = JSON.parse(stored) as { title: string; type: string; alarmId?: string; alarmAt?: string };
          const dismissedId = await AsyncStorage.getItem('lastDismissedAlarmId').catch(() => null);
          if (dismissedId && dismissedId === (alarm.alarmId ?? '')) return;
          setPendingAlarm({ ...alarm, fromBackground: true, alarmId: alarm.alarmId ?? '', alarmAt: alarm.alarmAt ?? '' });
        }
      });
    }, 1000);
  }, []);

  // Navigate to alarm screen once app is ready (handles killed-app launch from both paths above)
  useEffect(() => {
    if (!pendingAlarm || !isInitialized || !fontsLoaded || !themeHydrated) return;
    if (!useNotificationsStore.getState().alarmsEnabled) { setPendingAlarm(null); return; }
    // Guard: multiple paths (AsyncStorage immediate, 1s retry, getInitialNotification) can all
    // set pendingAlarm. Without this check, alarm-screen would be pushed multiple times — each
    // instance plays its own sound, and dismissing only the top one leaves the others playing.
    if (alarmNavigatingRef.current) { setPendingAlarm(null); return; }
    alarmNavigatingRef.current = true;
    router.push({ pathname: '/alarm-screen', params: { title: pendingAlarm.title, type: pendingAlarm.type, fromBackground: String(pendingAlarm.fromBackground), alarmId: pendingAlarm.alarmId, alarmAt: pendingAlarm.alarmAt } });
    setPendingAlarm(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAlarm, isInitialized, fontsLoaded, themeHydrated]);

  // Ask notification + alarm permissions once authenticated,
  // then register the FCM device token with the backend.
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    requestNotificationPermission().then(async (granted) => {
      setNotificationsEnabled(granted);
      if (!granted) {
        setAlarmsEnabled(false);
        return;
      }
      requestAlarmPermission();
      try {
        const result = await Notifications.getDevicePushTokenAsync();
        const token = typeof result.data === 'string' ? result.data : null;
        if (token) {
          const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
          await AsyncStorage.setItem('fcm-device-token', token);
          await pushApi.registerToken(token, platform);
        }
      } catch (err) {
        console.error('[FCM] token registration failed:', err);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isAuthenticated]);

  // Load synced app settings from backend on startup (if sync is enabled on this device).
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;
    const { settingsSyncEnabled, loadAppSettings } = useNotificationsStore.getState();
    if (settingsSyncEnabled) loadAppSettings().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isAuthenticated]);

  // Re-sync notification permission whenever app returns to foreground.
  // Handles the case where user enables/disables permission in device Settings.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') return;
      try {
        const { status } = await Notifications.getPermissionsAsync();
        const granted = status === 'granted';
        setNotificationsEnabled(granted);
        if (!granted) setAlarmsEnabled(false);
      } catch { /* ignore */ }
    });
    return () => sub.remove();
  // Zustand setters are stable references — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ref in sync + reset alarm guard when leaving alarm screen (so next alarm can open).
  useEffect(() => {
    pathnameRef.current = pathname;
    if (!pathname.startsWith('/alarm-screen')) {
      alarmNavigatingRef.current = false;
    }
  }, [pathname]);

  // Redirect based on auth state once token loading is complete.
  // Skip if already on alarm-screen — deep link from AlarmMessagingService already routed there.
  useEffect(() => {
    if (!isInitialized || !fontsLoaded || !themeHydrated) return;
    // Defer by one tick so the Root Layout navigator has mounted before we navigate.
    const t = setTimeout(() => {
      // Skip if alarm screen navigation was already triggered (ref set synchronously before push).
      if (alarmNavigatingRef.current || pathnameRef.current.startsWith('/alarm-screen')) return;
      try {
        if (isAuthenticated) {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/(auth)/login');
        }
      } catch { /* navigator not ready yet — next render will retry */ }
    }, 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isInitialized, fontsLoaded, themeHydrated]);

  // Notification event handlers
  useEffect(() => {
    const openAlarm = (title: string, type: string, fromBackground: boolean, alarmId = '', alarmAt = '') => {
      if (!useNotificationsStore.getState().alarmsEnabled) return;
      if (alarmNavigatingRef.current) return;
      alarmNavigatingRef.current = true;
      try {
        router.push({ pathname: '/alarm-screen', params: { title, type, fromBackground: String(fromBackground), alarmId, alarmAt } });
      } catch {
        // Navigator not ready (e.g. app briefly foregrounded by launchAlarmScreen before
        // React tree mounted). Put the alarm back so the next foreground event can retry.
        alarmNavigatingRef.current = false;
        AsyncStorage.setItem('pendingAlarm', JSON.stringify({ title, type, alarmId, alarmAt })).catch(() => {});
        return;
      }
      // Safety reset: some OEM devices foreground the app via launchAlarmScreen but the
      // navigation silently fails (no throw). If we haven't arrived on alarm-screen within
      // 3 s, unblock so the user's tap / next event can retry.
      setTimeout(() => {
        if (!pathnameRef.current.startsWith('/alarm-screen')) {
          alarmNavigatingRef.current = false;
        }
      }, 3000);
    };

    // Deep link listener — catches stickynotes://alarm-screen?... when app is BACKGROUNDED.
    // Linking.getInitialURL() only works on cold start; this handles the background case
    // where AlarmMessagingService (FCM) sends the deep link while the app is already running.
    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      if (url?.includes('alarm-screen')) {
        try {
          const parsed = new URL(url);
          const title = parsed.searchParams.get('title') ?? '';
          const type = parsed.searchParams.get('type') ?? 'task';
          const alarmId = parsed.searchParams.get('alarmId') ?? '';
          const alarmAt = parsed.searchParams.get('alarmAt') ?? '';
          if (title) openAlarm(title, type, true, alarmId, alarmAt);
        } catch { /* ignore malformed URLs */ }
      }
    });

    // When app returns to foreground, check if background event stored an alarm.
    // Two keys are used:
    //   'pendingAlarm'      — written by DELIVERED (alarm fired automatically)
    //   'pendingAlarmPress' — written by PRESS (user explicitly tapped notification banner)
    // PRESS fires AFTER AppState so we retry with a longer window for that key.
    const appStateSub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;

      // Helper: read whichever pending-alarm key is available (DELIVERED takes priority).
      // Removes the key once found so it is not processed twice.
      async function consumePendingAlarm(): Promise<string | null> {
        let v = await AsyncStorage.getItem('pendingAlarm');
        if (v) { await AsyncStorage.removeItem('pendingAlarm'); return v; }
        v = await AsyncStorage.getItem('pendingAlarmPress');
        if (v) { await AsyncStorage.removeItem('pendingAlarmPress'); return v; }
        return null;
      }

      // Check immediately — covers the normal case where DELIVERED wrote before foreground.
      // If nothing yet, retry up to 3 s: headless-JS DELIVERED and PRESS both run after the
      // activity starts, so either key may arrive slightly late.
      let stored = await consumePendingAlarm();
      if (!stored) {
        for (let i = 0; i < 6; i++) {
          await new Promise<void>((resolve) => setTimeout(resolve, 500));
          stored = await consumePendingAlarm();
          if (stored) break;
        }
      }

      // Fallback: headless JS (onBackgroundEvent PRESS) can be killed on aggressive OEM
      // battery managers before it writes pendingAlarmPress. If both AsyncStorage keys are
      // empty, check whether notifee has a displayed alarm notification that fired recently
      // — if so, the user almost certainly tapped it to open the app.
      if (!stored) {
        try {
          const displayed = await notifee.getDisplayedNotifications();
          const alarmNotif = displayed.find(
            (n) => (n.notification?.data as { alarmTitle?: string } | undefined)?.alarmTitle,
          );
          if (alarmNotif) {
            const d = alarmNotif.notification?.data as
              | { alarmTitle?: string; alarmType?: string; alarmId?: string; alarmAt?: string }
              | undefined;
            if (d?.alarmTitle) {
              // Only act if alarm fired within the last 10 minutes — avoids re-opening
              // a stale notification that the user left in the shade from a prior alarm.
              const firedAt = d.alarmAt ? parseInt(d.alarmAt, 10) : 0;
              if (Date.now() - firedAt < 10 * 60 * 1000) {
                const dismissedId = await AsyncStorage.getItem('lastDismissedAlarmId').catch(() => null);
                if (!dismissedId || dismissedId !== (d.alarmId ?? '')) {
                  stored = JSON.stringify({ title: d.alarmTitle, type: d.alarmType ?? 'task', alarmId: d.alarmId ?? '', alarmAt: d.alarmAt ?? '' });
                }
              }
            }
          }
        } catch { /* ignore — notifee API unavailable */ }
      }

      if (stored) {
        const alarm = JSON.parse(stored) as { title: string; type: string; alarmId?: string; alarmAt?: string };
        const dismissedId = await AsyncStorage.getItem('lastDismissedAlarmId').catch(() => null);
        if (dismissedId && dismissedId === (alarm.alarmId ?? '')) return;
        openAlarm(alarm.title, alarm.type, true, alarm.alarmId ?? '', alarm.alarmAt ?? '');
      }
    });

    // Foreground FCM handler:
    //   type='schedule_alarm' → schedule local alarm
    //   type='cancel_alarm'   → cancel local alarm
    //   type='alarm' (iOS only) → open alarm screen
    //   Android type='alarm' is handled by notifee's EventType.DELIVERED below
    const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as {
        type?: string;
        alarmTitle?: string;
        alarmType?: string;
        alarmId?: string;
        alarmAt?: string;
        todoId?: string;
        eventId?: string;
      } | undefined;

      if (!data) return;

      if (data.type === 'schedule_alarm' && data.alarmId && data.alarmTitle && data.alarmAt) {
        // Skip scheduling on devices where alarms are disabled in settings.
        if (!useNotificationsStore.getState().alarmsEnabled) return;
        // Only schedule if alarm is still in the future — delayed FCM arrival after alarm
        // time would cause notifee to fire immediately, creating a second notification.
        const alarmTime = new Date(data.alarmAt).getTime();
        if (alarmTime > Date.now() + 5000) {
          scheduleLocalAlarm(
            data.alarmId,
            data.alarmTitle,
            new Date(data.alarmAt),
            (data.alarmType ?? 'task') as 'task' | 'event'
          ).catch(() => {});
        }
      } else if (data.type === 'sync_settings') {
        // Another device saved new settings — reload if this device has sync enabled.
        if (useNotificationsStore.getState().settingsSyncEnabled) {
          useNotificationsStore.getState().loadAppSettings().catch(() => {});
        }
      } else if (data.type === 'cancel_alarm' && data.alarmId) {
        cancelLocalAlarm(data.alarmId).catch(() => {});
      } else if (data.type === 'task_reminder' && data.todoId) {
        // Reminder tapped while app is open — do nothing (banner is informational)
      } else if (data.type === 'event_reminder' && data.eventId) {
        // Reminder tapped while app is open — do nothing (banner is informational)
      } else if (data.alarmTitle && Platform.OS !== 'android') {
        // Android: notifee EventType.DELIVERED (registerNotifeeHandler) handles this.
        // Doing it here too would push alarm-screen twice.
        // openAlarm() already checks alarmsEnabled internally.
        openAlarm(data.alarmTitle, data.alarmType ?? 'task', true, data.alarmId ?? '', data.alarmAt ?? '');
      }
    });

    // Background/killed: user taps the notification banner
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string;
        alarmTitle?: string;
        alarmType?: string;
        alarmId?: string;
        alarmAt?: string;
        todoId?: string;
        eventId?: string;
      } | undefined;
      if (!data) return;
      if (data.type === 'task_reminder' && data.todoId) {
        router.push(`/task-editor?id=${data.todoId}`);
      } else if (data.type === 'event_reminder' && data.eventId) {
        router.push(`/event-editor?id=${data.eventId}`);
      } else if (data.type === 'task_start' && data.todoId) {
        router.push(`/task-editor?id=${data.todoId}`);
      } else if (data.type === 'event_start' && data.eventId) {
        router.push(`/event-editor?id=${data.eventId}`);
      } else if (data.alarmTitle) {
        openAlarm(data.alarmTitle, data.alarmType ?? 'task', true, data.alarmId ?? '', data.alarmAt ?? '');
      }
    });

    // Notifee foreground handler — fires when local alarm triggers while app is open
    // fromBackground=false: alarm fired while user was already in the app
    const notifeeUnsub = registerNotifeeHandler((title, type, alarmId, alarmAt) => openAlarm(title, type, false, alarmId, alarmAt));

    return () => {
      linkingSub.remove();
      appStateSub.remove();
      foregroundSub.remove();
      responseSub.remove();
      notifeeUnsub();
    };
  }, []);

  // Keep splash screen visible until auth + fonts are ready
  useEffect(() => {
    if (fontsLoaded && isInitialized && themeHydrated) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isInitialized, themeHydrated]);

  if (!fontsLoaded || !themeHydrated) return null;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <FullScreenIntentModal visible={showFullScreenIntentModal} onDismiss={() => {
        setShowFullScreenIntentModal(false);
        fullScreenIntentDismissRef.current?.();
        fullScreenIntentDismissRef.current = null;
      }} />
      <BatteryOptimizationModal visible={showBatteryOptModal} onDismiss={() => {
        setShowBatteryOptModal(false);
        batteryOptDismissRef.current?.();
        batteryOptDismissRef.current = null;
      }} />
      <OverlayPermissionModal visible={showOverlayModal} onDismiss={() => {
        setShowOverlayModal(false);
        overlayDismissRef.current?.();
        overlayDismissRef.current = null;
      }} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="note-category" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="note-editor" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="task-editor" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="event-editor" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="expense-editor" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="alarm-screen" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="notification-settings" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, NativeModules,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
// AudioPlayer type used by module-level _alarmPlayer below
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cancelLocalAlarm } from '../utils/alarmManager';

const { width } = Dimensions.get('window');

// Module-level player — survives component unmount/remount.
let _alarmPlayer: AudioPlayer | null = null;

// Guards against a duplicate alarm-screen mount (multiple navigation paths can push it twice
// in the killed-app scenario). If a second instance mounts, it immediately exits.
let _alarmActive = false;

async function stopAllAlarmAudio() {
  if (_alarmPlayer) {
    // Null out FIRST so no other code path can touch this player while we stop it.
    const player = _alarmPlayer;
    _alarmPlayer = null;
    // Each step in its own try/catch — if pause() throws, remove() still runs.
    try { player.loop = false; } catch (_) { /* ignore */ }
    try { player.pause(); } catch (_) { /* ignore */ }
    try { player.remove(); } catch (_) { /* ignore */ }
  }
  await setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
}
const AUTO_DISMISS_MS = 2 * 60 * 1000; // 2 minutes

const MISSED_THRESHOLD_MS = 2 * 60 * 1000; // 5 minutes

export default function AlarmScreen() {
  console.log('AlarmScreen opened');
  const router = useRouter();
  const { title = 'Reminder', type = 'task', fromBackground = 'false', alarmId = '', alarmAt = '' } = useLocalSearchParams<{ title?: string; type?: string; fromBackground?: string; alarmId?: string; alarmAt?: string }>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(false);

  const isMissed = alarmAt ? (Date.now() - Number(alarmAt)) > MISSED_THRESHOLD_MS : false;

  // ── Bell shake animation ──────────────────────────────────────
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isMissed) return; // no animation for missed alarms
    // Shake: left-right ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1,  duration: 80,  useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 80,  useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 1,  duration: 80,  useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 80,  useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,  duration: 80,  useNativeDriver: true }),
        Animated.delay(600),
      ]),
    ).start();

    // Scale bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 300, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1,    duration: 300, useNativeDriver: true }),
        Animated.delay(600),
      ]),
    ).start();

    // Outer pulse ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [isMissed]);

  // ── Sound ─────────────────────────────────────────────────────
  useEffect(() => {
    // Duplicate-instance guard: if another alarm screen is already active (can happen in
    // killed-app scenario where multiple navigation paths all push alarm-screen), exit
    // immediately without starting sound. The real instance handles everything.
    if (_alarmActive) {
      router.back();
      return;
    }
    _alarmActive = true;

    let mounted = true;

    async function playSound() {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const player = createAudioPlayer(require('../assets/sounds/alarm.wav') as number);
        if (!mounted || dismissedRef.current) { player.remove(); return; }
        if (isMissed) {
          // Play once briefly then stop — alarm time already passed
          player.loop = false;
          player.volume = 0.5;
          player.play();
          setTimeout(() => { try { player.pause(); player.remove(); } catch { /* ignore */ } }, 2000);
        } else {
          player.loop = true;
          player.volume = 1.0;
          player.play();
          _alarmPlayer = player;
        }
      } catch {
        // sound failed — alarm screen still shows
      }
    }

    playSound();

    // Auto-dismiss after 2 minutes (active alarms only — missed alarms stay until user acts)
    if (!isMissed) {
      timerRef.current = setTimeout(() => { if (mounted) dismiss(); }, AUTO_DISMISS_MS);
    }

    return () => {
      mounted = false;
      _alarmActive = false;
      stopAllAlarmAudio();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // dismiss and router are stable references; isMissed is derived from params and never changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMissed]);

  async function dismiss() {
    if (dismissedRef.current) return; // prevent double-tap
    dismissedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    await stopAllAlarmAudio();
    // Cancel the scheduled trigger so Android AlarmManager does not re-fire it
    if (alarmId) await cancelLocalAlarm(alarmId).catch(() => {});
    // Mark this alarmId as dismissed BEFORE clearing pendingAlarm.
    // onBackgroundEvent (index.js) may finish writing pendingAlarm AFTER this dismiss runs
    // (race condition). appStateSub checks lastDismissedAlarmId to skip re-showing it.
    if (alarmId) await AsyncStorage.setItem('lastDismissedAlarmId', alarmId).catch(() => {});
    // Clear both AsyncStorage keys so appStateSub does not re-open alarm on next foreground
    await AsyncStorage.removeItem('pendingAlarm').catch(() => {});
    await AsyncStorage.removeItem('pendingAlarmPress').catch(() => {});
    await notifee.cancelDisplayedNotifications().catch(() => {});
    try {
      const isLocked: boolean = await NativeModules.OverlayPermission.isDeviceLocked();
      router.replace('/(tabs)/home');
      // If alarm was triggered from background (user was in another app or device was locked),
      // move the app back to background so the user returns to what they were doing.
      if (fromBackground === 'true' || isLocked) {
        await new Promise<void>((r) => setTimeout(r, 200));
        NativeModules.OverlayPermission.moveTaskToBackground();
      }
    } catch {
      router.replace('/(tabs)/home');
    }
  }

  const rotate = shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });

  const isEvent = type === 'event';
  const accentColor = isEvent ? '#8B5CF6' : '#E11D48';
  const missedColor = '#475569';

  const missedTimeLabel = alarmAt
    ? new Date(Number(alarmAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const handleGoToItem = () => {
    dismiss();
    if (type === 'event') router.replace(`/event-editor?id=${alarmId}` as never);
    else router.replace(`/task-editor?id=${alarmId}` as never);
  };

  // Countdown display (active alarms only)
  const [remaining, setRemaining] = useState(AUTO_DISMISS_MS / 1000);
  useEffect(() => {
    if (isMissed) return;
    const iv = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(iv);
  }, [isMissed]);
  const mins = Math.floor(remaining / 60);
  const secs = String(remaining % 60).padStart(2, '0');

  if (isMissed) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: '#0F172A' }]}>
        <View style={s.content}>
          <View style={[s.iconWrap, { backgroundColor: missedColor + '30' }]}>
            <View style={[s.iconInner, { backgroundColor: missedColor }]}>
              <Ionicons name="alarm-outline" size={52} color="#fff" />
            </View>
          </View>
          <Text style={[s.alarmLabel, { color: '#64748B' }]}>Missed Alarm</Text>
          <Text style={s.titleText} numberOfLines={3}>{title}</Text>
          <Text style={s.subText}>
            {isEvent ? 'Event was due' : 'Task was due'}{missedTimeLabel ? ` at ${missedTimeLabel}` : ''}
          </Text>
        </View>

        <View style={s.missedButtons}>
          {alarmId ? (
            <TouchableOpacity style={[s.missedBtn, { backgroundColor: accentColor }]} onPress={handleGoToItem} activeOpacity={0.85}>
              <Ionicons name="open-outline" size={20} color="#fff" />
              <Text style={s.dismissText}>View {isEvent ? 'Event' : 'Task'}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[s.missedBtn, { backgroundColor: missedColor }]} onPress={dismiss} activeOpacity={0.85}>
            <Ionicons name="close-circle-outline" size={20} color="#fff" />
            <Text style={s.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: isEvent ? '#1E1035' : '#1A0010' }]}>
      {/* Pulse ring */}
      <Animated.View style={[s.pulseRing, { borderColor: accentColor + '40', transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={[s.pulseRing2, { borderColor: accentColor + '20', transform: [{ scale: pulseAnim }] }]} />

      <View style={s.content}>
        {/* Animated alarm icon */}
        <Animated.View style={[s.iconWrap, { backgroundColor: accentColor + '20', transform: [{ rotate }, { scale: scaleAnim }] }]}>
          <View style={[s.iconInner, { backgroundColor: accentColor }]}>
            <Ionicons name="alarm" size={52} color="#fff" />
          </View>
        </Animated.View>

        {/* Labels */}
        <Text style={s.alarmLabel}>{isEvent ? 'Event Reminder' : 'Task Reminder'}</Text>
        <Text style={s.titleText} numberOfLines={3}>{title}</Text>
        <Text style={s.subText}>
          {isEvent ? 'Your event is starting now' : 'Your task is due now'}
        </Text>

        {/* Countdown */}
        <View style={s.countdownWrap}>
          <Ionicons name="time-outline" size={16} color="#94A3B8" />
          <Text style={s.countdown}>Auto-dismiss in {mins}:{secs}</Text>
        </View>
      </View>

      {/* Dismiss button */}
      <TouchableOpacity style={[s.dismissBtn, { backgroundColor: accentColor }]} onPress={dismiss} activeOpacity={0.85}>
        <Ionicons name="close-circle-outline" size={22} color="#fff" />
        <Text style={s.dismissText}>Dismiss Alarm</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 48,
  },
  pulseRing: {
    position: 'absolute',
    width: 260, height: 260, borderRadius: 130,
    borderWidth: 2,
  },
  pulseRing2: {
    position: 'absolute',
    width: 320, height: 320, borderRadius: 160,
    borderWidth: 2,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  iconWrap: {
    width: 160, height: 160, borderRadius: 80,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  iconInner: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  alarmLabel: {
    fontSize: 13, fontWeight: '700', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  titleText: {
    fontSize: 26, fontWeight: '800', color: '#F8FAFC',
    textAlign: 'center', lineHeight: 34,
  },
  subText: {
    fontSize: 14, color: '#94A3B8', textAlign: 'center',
  },
  countdownWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  countdown: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  dismissBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 32,
    width: width - 64,
    paddingVertical: 18,
    borderRadius: 20,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  dismissText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  missedBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, paddingHorizontal: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  missedButtons: {
    flexDirection: 'row', gap: 12,
    marginHorizontal: 32, marginBottom: 8,
  },
});

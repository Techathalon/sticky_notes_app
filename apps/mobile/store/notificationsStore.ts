import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { appSettingsApi, expenseSettingsApi } from '../services/api';

function syncAlarmsEnabledNative(enabled: boolean) {
  if (Platform.OS !== 'android') return;
  NativeModules.OverlayPermission?.setAlarmsEnabled?.(enabled)?.catch?.(() => {});
}

/** Parse "HH:MM" → { hours, minutes } */
function parseTime(t: string): { hours: number; minutes: number } {
  const [h, m] = t.split(':').map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

/** Format { hours, minutes } → "HH:MM" */
function formatTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Convert local HH:MM to UTC HH:MM string */
function localToUtcTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** Convert UTC HH:MM string to local { hour, minute } */
function utcToLocalTime(utcTime: string): { hour: number; minute: number } {
  const [utcH, utcM] = utcTime.split(':').map(Number);
  const d = new Date();
  d.setUTCHours(utcH, utcM, 0, 0);
  return { hour: d.getHours(), minute: d.getMinutes() };
}

interface NotificationsState {
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
  alarmsEnabled: boolean;
  setAlarmsEnabled: (v: boolean) => void;
  // Task reminder
  taskReminderEnabled: boolean;
  setTaskReminderEnabled: (v: boolean) => void;
  taskReminderHours: number;
  setTaskReminderHours: (v: number) => void;
  taskReminderMinutes: number;
  setTaskReminderMinutes: (v: number) => void;
  // Event reminder
  eventReminderEnabled: boolean;
  setEventReminderEnabled: (v: boolean) => void;
  eventReminderHours: number;
  setEventReminderHours: (v: number) => void;
  eventReminderMinutes: number;
  setEventReminderMinutes: (v: number) => void;
  // Expense notifications (synced to backend)
  expenseSummaryEnabled: boolean;
  expenseSummaryHour: number;
  expenseSummaryMinute: number;
  budget80AlertEnabled: boolean;
  budget100AlertEnabled: boolean;
  loadExpenseSettings: () => Promise<void>;
  saveExpenseSettings: (patch: {
    expenseSummaryEnabled?: boolean;
    expenseSummaryHour?: number;
    expenseSummaryMinute?: number;
    budget80AlertEnabled?: boolean;
    budget100AlertEnabled?: boolean;
  }) => Promise<void>;
  // Cross-device settings sync
  settingsSyncEnabled: boolean;
  setSettingsSyncEnabled: (v: boolean) => Promise<void>;
  loadAppSettings: () => Promise<void>;
  saveAppSettings: () => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notificationsEnabled: true,
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),

      alarmsEnabled: true,
      setAlarmsEnabled: (v) => {
        set({ alarmsEnabled: v });
        syncAlarmsEnabledNative(v);
        if (get().settingsSyncEnabled) get().saveAppSettings().catch(() => {});
      },

      taskReminderEnabled: true,
      setTaskReminderEnabled: (v) => {
        set({ taskReminderEnabled: v });
        if (get().settingsSyncEnabled) get().saveAppSettings().catch(() => {});
      },
      taskReminderHours: 0,
      setTaskReminderHours: (v) => {
        set({ taskReminderHours: v });
        if (get().settingsSyncEnabled) get().saveAppSettings().catch(() => {});
      },
      taskReminderMinutes: 30,
      setTaskReminderMinutes: (v) => {
        set({ taskReminderMinutes: v });
        if (get().settingsSyncEnabled) get().saveAppSettings().catch(() => {});
      },

      eventReminderEnabled: true,
      setEventReminderEnabled: (v) => {
        set({ eventReminderEnabled: v });
        if (get().settingsSyncEnabled) get().saveAppSettings().catch(() => {});
      },
      eventReminderHours: 0,
      setEventReminderHours: (v) => {
        set({ eventReminderHours: v });
        if (get().settingsSyncEnabled) get().saveAppSettings().catch(() => {});
      },
      eventReminderMinutes: 30,
      setEventReminderMinutes: (v) => {
        set({ eventReminderMinutes: v });
        if (get().settingsSyncEnabled) get().saveAppSettings().catch(() => {});
      },

      // ── Expense notifications ────────────────────────────────
      expenseSummaryEnabled: false,
      expenseSummaryHour: 20,
      expenseSummaryMinute: 0,
      budget80AlertEnabled: true,
      budget100AlertEnabled: true,

      loadExpenseSettings: async () => {
        try {
          const s = await expenseSettingsApi.get();
          const local = utcToLocalTime(s.summaryTime);
          set({
            expenseSummaryEnabled: s.summaryEnabled,
            expenseSummaryHour: local.hour,
            expenseSummaryMinute: local.minute,
            budget80AlertEnabled: s.budget80AlertEnabled,
            budget100AlertEnabled: s.budget100AlertEnabled,
          });
        } catch {
          // keep cached values
        }
      },

      saveExpenseSettings: async (patch) => {
        const prev = get();
        const next = {
          expenseSummaryEnabled: patch.expenseSummaryEnabled ?? prev.expenseSummaryEnabled,
          expenseSummaryHour:    patch.expenseSummaryHour    ?? prev.expenseSummaryHour,
          expenseSummaryMinute:  patch.expenseSummaryMinute  ?? prev.expenseSummaryMinute,
          budget80AlertEnabled:  patch.budget80AlertEnabled  ?? prev.budget80AlertEnabled,
          budget100AlertEnabled: patch.budget100AlertEnabled ?? prev.budget100AlertEnabled,
        };
        set(next);
        try {
          await expenseSettingsApi.update({
            summaryEnabled:        next.expenseSummaryEnabled,
            summaryTime:           localToUtcTime(next.expenseSummaryHour, next.expenseSummaryMinute),
            budget80AlertEnabled:  next.budget80AlertEnabled,
            budget100AlertEnabled: next.budget100AlertEnabled,
          });
          // Also push to unified app-settings sync if sync is on
          if (get().settingsSyncEnabled) get().saveAppSettings().catch(() => {});
        } catch {
          set({
            expenseSummaryEnabled: prev.expenseSummaryEnabled,
            expenseSummaryHour:    prev.expenseSummaryHour,
            expenseSummaryMinute:  prev.expenseSummaryMinute,
            budget80AlertEnabled:  prev.budget80AlertEnabled,
            budget100AlertEnabled: prev.budget100AlertEnabled,
          });
        }
      },

      // ── Cross-device sync ────────────────────────────────────
      settingsSyncEnabled: false,

      setSettingsSyncEnabled: async (v) => {
        set({ settingsSyncEnabled: v });
        if (v) {
          // Turning sync ON: load remote settings (overwrite local) then save current state
          await get().loadAppSettings();
        }
      },

      loadAppSettings: async () => {
        try {
          const s = await appSettingsApi.get();
          const taskTime  = parseTime(s.taskReminderTime);
          const eventTime = parseTime(s.eventReminderTime);
          const expLocal  = utcToLocalTime(s.expenseSummaryTime);
          set({
            alarmsEnabled:         s.alarmsEnabled,
            taskReminderEnabled:   s.taskReminderEnabled,
            taskReminderHours:     taskTime.hours,
            taskReminderMinutes:   taskTime.minutes,
            eventReminderEnabled:  s.eventReminderEnabled,
            eventReminderHours:    eventTime.hours,
            eventReminderMinutes:  eventTime.minutes,
            expenseSummaryEnabled: s.expenseSummaryEnabled,
            expenseSummaryHour:    expLocal.hour,
            expenseSummaryMinute:  expLocal.minute,
            budget80AlertEnabled:  s.budget80AlertEnabled,
            budget100AlertEnabled: s.budget100AlertEnabled,
          });
          syncAlarmsEnabledNative(s.alarmsEnabled);
        } catch {
          // keep local values on network error
        }
      },

      saveAppSettings: async () => {
        const s = get();
        try {
          await appSettingsApi.save({
            alarmsEnabled:         s.alarmsEnabled,
            taskReminderEnabled:   s.taskReminderEnabled,
            taskReminderTime:      formatTime(s.taskReminderHours, s.taskReminderMinutes),
            eventReminderEnabled:  s.eventReminderEnabled,
            eventReminderTime:     formatTime(s.eventReminderHours, s.eventReminderMinutes),
            expenseSummaryEnabled: s.expenseSummaryEnabled,
            expenseSummaryTime:    localToUtcTime(s.expenseSummaryHour, s.expenseSummaryMinute),
            budget80AlertEnabled:  s.budget80AlertEnabled,
            budget100AlertEnabled: s.budget100AlertEnabled,
          });
        } catch {
          // fire-and-forget — local state is already updated
        }
      },
    }),
    {
      name: 'notifications-preference',
      storage: createJSONStorage(() => AsyncStorage),
      // settingsSyncEnabled is intentionally persisted so each device remembers its choice.
      // loadAppSettings is called on app start (_layout.tsx) when sync is enabled.
      onRehydrateStorage: () => (state) => {
        if (state) syncAlarmsEnabledNative(state.alarmsEnabled);
      },
    }
  )
);

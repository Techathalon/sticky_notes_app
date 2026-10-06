import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IOSPickerModal } from '../components/IOSPickerModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationsStore } from '../store/notificationsStore';
import { useThemeColors } from '../store/themeStore';
import { useTodosStore } from '../store/todosStore';
import { useEventsStore } from '../store/eventsStore';

// ─── Helpers ──────────────────────────────────────────────────

function fmtOffset(hours: number, minutes: number): string {
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

// ─── Offset Input ─────────────────────────────────────────────

function OffsetInput({
  hours, minutes, onHoursChange, onMinutesChange, accentColor, c,
}: {
  hours: number;
  minutes: number;
  onHoursChange: (v: number) => void;
  onMinutesChange: (v: number) => void;
  accentColor: string;
  c: ReturnType<typeof useThemeColors>;
}) {
  // unit = 'hours' → the number stored as hours; unit = 'minutes' → stored as minutes
  const unit: 'hours' | 'minutes' = hours > 0 ? 'hours' : 'minutes';
  const displayValue = unit === 'hours' ? String(hours) : String(minutes);

  const [text, setText] = useState(displayValue);
  const [selectedUnit, setSelectedUnit] = useState<'hours' | 'minutes'>(unit);

  const commit = (rawText: string, rawUnit: 'hours' | 'minutes') => {
    let n = parseInt(rawText, 10);
    if (isNaN(n) || n < 0) n = 0;
    if (rawUnit === 'hours') {
      n = Math.min(23, n);
      if (n === 0) { n = 0; }
      onHoursChange(n);
      onMinutesChange(0);
    } else {
      n = Math.min(59, Math.max(1, n)); // minimum 1 minute
      onHoursChange(0);
      onMinutesChange(n);
    }
    setText(String(n));
  };

  const switchUnit = (newUnit: 'hours' | 'minutes') => {
    setSelectedUnit(newUnit);
    commit(text, newUnit);
  };

  return (
    <View style={s.offsetRow}>
      <TextInput
        style={[s.numInput, { backgroundColor: c.surface, borderColor: accentColor, color: c.text }]}
        value={text}
        onChangeText={(v) => { setText(v); }}
        onBlur={() => commit(text, selectedUnit)}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
      />
      {/* Unit selector */}
      <View style={[s.unitSelector, { borderColor: c.border, backgroundColor: c.surface }]}>
        {(['hours', 'minutes'] as const).map((u) => (
          <TouchableOpacity
            key={u}
            style={[
              s.unitOption,
              selectedUnit === u && { backgroundColor: accentColor },
            ]}
            onPress={() => switchUnit(u)}
          >
            <Text style={[
              s.unitText,
              { color: selectedUnit === u ? '#fff' : c.textMuted },
            ]}>
              {u === 'hours' ? 'Hour' : 'Min'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const router = useRouter();
  const { todos, updateTodo } = useTodosStore();
  const { events, updateEvent } = useEventsStore();

  const {
    taskReminderEnabled, setTaskReminderEnabled,
    taskReminderHours, setTaskReminderHours,
    taskReminderMinutes, setTaskReminderMinutes,
    eventReminderEnabled, setEventReminderEnabled,
    eventReminderHours, setEventReminderHours,
    eventReminderMinutes, setEventReminderMinutes,
    expenseSummaryEnabled, expenseSummaryHour, expenseSummaryMinute,
    budget80AlertEnabled, budget100AlertEnabled,
    loadExpenseSettings, saveExpenseSettings,
  } = useNotificationsStore();

  const [showTimePicker, setShowTimePicker] = useState(false);

  // Load expense settings from backend on mount
  useEffect(() => { loadExpenseSettings(); }, [loadExpenseSettings]);

  // Build a Date object from local hour/minute for the time picker
  const summaryDate = (() => {
    const d = new Date();
    d.setHours(expenseSummaryHour, expenseSummaryMinute, 0, 0);
    return d;
  })();

  const fmtTime = (h: number, m: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')} ${period}`;
  };

  // When going back, recompute reminderAt for all existing tasks/events
  // using the current settings so they don't miss their reminder window.
  const handleBack = () => {
    const taskOffsetMs = Math.max(60_000, (taskReminderHours * 60 + taskReminderMinutes) * 60_000);
    const eventOffsetMs = Math.max(60_000, (eventReminderHours * 60 + eventReminderMinutes) * 60_000);
    const now = new Date();

    todos.forEach((todo) => {
      if (!todo.dueDate || !todo.dueTime || todo.completed) return;
      const [h, m] = todo.dueTime.split(':').map(Number);
      const due = new Date(todo.dueDate);
      due.setHours(h, m, 0, 0);
      if (due <= now) return; // already past
      let reminderAt: string | null = null;
      if (taskReminderEnabled) {
        const rt = new Date(due.getTime() - taskOffsetMs);
        reminderAt = rt > now ? rt.toISOString() : new Date(now.getTime() + 60_000).toISOString();
      }
      updateTodo(todo.id, { reminderAt }).catch(() => {});
    });

    events.forEach((event) => {
      if (!event.startDate) return;
      const start = new Date(event.startDate);
      if (start <= now) return;
      let reminderAt: string | null = null;
      if (eventReminderEnabled) {
        const rt = new Date(start.getTime() - eventOffsetMs);
        reminderAt = rt > now ? rt.toISOString() : new Date(now.getTime() + 60_000).toISOString();
      }
      updateEvent(event.id, { reminderAt }).catch(() => {});
    });

    router.back();
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={handleBack} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>Notification Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Task Reminders ── */}
        <Text style={[s.sectionHeader, { color: c.textMuted }]}>Task Reminders</Text>
        <View style={[s.card, { backgroundColor: c.surface }]}>
          <View style={s.row}>
            <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="checkbox-outline" size={20} color="#3B82F6" />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowLabel, { color: c.text }]}>Task Reminders</Text>
              <Text style={[s.rowSub, { color: c.textMuted }]}>Notify before task is due</Text>
            </View>
            <Switch
              value={taskReminderEnabled}
              onValueChange={setTaskReminderEnabled}
              trackColor={{ false: c.border, true: '#3B82F6' }}
              thumbColor="#fff"
            />
          </View>

          {taskReminderEnabled && (
            <View style={[s.offsetSection, { borderTopColor: c.border }]}>
              <Text style={[s.offsetLabel, { color: c.textMuted }]}>Notify me before due time</Text>
              <OffsetInput
                hours={taskReminderHours}
                minutes={taskReminderMinutes}
                onHoursChange={setTaskReminderHours}
                onMinutesChange={setTaskReminderMinutes}
                accentColor="#3B82F6"
                c={c}
              />
              <Text style={[s.preview, { color: '#3B82F6' }]}>
                You&apos;ll be notified {fmtOffset(taskReminderHours, taskReminderMinutes)} before
              </Text>
            </View>
          )}
        </View>

        {/* ── Event Reminders ── */}
        <Text style={[s.sectionHeader, { color: c.textMuted }]}>Event Reminders</Text>
        <View style={[s.card, { backgroundColor: c.surface }]}>
          <View style={s.row}>
            <View style={[s.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="calendar-outline" size={20} color="#10B981" />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowLabel, { color: c.text }]}>Event Reminders</Text>
              <Text style={[s.rowSub, { color: c.textMuted }]}>Notify before event starts</Text>
            </View>
            <Switch
              value={eventReminderEnabled}
              onValueChange={setEventReminderEnabled}
              trackColor={{ false: c.border, true: '#10B981' }}
              thumbColor="#fff"
            />
          </View>

          {eventReminderEnabled && (
            <View style={[s.offsetSection, { borderTopColor: c.border }]}>
              <Text style={[s.offsetLabel, { color: c.textMuted }]}>Notify me before event starts</Text>
              <OffsetInput
                hours={eventReminderHours}
                minutes={eventReminderMinutes}
                onHoursChange={setEventReminderHours}
                onMinutesChange={setEventReminderMinutes}
                accentColor="#10B981"
                c={c}
              />
              <Text style={[s.preview, { color: '#10B981' }]}>
                You&apos;ll be notified {fmtOffset(eventReminderHours, eventReminderMinutes)} before
              </Text>
            </View>
          )}
        </View>

        {/* ── Expense Notifications ── */}
        <Text style={[s.sectionHeader, { color: c.textMuted }]}>Expense Notifications</Text>

        {/* Daily Summary */}
        <View style={[s.card, { backgroundColor: c.surface }]}>
          <View style={s.row}>
            <View style={[s.iconBox, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="receipt-outline" size={20} color="#D97706" />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowLabel, { color: c.text }]}>Daily Expense Summary</Text>
              <Text style={[s.rowSub, { color: c.textMuted }]}>Get a daily recap of your spending</Text>
            </View>
            <Switch
              value={expenseSummaryEnabled}
              onValueChange={(v) => saveExpenseSettings({ expenseSummaryEnabled: v })}
              trackColor={{ false: c.border, true: '#D97706' }}
              thumbColor="#fff"
            />
          </View>

          {expenseSummaryEnabled && (
            <View style={[s.offsetSection, { borderTopColor: c.border }]}>
              <Text style={[s.offsetLabel, { color: c.textMuted }]}>Send summary at</Text>
              <TouchableOpacity
                style={[s.timePill, { borderColor: '#D97706', backgroundColor: '#FFFBEB' }]}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="time-outline" size={16} color="#D97706" />
                <Text style={[s.timePillText, { color: '#D97706' }]}>
                  {fmtTime(expenseSummaryHour, expenseSummaryMinute)}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#D97706" />
              </TouchableOpacity>
              <Text style={[s.preview, { color: '#D97706' }]}>
                You&apos;ll receive a daily summary at {fmtTime(expenseSummaryHour, expenseSummaryMinute)}
              </Text>
            </View>
          )}
        </View>

        {/* Budget Alerts */}
        <View style={[s.card, { backgroundColor: c.surface, marginTop: 12 }]}>
          {/* 80% alert */}
          <View style={s.row}>
            <View style={[s.iconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="warning-outline" size={20} color="#F59E0B" />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowLabel, { color: c.text }]}>80% Budget Alert</Text>
              <Text style={[s.rowSub, { color: c.textMuted }]}>Notify when spending hits 80% of budget</Text>
            </View>
            <Switch
              value={budget80AlertEnabled}
              onValueChange={(v) => saveExpenseSettings({ budget80AlertEnabled: v })}
              trackColor={{ false: c.border, true: '#F59E0B' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[s.divider, { backgroundColor: c.border }]} />

          {/* 100% alert */}
          <View style={s.row}>
            <View style={[s.iconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowLabel, { color: c.text }]}>Budget Exceeded Alert</Text>
              <Text style={[s.rowSub, { color: c.textMuted }]}>Notify when you exceed your budget</Text>
            </View>
            <Switch
              value={budget100AlertEnabled}
              onValueChange={(v) => saveExpenseSettings({ budget100AlertEnabled: v })}
              trackColor={{ false: c.border, true: '#EF4444' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {Platform.OS === 'ios' ? (
          <IOSPickerModal
            visible={showTimePicker}
            value={summaryDate}
            mode="time"
            onCancel={() => setShowTimePicker(false)}
            onDone={(d) => {
              setShowTimePicker(false);
              saveExpenseSettings({
                expenseSummaryHour: d.getHours(),
                expenseSummaryMinute: d.getMinutes(),
              });
            }}
          />
        ) : showTimePicker && (
          <DateTimePicker
            value={summaryDate}
            mode="time"
            display="default"
            onChange={(_, d) => {
              setShowTimePicker(false);
              if (d) {
                saveExpenseSettings({
                  expenseSummaryHour: d.getHours(),
                  expenseSummaryMinute: d.getMinutes(),
                });
              }
            }}
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, gap: 12,
  },
  headerBtn: { padding: 4, width: 38, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },

  scroll: { paddingBottom: 40 },

  sectionHeader: {
    fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginHorizontal: 20, marginTop: 24, marginBottom: 8,
  },

  card: {
    marginHorizontal: 16, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  iconBox: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },

  offsetSection: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16,
    borderTopWidth: 1, gap: 10,
  },
  offsetLabel: { fontSize: 13, fontWeight: '500' },

  offsetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  numInput: {
    width: 72, height: 52, borderRadius: 12, borderWidth: 2,
    textAlign: 'center', fontSize: 24, fontWeight: '700',
  },

  unitSelector: {
    flexDirection: 'row', borderRadius: 12, borderWidth: 1.5,
    overflow: 'hidden',
  },
  unitOption: {
    paddingHorizontal: 18, paddingVertical: 14,
  },
  unitText: { fontSize: 14, fontWeight: '600' },

  preview: { fontSize: 13, fontWeight: '600', marginTop: 2 },

  timePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  timePillText: { fontSize: 15, fontWeight: '700' },

  divider: { height: 1, marginHorizontal: 16 },
});

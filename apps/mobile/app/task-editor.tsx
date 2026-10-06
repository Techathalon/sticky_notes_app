import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useAppAlert } from '../components/AppAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IOSPickerModal } from '../components/IOSPickerModal';
import { useTodosStore } from '../store/todosStore';
import { scheduleLocalAlarm, cancelLocalAlarm, checkAllAlarmPermissions } from '../utils/alarmManager';
import { useThemeColors } from '../store/themeStore';
import { useHomeStore } from '../store/homeStore';
import { useNotificationsStore } from '../store/notificationsStore';
import type { TodoStatus, TodoPriority } from '@repo/types';

// ─── Config ───────────────────────────────────────────────────

const PRIORITY_META: Record<TodoPriority, { label: string; color: string; bg: string; icon: string }> = {
  HIGH:   { label: 'High',   color: '#EF4444', bg: '#FEF2F2', icon: 'arrow-up-circle' },
  MEDIUM: { label: 'Medium', color: '#F59E0B', bg: '#FFFBEB', icon: 'remove-circle'   },
  LOW:    { label: 'Low',    color: '#22C55E', bg: '#F0FDF4', icon: 'arrow-down-circle' },
};

const STATUS_META: Record<TodoStatus, { label: string; color: string; bg: string }> = {
  TODO:        { label: 'To Do',       color: '#94A3B8', bg: '#F8FAFC' },
  IN_PROGRESS: { label: 'In Progress', color: '#3B82F6', bg: '#EFF6FF' },
  COMPLETED:   { label: 'Completed',   color: '#22C55E', bg: '#F0FDF4' },
};

// ─── Helpers ──────────────────────────────────────────────────

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtTime(h: number, m: number) {
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
}
function parseTime(t: string | null): { h: number; m: number } | null {
  if (!t) return null;
  const [hStr, mStr] = t.split(':');
  return { h: parseInt(hStr, 10), m: parseInt(mStr, 10) };
}

// ─── Screen ───────────────────────────────────────────────────

export default function TaskEditorScreen() {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const { showAlert, AlertModal } = useAppAlert();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router  = useRouter();
  const { todos, createTodo, updateTodo } = useTodosStore();
  const setHomeSegment = useHomeStore((s) => s.setHomeSegment);
  const { alarmsEnabled, taskReminderEnabled, taskReminderHours, taskReminderMinutes } = useNotificationsStore();
  const existing = id ? todos.find((t) => t.id === id) ?? null : null;
  const isNew    = !existing;

  // ── Form state ────────────────────────────────────────────────
  const [title,       setTitle]       = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [status,      setStatus]      = useState<TodoStatus>(existing?.status ?? 'TODO');
  const [priority,    setPriority]    = useState<TodoPriority>(existing?.priority ?? 'MEDIUM');

  const initDueDate = (): Date => {
    if (existing?.dueDate) return new Date(existing.dueDate);
    return new Date(); // today by default
  };
  const [dueDate, setDueDate] = useState<Date>(initDueDate);

  const initDueTime = (): { h: number; m: number } | null => {
    return parseTime(existing?.dueTime ?? null);
  };
  const [dueTime, setDueTime] = useState<{ h: number; m: number } | null>(initDueTime);
  const [alarmEnabled, setAlarmEnabled] = useState(!!existing?.alarmAt);

  const handleAlarmToggle = (value: boolean) => {
    setAlarmEnabled(value);
    if (value) checkAllAlarmPermissions();
  };

  const isDuePast = !!dueTime && (() => {
    const d = new Date(dueDate);
    d.setHours(dueTime.h, dueTime.m, 0, 0);
    return d < new Date();
  })();

  // ── Picker visibility ─────────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // ── Loading ───────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  // ── Dirty check (edit mode only) ──────────────────────────────
  const isDirty = isNew || (
    title !== (existing?.title ?? '') ||
    description !== (existing?.description ?? '') ||
    status !== existing?.status ||
    priority !== existing?.priority ||
    dueDate.toLocaleDateString('en-CA') !== (existing?.dueDate ? new Date(existing.dueDate).toLocaleDateString('en-CA') : new Date().toLocaleDateString('en-CA')) ||
    JSON.stringify(dueTime) !== JSON.stringify(parseTime(existing?.dueTime ?? null)) ||
    alarmEnabled !== !!existing?.alarmAt
  );

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const t = title.trim();
    if (!t) { showAlert({ type: 'error', title: 'Title Required', message: 'Please enter a task title before saving.' }); return; }

    setSaving(true);
    try {
      const dueDateISO  = dueDate.toISOString();
      const dueTimeStr  = dueTime ? `${String(dueTime.h).padStart(2,'0')}:${String(dueTime.m).padStart(2,'0')}` : undefined;

      // Compute reminderAt for backend push notification
      let reminderAt: string | null = null;
      if (dueTime && taskReminderEnabled) {
        const dueDateTime = new Date(dueDate);
        dueDateTime.setHours(dueTime.h, dueTime.m, 0, 0);
        const offsetMs = (taskReminderHours * 60 + taskReminderMinutes) * 60_000;
        if (offsetMs > 0) {
          const rt = new Date(dueDateTime.getTime() - offsetMs);
          if (rt > new Date()) reminderAt = rt.toISOString();
        }
      }

      // Compute startAt — client-side so timezone is always correct
      let startAt: string | null = null;
      if (dueTime) {
        const sd = new Date(dueDate);
        sd.setHours(dueTime.h, dueTime.m, 0, 0);
        startAt = sd.toISOString();
      }

      // Compute alarmAt for backend alarm push (exact due time)
      let alarmAt: string | null = null;
      if (alarmEnabled && dueTime) {
        let alarmDate = new Date(dueDate);
        alarmDate.setHours(dueTime.h, dueTime.m, 0, 0);
        if (alarmDate <= new Date() && alarmDate.getTime() > Date.now() - 60_000) {
          alarmDate = new Date(Date.now() + 5_000);
        }
        if (alarmDate > new Date()) alarmAt = alarmDate.toISOString();
      }

      if (isNew) {
        const saved = await createTodo({
          title: t,
          description: description.trim() || undefined,
          status, priority,
          dueDate: dueDateISO,
          dueTime: dueTimeStr,
          startAt,
          reminderAt,
          alarmAt,
        });
        // Schedule local alarm on this device immediately (backend FCM covers other devices)
        if (alarmAt) scheduleLocalAlarm(saved.id, t, new Date(alarmAt), 'task').catch(() => {});
      } else if (existing) {
        await updateTodo(existing.id, {
          title: t,
          description: description.trim() || undefined,
          status, priority,
          dueDate: dueDateISO,
          dueTime: dueTimeStr ?? null,
          startAt,
          reminderAt,
          alarmAt,
        });
        // Cancel old local alarm then reschedule if alarm is still set
        cancelLocalAlarm(existing.id).catch(() => {});
        if (alarmAt) scheduleLocalAlarm(existing.id, t, new Date(alarmAt), 'task').catch(() => {});
      }
      setHomeSegment('tasks');
      router.replace('/(tabs)/home');
    } catch {
      showAlert({ type: 'info', title: 'Something Went Wrong', message: 'Unable to save the task. Please try again.' });
    } finally {
      setSaving(false);
    }
  }, [title, description, status, priority, dueDate, dueTime, alarmEnabled, existing, isNew, setHomeSegment, taskReminderEnabled, taskReminderHours, taskReminderMinutes]);

  // ── Time picker date helper ────────────────────────────────────
  const timePickerDate = (() => {
    const d = new Date();
    if (dueTime) { d.setHours(dueTime.h, dueTime.m, 0, 0); }
    return d;
  })();

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>{isNew ? 'New Task' : 'Edit Task'}</Text>
        <TouchableOpacity
          style={[s.saveBtn, (!isDirty || saving) && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={saving || !isDirty}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title ── */}
        <TextInput
          style={[s.titleInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Task title"
          placeholderTextColor="#94A3B8"
          maxLength={50}
          autoFocus={isNew}
        />
        <Text style={[s.charCount, { color: title.length >= 40 ? '#EF4444' : c.textMuted }]}>
          {title.length}/50
        </Text>

        {/* ── Description ── */}
        <TextInput
          style={[s.descInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Description (optional)"
          placeholderTextColor="#CBD5E1"
          multiline
          textAlignVertical="top"
          maxLength={1000}
        />
        <Text style={[s.charCount, { color: description.length >= 990 ? '#EF4444' : c.textMuted }]}>
          {description.length}/1000
        </Text>

        {/* ── Priority ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Priority</Text>
          <View style={s.chipRow}>
            {(['HIGH', 'MEDIUM', 'LOW'] as TodoPriority[]).map((p) => {
              const m = PRIORITY_META[p];
              const active = priority === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[s.chip, { backgroundColor: c.surface, borderColor: c.border },
                    active && { backgroundColor: m.color + '22', borderColor: m.color, borderWidth: 2 }]}
                  onPress={() => setPriority(p)}
                >
                  <Ionicons
                    name={m.icon as React.ComponentProps<typeof Ionicons>['name']}
                    size={14}
                    color={m.color}
                  />
                  <Text style={[s.chipText, { color: m.color }, active && { fontWeight: '700' }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Status ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Status</Text>
          <View style={s.chipRow}>
            {(['TODO', 'IN_PROGRESS', 'COMPLETED'] as TodoStatus[]).map((st) => {
              const m = STATUS_META[st];
              const active = status === st;
              return (
                <TouchableOpacity
                  key={st}
                  style={[s.chip, { backgroundColor: c.surface, borderColor: c.border },
                    active && { backgroundColor: m.color + '22', borderColor: m.color, borderWidth: 2 }]}
                  onPress={() => setStatus(st)}
                >
                  <View style={[s.statusDot, { backgroundColor: m.color }]} />
                  <Text style={[s.chipText, { color: m.color }, active && { fontWeight: '700' }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={s.divider} />

        {/* ── Due Date ── */}
        <TouchableOpacity style={[s.fieldRow, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => setShowDatePicker(true)}>
          <View style={s.fieldLeft}>
            <View style={[s.fieldIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="calendar-outline" size={18} color="#3B82F6" />
            </View>
            <Text style={[s.fieldLabel, { color: c.text }]}>Due Date</Text>
          </View>
          <View style={s.fieldRight}>
            <Text style={s.fieldValue}>{fmtDate(dueDate)}</Text>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </View>
        </TouchableOpacity>

        {Platform.OS === 'ios' ? (
          <IOSPickerModal
            visible={showDatePicker}
            value={dueDate}
            mode="date"
            onCancel={() => setShowDatePicker(false)}
            onDone={(d) => {
              setShowDatePicker(false);
              if (d) {
                if (dueTime) {
                  const newDate = new Date(d);
                  newDate.setHours(dueTime.h, dueTime.m, 0, 0);
                  if (newDate < new Date()) {
                    const now = new Date();
                    now.setMinutes(now.getMinutes() + 5);
                    setDueTime({ h: now.getHours(), m: now.getMinutes() });
                    setAlarmEnabled(false);
                  }
                }
                setDueDate(d);
              }
            }}
          />
        ) : showDatePicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="default"
            onChange={(_, d) => {
              setShowDatePicker(false);
              if (d) {
                if (dueTime) {
                  const newDate = new Date(d);
                  newDate.setHours(dueTime.h, dueTime.m, 0, 0);
                  if (newDate < new Date()) {
                    const now = new Date();
                    now.setMinutes(now.getMinutes() + 5);
                    setDueTime({ h: now.getHours(), m: now.getMinutes() });
                    setAlarmEnabled(false);
                  }
                }
                setDueDate(d);
              }
            }}
          />
        )}

        {/* ── Due Time ── */}
        <TouchableOpacity
          style={[s.fieldRow, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => setShowTimePicker(true)}
        >
          <View style={s.fieldLeft}>
            <View style={[s.fieldIcon, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="time-outline" size={18} color="#F59E0B" />
            </View>
            <Text style={[s.fieldLabel, { color: c.text }]}>Due Time</Text>
          </View>
          <View style={s.fieldRight}>
            {dueTime ? (
              <>
                <Text style={s.fieldValue}>{fmtTime(dueTime.h, dueTime.m)}</Text>
                <TouchableOpacity
                  onPress={() => { setDueTime(null); setAlarmEnabled(false); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.fieldPlaceholder}>Optional</Text>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </>
            )}
          </View>
        </TouchableOpacity>

        {Platform.OS === 'ios' ? (
          <IOSPickerModal
            visible={showTimePicker}
            value={timePickerDate}
            mode="time"
            onCancel={() => setShowTimePicker(false)}
            onDone={(d) => {
              setShowTimePicker(false);
              if (d) setDueTime({ h: d.getHours(), m: d.getMinutes() });
            }}
          />
        ) : showTimePicker && (
          <DateTimePicker
            value={timePickerDate}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={(_, d) => {
              setShowTimePicker(false);
              if (d) setDueTime({ h: d.getHours(), m: d.getMinutes() });
            }}
          />
        )}


        {/* ── Alarm toggle ── */}
        {dueTime && alarmsEnabled && (
          <View style={[s.fieldRow, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={s.fieldLeft}>
              <View style={[s.fieldIcon, { backgroundColor: '#FFF1F2' }]}>
                <Ionicons name="notifications-outline" size={18} color="#E11D48" />
              </View>
              <View>
                <Text style={[s.fieldLabel, { color: c.text }]}>Set Alarm</Text>
                <Text style={s.fieldSub}>
                  {isDuePast ? 'Cannot set alarm for past due date' : `Notify at ${fmtTime(dueTime.h, dueTime.m)}`}
                </Text>
              </View>
            </View>
            <Switch
              value={alarmEnabled && !isDuePast}
              onValueChange={isDuePast ? undefined : handleAlarmToggle}
              disabled={isDuePast}
              trackColor={{ false: '#E2E8F0', true: isDuePast ? '#E2E8F0' : '#FCA5A5' }}
              thumbColor={alarmEnabled && !isDuePast ? '#E11D48' : '#fff'}
            />
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      {AlertModal}
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },

  /* header */
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  headerBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1E293B' },
  saveBtn: {
    backgroundColor: '#0EA5E9', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  /* scroll */
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 4 },

  /* inputs */
  titleInput: {
    fontSize: 22, fontWeight: '700', color: '#1E293B',
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1.5, borderColor: '#F1F5F9',
  },
  descInput: {
    fontSize: 15, color: '#475569',
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    minHeight: 88, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#F1F5F9',
  },

  /* section */
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 10, marginLeft: 4,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, backgroundColor: '#F8FAFC',
    borderWidth: 1.5, borderColor: '#E2E8F0',
    flex: 1, justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },

  /* divider */
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },

  /* field rows */
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 8,
    borderWidth: 1.5, borderColor: '#F1F5F9',
  },
  fieldLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  fieldSub: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  fieldValue: { fontSize: 14, fontWeight: '600', color: '#0EA5E9' },
  fieldPlaceholder: { fontSize: 14, color: '#CBD5E1' },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 2, marginBottom: 4, paddingHorizontal: 4 },
});

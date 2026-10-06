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
import { useEventsStore } from '../store/eventsStore';
import { useCalendarStore } from '../store/calendarStore';
import { scheduleLocalAlarm, cancelLocalAlarm, checkAllAlarmPermissions } from '../utils/alarmManager';
import { useThemeColors } from '../store/themeStore';
import { useNotificationsStore } from '../store/notificationsStore';

// ─── Config ───────────────────────────────────────────────────

const EVENT_COLORS = ['#99CCFF', '#FFB347', '#99FF99', '#FF9999', '#DDA0DD', '#FFFF88'];

const EVENT_CATS_META: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string }[] = [
  { label: 'Meeting',  icon: 'people-outline',                     color: '#3B82F6', bg: '#EFF6FF' },
  { label: 'Work',     icon: 'briefcase-outline',                  color: '#10B981', bg: '#ECFDF5' },
  { label: 'Personal', icon: 'home-outline',                       color: '#8B5CF6', bg: '#F5F3FF' },
  { label: 'Health',   icon: 'fitness-outline',                    color: '#EC4899', bg: '#FDF2F8' },
  { label: 'Social',   icon: 'happy-outline',                      color: '#F59E0B', bg: '#FFFBEB' },
  { label: 'Travel',   icon: 'airplane-outline',                   color: '#06B6D4', bg: '#ECFEFF' },
  { label: 'Other',    icon: 'ellipsis-horizontal-circle-outline', color: '#64748B', bg: '#F8FAFC' },
];

// ─── Helpers ──────────────────────────────────────────────────

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ─── Screen ───────────────────────────────────────────────────

export default function EventEditorScreen() {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const { showAlert, AlertModal } = useAppAlert();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { events, createEvent, updateEvent } = useEventsStore();
const setJumpDate = useCalendarStore((s) => s.setJumpDate);
const { alarmsEnabled, eventReminderEnabled, eventReminderHours, eventReminderMinutes } = useNotificationsStore();

const existing = id ? events.find((e) => e.id === id) ?? null : null;
const isNew = !existing;

// ── Form state ────────────────────────────────────────────────
const [title,       setTitle]       = useState(existing?.title ?? '');
const [description, setDescription] = useState(existing?.description ?? '');
const [location,    setLocation]    = useState(existing?.location ?? '');
const [color,       setColor]       = useState(existing?.color ?? EVENT_COLORS[0]);
const [category,    setCategory]    = useState(existing?.category ?? 'Other');

const initStart = () => existing ? new Date(existing.startDate) : new Date();
const initEnd   = () => {
  if (existing) return new Date(existing.endDate);
  const d = new Date(); d.setHours(d.getHours() + 1); return d;
};
const [startDate, setStartDate] = useState<Date>(initStart);
const [endDate,   setEndDate]   = useState<Date>(initEnd);
const [alarmEnabled, setAlarmEnabled] = useState(!!existing?.alarmAt);

const handleAlarmToggle = (value: boolean) => {
  setAlarmEnabled(value);
  if (value) checkAllAlarmPermissions();
};

const isPast = startDate < new Date();

// ── Picker visibility ─────────────────────────────────────────
const [showStartDate, setShowStartDate] = useState(false);
const [showStartTime, setShowStartTime] = useState(false);
const [showEndDate,   setShowEndDate]   = useState(false);
const [showEndTime,   setShowEndTime]   = useState(false);

  const [saving, setSaving] = useState(false);

  // ── Dirty check (edit mode only) ──────────────────────────────
  const isDirty = isNew || (
    title !== (existing?.title ?? '') ||
    description !== (existing?.description ?? '') ||
    location !== (existing?.location ?? '') ||
    color !== existing?.color ||
    category !== existing?.category ||
    startDate.getTime() !== new Date(existing?.startDate ?? 0).getTime() ||
    endDate.getTime() !== new Date(existing?.endDate ?? 0).getTime() ||
    alarmEnabled !== !!existing?.alarmAt
  );

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const t = title.trim();
    if (!t) { showAlert({ type: 'error', title: 'Title Required', message: 'Please enter an event title before saving.' }); return; }
    if (endDate <= startDate) { showAlert({ type: 'warning', title: 'Invalid Time Range', message: 'The end time must be after the start time.' }); return; }

    setSaving(true);
    try {
      // Compute reminderAt for backend push notification
      let reminderAt: string | null = null;
      if (eventReminderEnabled) {
        const offsetMs = (eventReminderHours * 60 + eventReminderMinutes) * 60_000;
        if (offsetMs > 0) {
          const rt = new Date(startDate.getTime() - offsetMs);
          if (rt > new Date()) reminderAt = rt.toISOString();
        }
      }

      // Compute alarmAt — zero seconds/ms so alarm fires at exactly HH:mm:00
      let alarmDate = new Date(startDate);
      alarmDate.setSeconds(0, 0);
      if (alarmDate <= new Date() && alarmDate.getTime() > Date.now() - 60_000) {
        alarmDate = new Date(Date.now() + 5_000);
      }
      const alarmAt: string | null = (alarmEnabled && alarmDate > new Date())
        ? alarmDate.toISOString()
        : null;

      if (isNew) {
        const saved = await createEvent({
          title: t,
          description: description.trim() || undefined,
          location: location.trim() || null,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          color,
          category,
          reminderAt,
          alarmAt,
        });
        // Schedule local alarm on this device immediately (backend FCM covers other devices)
        if (alarmAt) scheduleLocalAlarm(saved.id, t, new Date(alarmAt), 'event').catch(() => {});
      } else if (existing) {
        await updateEvent(existing.id, {
          title: t,
          description: description.trim() || undefined,
          location: location.trim() || null,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          color,
          category,
          reminderAt,
          alarmAt,
        });
        // Cancel old local alarm then reschedule if alarm is still set
        cancelLocalAlarm(existing.id).catch(() => {});
        if (alarmAt) scheduleLocalAlarm(existing.id, t, new Date(alarmAt), 'event').catch(() => {});
      }
      setJumpDate(startDate.toLocaleDateString('en-CA'));
      router.replace('/(tabs)/calendar');
    } catch {
      showAlert({ type: 'info', title: 'Something Went Wrong', message: 'Unable to save the event. Please try again.' });
    } finally {
      setSaving(false);
    }
  }, [title, description, location, color, category, startDate, endDate, alarmEnabled, existing, isNew, eventReminderEnabled, eventReminderHours, eventReminderMinutes, setJumpDate]);

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>{isNew ? 'New Event' : 'Edit Event'}</Text>
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
          placeholder="Event title"
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

        {/* ── Location ── */}
        <View style={[s.locationRow, { backgroundColor: c.surface, borderColor: location.length >= 90 ? '#EF4444' : c.border }]}>
          <Ionicons name="location-outline" size={18} color={location.length >= 90 ? '#EF4444' : '#94A3B8'} style={s.locationIcon} />
          <TextInput
            style={[s.locationInput, { color: c.text }]}
            value={location}
            onChangeText={setLocation}
            placeholder="Location (optional)"
            placeholderTextColor="#CBD5E1"
            maxLength={100}
            returnKeyType="done"
          />
        </View>
        <Text style={[s.charCount, { color: location.length >= 90 ? '#EF4444' : c.textMuted }]}>
          {location.length}/100
        </Text>

        {/* ── Category ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Category</Text>
          <View style={s.catGrid}>
            {EVENT_CATS_META.map((cat) => {
              const active = category === cat.label;
              return (
                <TouchableOpacity
                  key={cat.label}
                  style={[s.catChip, { backgroundColor: c.surface, borderColor: c.border },
                    active && { backgroundColor: cat.color + '22', borderColor: cat.color, borderWidth: 2 }]}
                  onPress={() => setCategory(cat.label)}
                >
                  <Ionicons name={cat.icon} size={16} color={cat.color} />
                  <Text style={[s.catText, { color: cat.color }, active && { fontWeight: '700' }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Color ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Color</Text>
          <View style={s.colorRow}>
            {EVENT_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[s.colorDot, { backgroundColor: c }, color === c && s.colorDotActive]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Start Date ── */}
        <TouchableOpacity style={[s.fieldRow, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => setShowStartDate(true)}>
          <View style={s.fieldLeft}>
            <View style={[s.fieldIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="calendar-outline" size={18} color="#3B82F6" />
            </View>
            <Text style={[s.fieldLabel, { color: c.text }]}>Start Date</Text>
          </View>
          <View style={s.fieldRight}>
            <Text style={s.fieldValue}>{fmtDate(startDate)}</Text>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </View>
        </TouchableOpacity>
        {Platform.OS === 'ios' ? (
          <IOSPickerModal
            visible={showStartDate}
            value={startDate}
            mode="date"
            onCancel={() => setShowStartDate(false)}
            onDone={(d) => {
              setShowStartDate(false);
              if (d) {
                const newStart = new Date(d);
                newStart.setHours(startDate.getHours(), startDate.getMinutes());
                if (newStart < new Date()) {
                  const now = new Date();
                  now.setMinutes(now.getMinutes() + 5);
                  newStart.setHours(now.getHours(), now.getMinutes());
                }
                setStartDate(newStart);
                if (endDate <= newStart) {
                  const newEnd = new Date(newStart);
                  newEnd.setHours(newStart.getHours() + 1, newStart.getMinutes());
                  setEndDate(newEnd);
                }
              }
            }}
          />
        ) : showStartDate && (
          <DateTimePicker value={startDate} mode="date" display="default"
            onChange={(_, d) => {
              setShowStartDate(false);
              if (d) {
                const newStart = new Date(d);
                newStart.setHours(startDate.getHours(), startDate.getMinutes());
                if (newStart < new Date()) {
                  const now = new Date();
                  now.setMinutes(now.getMinutes() + 5);
                  newStart.setHours(now.getHours(), now.getMinutes());
                }
                setStartDate(newStart);
                if (endDate <= newStart) {
                  const newEnd = new Date(newStart);
                  newEnd.setHours(newStart.getHours() + 1, newStart.getMinutes());
                  setEndDate(newEnd);
                }
              }
            }} />
        )}

        {/* ── Start Time ── */}
        <TouchableOpacity style={[s.fieldRow, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => setShowStartTime(true)}>
          <View style={s.fieldLeft}>
            <View style={[s.fieldIcon, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="time-outline" size={18} color="#F59E0B" />
            </View>
            <Text style={[s.fieldLabel, { color: c.text }]}>Start Time</Text>
          </View>
          <View style={s.fieldRight}>
            <Text style={s.fieldValue}>{fmtTime(startDate)}</Text>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </View>
        </TouchableOpacity>
        {Platform.OS === 'ios' ? (
          <IOSPickerModal
            visible={showStartTime}
            value={startDate}
            mode="time"
            onCancel={() => setShowStartTime(false)}
            onDone={(d) => {
              setShowStartTime(false);
              if (d) {
                const newStart = new Date(startDate);
                newStart.setHours(d.getHours(), d.getMinutes());
                setStartDate(newStart);
                if (newStart < new Date()) setAlarmEnabled(false);
                if (endDate <= newStart) {
                  const newEnd = new Date(newStart);
                  newEnd.setMinutes(newStart.getMinutes() + 30);
                  setEndDate(newEnd);
                }
              }
            }}
          />
        ) : showStartTime && (
          <DateTimePicker value={startDate} mode="time" is24Hour={false} display="default"
            onChange={(_, d) => {
              setShowStartTime(false);
              if (d) {
                const newStart = new Date(startDate);
                newStart.setHours(d.getHours(), d.getMinutes());
                setStartDate(newStart);
                if (newStart < new Date()) setAlarmEnabled(false);
                if (endDate <= newStart) {
                  const newEnd = new Date(newStart);
                  newEnd.setMinutes(newStart.getMinutes() + 30);
                  setEndDate(newEnd);
                }
              }
            }} />
        )}

        {/* ── End Date ── */}
        <TouchableOpacity style={[s.fieldRow, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => setShowEndDate(true)}>
          <View style={s.fieldLeft}>
            <View style={[s.fieldIcon, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="calendar-outline" size={18} color="#22C55E" />
            </View>
            <Text style={[s.fieldLabel, { color: c.text }]}>End Date</Text>
          </View>
          <View style={s.fieldRight}>
            <Text style={s.fieldValue}>{fmtDate(endDate)}</Text>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </View>
        </TouchableOpacity>
        {Platform.OS === 'ios' ? (
          <IOSPickerModal
            visible={showEndDate}
            value={endDate}
            mode="date"
            minimumDate={startDate}
            onCancel={() => setShowEndDate(false)}
            onDone={(d) => {
              setShowEndDate(false);
              if (d) {
                const n = new Date(d);
                n.setHours(endDate.getHours(), endDate.getMinutes());
                if (n <= startDate) {
                  const bumped = new Date(startDate);
                  bumped.setHours(startDate.getHours() + 1, startDate.getMinutes());
                  setEndDate(bumped);
                } else {
                  setEndDate(n);
                }
              }
            }}
          />
        ) : showEndDate && (
          <DateTimePicker value={endDate} mode="date" minimumDate={startDate} display="default"
            onChange={(_, d) => {
              setShowEndDate(false);
              if (d) {
                const n = new Date(d);
                n.setHours(endDate.getHours(), endDate.getMinutes());
                if (n <= startDate) {
                  const bumped = new Date(startDate);
                  bumped.setHours(startDate.getHours() + 1, startDate.getMinutes());
                  setEndDate(bumped);
                } else {
                  setEndDate(n);
                }
              }
            }} />
        )}

        {/* ── End Time ── */}
        <TouchableOpacity style={[s.fieldRow, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => setShowEndTime(true)}>
          <View style={s.fieldLeft}>
            <View style={[s.fieldIcon, { backgroundColor: '#FFF1F2' }]}>
              <Ionicons name="time-outline" size={18} color="#E11D48" />
            </View>
            <Text style={[s.fieldLabel, { color: c.text }]}>End Time</Text>
          </View>
          <View style={s.fieldRight}>
            <Text style={s.fieldValue}>{fmtTime(endDate)}</Text>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </View>
        </TouchableOpacity>
        {Platform.OS === 'ios' ? (
          <IOSPickerModal
            visible={showEndTime}
            value={endDate}
            mode="time"
            minimumDate={isSameDay(startDate, endDate) ? startDate : undefined}
            onCancel={() => setShowEndTime(false)}
            onDone={(d) => {
              setShowEndTime(false);
              if (d) {
                const n = new Date(endDate);
                n.setHours(d.getHours(), d.getMinutes());
                if (n <= startDate) {
                  const bumped = new Date(startDate);
                  bumped.setMinutes(startDate.getMinutes() + 30);
                  setEndDate(bumped);
                } else {
                  setEndDate(n);
                }
              }
            }}
          />
        ) : showEndTime && (
          <DateTimePicker value={endDate} mode="time" is24Hour={false}
            minimumDate={isSameDay(startDate, endDate) ? startDate : undefined}
            display="default"
            onChange={(_, d) => {
              setShowEndTime(false);
              if (d) {
                const n = new Date(endDate);
                n.setHours(d.getHours(), d.getMinutes());
                if (n <= startDate) {
                  const bumped = new Date(startDate);
                  bumped.setMinutes(startDate.getMinutes() + 30);
                  setEndDate(bumped);
                } else {
                  setEndDate(n);
                }
              }
            }} />
        )}

        {/* ── Alarm toggle ── */}
        {alarmsEnabled && (
          <View style={[s.fieldRow, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={s.fieldLeft}>
              <View style={[s.fieldIcon, { backgroundColor: '#FFF1F2' }]}>
                <Ionicons name="notifications-outline" size={18} color="#E11D48" />
              </View>
              <View>
                <Text style={[s.fieldLabel, { color: c.text }]}>Set Alarm</Text>
                <Text style={s.fieldSub}>
                  {isPast ? 'Cannot set alarm for past events' : `Notify at ${fmtTime(startDate)}`}
                </Text>
              </View>
            </View>
            <Switch
              value={alarmEnabled && !isPast}
              onValueChange={isPast ? undefined : handleAlarmToggle}
              disabled={isPast}
              trackColor={{ false: '#E2E8F0', true: isPast ? '#E2E8F0' : '#FCA5A5' }}
              thumbColor={alarmEnabled && !isPast ? '#E11D48' : '#fff'}
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

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 4 },

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

  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 10, marginLeft: 4,
  },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#F8FAFC',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  catText: { fontSize: 13, fontWeight: '600', color: '#64748B' },

  colorRow: { flexDirection: 'row', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: '#1E293B' },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },

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
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 2, marginBottom: 4, paddingHorizontal: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  locationIcon: { marginRight: 8 },
  locationInput: { flex: 1, fontSize: 15 },
});

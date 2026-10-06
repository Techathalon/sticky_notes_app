import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, Share, StyleSheet, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IOSPickerModal } from '../IOSPickerModal';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEventsStore } from '../../store/eventsStore';
import { useAppAlert } from '../AppAlert';
import { EmptyState } from '../EmptyState';
import { COLORS } from '../../constants/colors';
import { useThemeColors } from '../../store/themeStore';
import { formatDateRange } from '../../utils/dateUtils';
import { seg } from './segStyles';
import { useNotificationsStore } from '@/store/notificationsStore';

function getEventStatus(start: string, end: string, now: Date) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const n = now.getTime();

  if (n >= s && n <= e) {
    const progress = (n - s) / (e - s);
    return { state: 'ongoing' as const, chip: '● LIVE', chipColor: '#10B981', progress };
  }
  const diffMs = s - n;
  if (diffMs > 0) {
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    let chip: string;
    if (diffMins < 60)       chip = `in ${diffMins}m`;
    else if (diffHours < 24) chip = `in ${diffHours}h ${diffMins % 60}m`;
    else if (diffDays === 1) chip = 'Tomorrow';
    else                     chip = `in ${diffDays} days`;
    return { state: 'future' as const, chip, chipColor: '#3B82F6', progress: 0 };
  }
  // Compare calendar dates (midnight-normalized) so an event ending at 11 PM yesterday
  // shows "Yesterday", not "Ended today" (which raw ms math would produce if <24h ago).
  const endDay = new Date(e); endDay.setHours(0, 0, 0, 0);
  const nowDay = new Date(n); nowDay.setHours(0, 0, 0, 0);
  const pastDays = Math.round((nowDay.getTime() - endDay.getTime()) / 86400000);
  const chip = pastDays === 0 ? 'Ended today' : pastDays === 1 ? 'Yesterday' : `${pastDays} days ago`;
  return { state: 'past' as const, chip, chipColor: '#94A3B8', progress: 0 };
}

const EVENT_CATS_META: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string; iconBg: string; bg: string }[] = [
  { label: 'Meeting',  icon: 'people-outline',                     color: '#3B82F6', iconBg: '#BFDBFE', bg: '#EFF6FF' },
  { label: 'Work',     icon: 'briefcase-outline',                  color: '#10B981', iconBg: '#BBF7D0', bg: '#F0FDF4' },
  { label: 'Personal', icon: 'home-outline',                       color: '#8B5CF6', iconBg: '#DDD6FE', bg: '#F5F3FF' },
  { label: 'Health',   icon: 'fitness-outline',                    color: '#EC4899', iconBg: '#F9A8D4', bg: '#FDF2F8' },
  { label: 'Social',   icon: 'happy-outline',                      color: '#F59E0B', iconBg: '#FDE68A', bg: '#FFFBEB' },
  { label: 'Travel',   icon: 'airplane-outline',                   color: '#06B6D4', iconBg: '#A5F3FC', bg: '#ECFEFF' },
  { label: 'Other',    icon: 'ellipsis-horizontal-circle-outline', color: '#64748B', iconBg: '#CBD5E1', bg: '#F8FAFC' },
];

export function EventsSegment({ search }: { search: string }) {
  const c = useThemeColors();
  const { showAlert, AlertModal } = useAppAlert();
  const { events, isLoading, fetchEvents, deleteEvent } = useEventsStore();
  const router = useRouter();
  useFocusEffect(useCallback(() => { fetchEvents(); setNow(new Date()); }, [fetchEvents]));

  const [now, setNow] = useState(new Date());
  const [catFilter,       setCatFilter]       = useState<string | null>(null);
  const [catSheetVisible, setCatSheetVisible] = useState(false);
  const [dateFrom,        setDateFrom]        = useState<Date | null>(null);
  const [dateTo,          setDateTo]          = useState<Date | null>(null);
  const [showFromPicker,  setShowFromPicker]  = useState(false);
  const [showToPicker,    setShowToPicker]    = useState(false);
   const { alarmsEnabled } = useNotificationsStore();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const todayDate = new Date().toISOString().slice(0, 10);

  const filtered = events
    .filter((e) => {
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (catFilter && e.category !== catFilter) return false;
      if (dateFrom) {
        const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
        if (new Date(e.startDate) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
        if (new Date(e.startDate) > to) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aDate = a.startDate.slice(0, 10);
      const bDate = b.startDate.slice(0, 10);
      const aUpcoming = aDate >= todayDate;
      const bUpcoming = bDate >= todayDate;
      // Upcoming events first (ascending — nearest first)
      // Past events below (descending — most recent first)
      if (aUpcoming && bUpcoming) return a.startDate.localeCompare(b.startDate);
      if (!aUpcoming && !bUpcoming) return b.startDate.localeCompare(a.startDate);
      return aUpcoming ? -1 : 1;
    });

  if (isLoading && events.length === 0) {
    return <View style={seg.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Filter bar */}
      <View style={[seg.filterBar, { alignSelf: 'flex-start' }]}>
        <TouchableOpacity
          style={[seg.filterBtn, catFilter != null && seg.filterBtnActive]}
          onPress={() => setCatSheetVisible(true)}
          activeOpacity={0.75}
        >
          <Ionicons
            name={catFilter ? (EVENT_CATS_META.find((c) => c.label === catFilter)?.icon ?? 'grid-outline') : 'grid-outline'}
            size={14}
            color={catFilter ? COLORS.primary : '#94A3B8'}
          />
          <Text style={[seg.filterBtnText, catFilter != null && seg.filterBtnTextActive]} numberOfLines={1}>
            {catFilter ?? 'Category'}
          </Text>
          <Ionicons name="chevron-down" size={13} color={catFilter ? COLORS.primary : '#94A3B8'} />
        </TouchableOpacity>

        <View style={seg.dateGroup}>
          <TouchableOpacity
            style={[seg.datePill, !!dateFrom && seg.datePillActive]}
            onPress={() => setShowFromPicker(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="calendar-outline" size={13} color={dateFrom ? COLORS.primary : '#94A3B8'} />
            <Text style={[seg.datePillText, !!dateFrom && seg.datePillTextActive]} numberOfLines={1}>
              {dateFrom ? fmtDate(dateFrom) : 'From'}
            </Text>
          </TouchableOpacity>
          <Text style={seg.dateSep}>–</Text>
          <TouchableOpacity
            style={[seg.datePill, !!dateTo && seg.datePillActive]}
            onPress={() => setShowToPicker(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="calendar-outline" size={13} color={dateTo ? COLORS.primary : '#94A3B8'} />
            <Text style={[seg.datePillText, !!dateTo && seg.datePillTextActive]} numberOfLines={1}>
              {dateTo ? fmtDate(dateTo) : 'To'}
            </Text>
          </TouchableOpacity>
          {(dateFrom || dateTo) && (
            <TouchableOpacity onPress={() => { setDateFrom(null); setDateTo(null); }} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <Ionicons name="close-circle" size={18} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {Platform.OS === 'ios' ? (
        <>
          <IOSPickerModal
            visible={showFromPicker}
            value={dateFrom ?? new Date()}
            mode="date"
            maximumDate={dateTo ?? undefined}
            onCancel={() => setShowFromPicker(false)}
            onDone={(d) => {
              setShowFromPicker(false);
              if (dateTo && d > dateTo) setDateTo(null);
              setDateFrom(d);
            }}
          />
          <IOSPickerModal
            visible={showToPicker}
            value={dateTo ?? new Date()}
            mode="date"
            minimumDate={dateFrom ?? undefined}
            onCancel={() => setShowToPicker(false)}
            onDone={(d) => {
              setShowToPicker(false);
              if (dateFrom && d < dateFrom) setDateFrom(null);
              setDateTo(d);
            }}
          />
        </>
      ) : (
        <>
          {showFromPicker && (
            <DateTimePicker value={dateFrom ?? new Date()} mode="date" display="default"
              maximumDate={dateTo ?? undefined}
              onChange={(_, d) => {
                setShowFromPicker(false);
                if (d) {
                  if (dateTo && d > dateTo) setDateTo(null);
                  setDateFrom(d);
                }
              }} />
          )}
          {showToPicker && (
            <DateTimePicker value={dateTo ?? new Date()} mode="date" display="default"
              minimumDate={dateFrom ?? undefined}
              onChange={(_, d) => {
                setShowToPicker(false);
                if (d) {
                  if (dateFrom && d < dateFrom) setDateFrom(null);
                  setDateTo(d);
                }
              }} />
          )}
        </>
      )}

      {/* Category bottom-sheet */}
      <Modal visible={catSheetVisible} transparent animationType="slide" onRequestClose={() => setCatSheetVisible(false)}>
        <TouchableOpacity style={seg.overlay} activeOpacity={1} onPress={() => setCatSheetVisible(false)} />
        <View style={[seg.editSheet, { backgroundColor: c.surface }]}>
          <View style={[seg.handle, { backgroundColor: c.border }]} />
          <Text style={[seg.editTitle, { color: c.text }]}>Choose Category</Text>
          <View style={seg.catCardGrid}>
            {([{ label: 'All', icon: 'grid-outline' as const, color: COLORS.primary, iconBg: '#BAE6FD', bg: '#F0F9FF' }, ...EVENT_CATS_META]).map(({ label, icon, color, iconBg, bg }) => {
              const active = label === 'All' ? catFilter === null : catFilter === label;
              return (
                <TouchableOpacity
                  key={label}
                  style={[seg.catCard, active && { backgroundColor: bg, borderColor: color, borderWidth: 2 }]}
                  onPress={() => { setCatFilter(label === 'All' ? null : label); setCatSheetVisible(false); }}
                  activeOpacity={0.75}
                >
                  <View style={[seg.catCardIconWrap, { backgroundColor: iconBg }]}>
                    <Ionicons name={icon} size={20} color={color} />
                  </View>
                  <Text style={[seg.catCardLabel, { color }, active && { fontWeight: '700' }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {filtered.length === 0
        ? (
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            <EmptyState message={search || catFilter || dateFrom || dateTo ? 'No matching events' : 'No events yet'} variant="events" />
          </ScrollView>
        )
        : (
          <FlatList
            data={filtered}
            keyExtractor={(e) => e.id}
            contentContainerStyle={seg.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const cat = EVENT_CATS_META.find((c) => c.label === item.category);
              const status = getEventStatus(item.startDate, item.endDate, now);
              return (
                <View style={[seg.eventCard, { backgroundColor: c.surface }]}>
                  <View style={[seg.eventCardBar, { backgroundColor: item.color }]} />
                  <View style={{ flex: 1 }}>
                    <View style={seg.eventCardBody}>
                      <Text style={[seg.eventCardTitle, { color: c.text }]} numberOfLines={2}>{item.title}</Text>
                      {item.description ? <Text style={[seg.eventCardDesc, { color: c.textSub }]} numberOfLines={1}>{item.description}</Text> : null}
                      <View style={seg.eventCardDateRow}>
                        <Ionicons name="time-outline" size={12} color="#94A3B8" />
                        <Text style={seg.eventCardDate}>{formatDateRange(item.startDate, item.endDate)}</Text>
                      </View>
                      {item.alarmAt && alarmsEnabled  && new Date(item.alarmAt) > now ? (
                        <View style={seg.eventCardDateRow}>
                          <Ionicons name="alarm-outline" size={12} color="#2b89ed" />
                          <Text style={[seg.eventCardDate, { color: '#2b89ed' }]}>
                            {new Date(item.alarmAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.cardBottom}>
                        {cat && (
                          <View style={[seg.eventCatBadge, { backgroundColor: cat.color + '18' }]}>
                            <Ionicons name={cat.icon} size={11} color={cat.color} />
                            <Text style={[seg.eventCatBadgeText, { color: cat.color }]}>{cat.label}</Text>
                          </View>
                        )}
                        <View style={[styles.chip, { backgroundColor: status.chipColor + '20' }]}>
                          <Text style={[styles.chipText, { color: status.chipColor }]}>{status.chip}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={seg.eventCardActions}>
                    <TouchableOpacity onPress={() => router.push(`/event-editor?id=${item.id}`)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="create-outline" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Share.share({ message: [item.title, item.description, formatDateRange(item.startDate, item.endDate)].filter(Boolean).join('\n') })}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="share-outline" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      //style={styles.deleteBtn}
                      onPress={() => showAlert({ type: 'confirm', title: 'Delete Event', message: `Are you sure you want to delete "${item.title}"? This cannot be undone.`, buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(item.id) }] })}
                    >
                      <Ionicons name="trash-outline" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            refreshing={isLoading}
            onRefresh={fetchEvents}
          />
        )
      }
      {AlertModal}
    </View>
  );
}

const styles = StyleSheet.create({
  cardBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 6, flexWrap: 'wrap', gap: 6,
  },
  chip: {
    alignSelf: 'flex-start', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  progressTrack: {
    height: 3, borderRadius: 2, backgroundColor: '#E2E8F0',
    overflow: 'hidden', marginHorizontal: 0,
  },
  progressFill: { height: 3, borderRadius: 2 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center',
  },
});

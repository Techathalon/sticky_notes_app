import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { GradientScreen } from '../../components/GradientScreen';
import { EmptyState } from '../../components/EmptyState';
import { useFocusEffect, useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useEventsStore } from '../../store/eventsStore';
import { useCalendarStore } from '../../store/calendarStore';
import { COLORS } from '../../constants/colors';
import { useThemeColors, useIsDark } from '../../store/themeStore';
import { toLocalDateStr, formatDateRange } from '../../utils/dateUtils';
import type { Event } from '@repo/types';

type MarkedDates = Record<string, {
  dots: Array<{ key: string; color: string }>;
  selected?: boolean;
  selectedColor?: string;
}>;

function EventItem({ event, now }: { event: Event; now: Date }) {
  const c = useThemeColors();
  const router = useRouter();
  const start = new Date(event.startDate).getTime();
  const end = new Date(event.endDate).getTime();
  const n = now.getTime();
  const isLive = n >= start && n <= end;

  return (
    <TouchableOpacity
      style={[styles.eventItem, { backgroundColor: c.surface }]}
      onPress={() => router.push(`/event-editor?id=${event.id}`)}
      activeOpacity={0.75}
    >
      <View style={[styles.eventDot, { backgroundColor: event.color }]} />
      <View style={styles.eventInfo}>
        <Text style={[styles.eventTitle, { color: c.text }]} numberOfLines={1}>{event.title}</Text>
        <View style={styles.eventTimeRow}>
          <Ionicons name="time-outline" size={12} color="#94A3B8" />
          <Text style={styles.eventTime}>{formatDateRange(event.startDate, event.endDate)}</Text>
        </View>
      </View>
      {isLive && (
        <View style={styles.liveChip}>
          <Text style={styles.liveChipText}>● LIVE</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function todayStr() {
  return toLocalDateStr(new Date().toISOString());
}

export default function CalendarScreen() {
  const c = useThemeColors();
  const isDark = useIsDark();
  const { events, isLoading, fetchEvents } = useEventsStore();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [now, setNow] = useState(new Date());
  const { jumpDate, setJumpDate } = useCalendarStore();

  useFocusEffect(useCallback(() => {
    fetchEvents();
    setNow(new Date());
    if (jumpDate) { setSelectedDate(jumpDate); setJumpDate(null); }
  }, [fetchEvents, jumpDate, setJumpDate]));

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const markedDates: MarkedDates = {};

  events.forEach((ev) => {
    const dateKey = toLocalDateStr(ev.startDate);
    if (!markedDates[dateKey]) {
      markedDates[dateKey] = { dots: [] };
    }
    if (markedDates[dateKey].dots.length < 3) {
      markedDates[dateKey].dots.push({ key: ev.id, color: ev.color });
    }
  });

  if (markedDates[selectedDate]) {
    markedDates[selectedDate] = {
      ...markedDates[selectedDate],
      selected: true,
      selectedColor: COLORS.primary,
    };
  } else {
    markedDates[selectedDate] = {
      dots: [],
      selected: true,
      selectedColor: COLORS.primary,
    };
  }

  const dayEvents = events.filter((ev) => toLocalDateStr(ev.startDate) === selectedDate);

  const selectedLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <GradientScreen style={styles.root}>
      {isLoading && events.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={dayEvents}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <View style={{ backgroundColor: c.surface }}>
                <Calendar
                  key={`${isDark}-${selectedDate.slice(0, 7)}`}
                  current={selectedDate}
                  style={styles.calendar}
                  theme={{
                    todayTextColor: COLORS.primary,
                    selectedDayBackgroundColor: COLORS.primary,
                    selectedDayTextColor: '#fff',
                    dotColor: COLORS.primary,
                    arrowColor: COLORS.primary,
                    monthTextColor: c.text,
                    dayTextColor: c.text,
                    textSectionTitleColor: c.textSub,
                    textMonthFontWeight: '700',
                    textDayHeaderFontWeight: '600',
                    textDayFontSize: 14,
                    calendarBackground: c.surface,
                    backgroundColor: c.surface,
                  }}
                  markingType="multi-dot"
                  markedDates={markedDates}
                  onDayPress={(day) => setSelectedDate(day.dateString)}
                  enableSwipeMonths
                />
              </View>
              <View style={[styles.dayHeader, { borderTopColor: c.border }]}>
                <Text style={[styles.dayLabel, { color: c.text }]}>{selectedLabel}</Text>
                <Text style={styles.eventCount}>
                  {dayEvents.length === 0 ? 'No events' : `${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}`}
                </Text>
              </View>
            </>
          }
          renderItem={({ item }) => <EventItem event={item} now={now} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <EmptyState message="No events on this day" variant="events" />
          }
        />
      )}
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' ,marginBottom:4},
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 40 },
  calendar: {
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  dayLabel: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  eventCount: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  eventItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    marginHorizontal: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  eventDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 3 },
  eventTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventTime: { fontSize: 12, color: '#94A3B8' },
  liveChip: {
    backgroundColor: '#10B98120', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8,
  },
  liveChipText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
});

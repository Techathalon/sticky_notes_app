import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { GradientScreen } from '../../components/GradientScreen';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants/colors';
import { useThemeColors } from '../../store/themeStore';
import { useHomeStore } from '../../store/homeStore';
import { TodaySegment } from '../../components/segments/TodaySegment';
import { NotesSegment } from '../../components/segments/NotesSegment';
import { EventsSegment } from '../../components/segments/EventsSegment';
import { TasksSegment } from '../../components/segments/TasksSegment';

type Segment = 'today' | 'notes' | 'events' | 'tasks';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'today',  label: 'Today'  },
  { key: 'notes',  label: 'Notes'  },
  { key: 'events', label: 'Events' },
  { key: 'tasks',  label: 'Tasks'  },
];

function greeting(name: string | null) {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `Good ${part}${name ? `, ${name.split(' ')[0]}` : ''}`;
}

export default function HomeScreen() {
  const c = useThemeColors();
  const { homeSegment: storeSegment, setHomeSegment } = useHomeStore();
  const [activeSegment, setActiveSegment] = useState<Segment>(storeSegment);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const user = useAuthStore((s) => s.user);
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  useEffect(() => {
    setActiveSegment(storeSegment);
  }, [storeSegment]);

  const toggleSearch = () => {
    setSearchVisible((v) => !v);
    setSearchQuery('');
  };

  const searchPlaceholder =
    activeSegment === 'notes'  ? 'Search notes...'  :
    activeSegment === 'events' ? 'Search events...' :
    activeSegment === 'tasks'  ? 'Search tasks...'  : '';

  return (
    <GradientScreen style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        {searchVisible && (
          <View style={styles.searchInline}>
            <Ionicons name="search-outline" size={16} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
        )}
        {activeSegment !== 'today' && (
          <TouchableOpacity style={styles.searchBtn} onPress={toggleSearch}>
            <Ionicons name={searchVisible ? 'close' : 'search-outline'} size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Greeting */}
      <View style={styles.greetingCard}>
        <Text style={[styles.greetingText, { color: c.text }]}>{greeting(user?.name ?? null)}</Text>
        <Text style={[styles.greetingDate, { color: c.textSub }]}>{todayLabel}</Text>
      </View>

      {/* Segment Picker */}
      <View style={styles.segmentBar}>
        {SEGMENTS.map((s) => {
          const active = activeSegment === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.segPill, { backgroundColor: c.surface2 }, active && { backgroundColor: c.surface }]}
              onPress={() => {
                setActiveSegment(s.key);
                setHomeSegment(s.key);
                setSearchQuery('');
                if (s.key === 'today') setSearchVisible(false);
              }}
            >
              <Text style={[styles.segLabel, { color: c.textMuted }, active && { color: c.text }]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeSegment === 'today'  && <TodaySegment />}
        {activeSegment === 'notes'  && <NotesSegment  search={searchQuery} />}
        {activeSegment === 'events' && <EventsSegment search={searchQuery} />}
        {activeSegment === 'tasks'  && <TasksSegment  search={searchQuery} />}
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' , marginBottom:4},
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    paddingHorizontal: 20, paddingVertical: 12,
    gap: 10,
  },
  searchInline: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  searchBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#a9caf5',
    alignItems: 'center', justifyContent: 'center',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B', padding: 0 },
  greetingCard: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  greetingText: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  greetingDate: { fontSize: 13, color: '#64748B' },
  segmentBar: {
    flexDirection: 'row', gap: 6,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  segPill: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#EFF1F5',
  },
  segLabel: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  content: { flex: 1 },
});

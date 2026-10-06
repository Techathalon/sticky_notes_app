import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, Share,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTodosStore } from '../../store/todosStore';
import { useAppAlert } from '../AppAlert';
import { EmptyState } from '../EmptyState';
import { TodayTaskCard } from '../TodayTaskCard';
import { COLORS } from '../../constants/colors';
import { useThemeColors } from '../../store/themeStore';
import { toLocalDateStr } from '../../utils/dateUtils';
import type { TodoStatus, TodoPriority } from '@repo/types';
import { STATUS_META, PRIORITY_META, todayStr, seg } from './segStyles';
import { useNotificationsStore } from '@/store/notificationsStore';

export function TasksSegment({ search }: { search: string }) {
  const c = useThemeColors();
  const { showAlert, AlertModal } = useAppAlert();
  const { todos, isLoading, fetchTodos, deleteTodo } = useTodosStore();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [priorityFilter, setPriorityFilter] = useState<TodoPriority | null>(null);
  const [statusFilter,   setStatusFilter]   = useState<TodoStatus | null>(null);
  const [prioritySheet,  setPrioritySheet]  = useState(false);
  const [statusSheet,    setStatusSheet]    = useState(false);
  const { alarmsEnabled } = useNotificationsStore();

  useFocusEffect(useCallback(() => { fetchTodos(); }, [fetchTodos]));

  const prevDay = useCallback(() => {
    setSelectedDate((cur) => {
      const d = new Date(cur + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      return toLocalDateStr(d.toISOString());
    });
  }, []);

  const nextDay = useCallback(() => {
    setSelectedDate((cur) => {
      const d = new Date(cur + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      return toLocalDateStr(d.toISOString());
    });
  }, []);

  const dayTodos = todos.filter((t) => {
    const ds = t.dueDate ? toLocalDateStr(t.dueDate) : toLocalDateStr(t.createdAt);
    return ds === selectedDate;
  });
  const completedCount  = dayTodos.filter((t) => t.status === 'COMPLETED').length;
  const inProgressCount = dayTodos.filter((t) => t.status === 'IN_PROGRESS').length;
  const todoCount       = dayTodos.filter((t) => t.status === 'TODO').length;
  const totalCount      = dayTodos.length;

  const dayFiltered = dayTodos.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (statusFilter   && t.status   !== statusFilter)   return false;
    return true;
  });
  const remaining = dayFiltered.filter((t) => t.status !== 'COMPLETED').length;
  const anyFilter = !!(priorityFilter || statusFilter);
   const [now, setNow] = useState(new Date());
 useEffect(() => {
     const t = setInterval(() => setNow(new Date()), 60_000);
     return () => clearInterval(t);
   }, []); 

  if (isLoading && todos.length === 0) {
    return <View style={seg.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      <TodayTaskCard
        completed={completedCount}
        inProgress={inProgressCount}
        todo={todoCount}
        total={totalCount}
        date={selectedDate}
        onPrevDay={prevDay}
        onNextDay={nextDay}
        onDateChange={setSelectedDate}
      />

      {/* Filter bar */}
      <View style={seg.filterBar}>
        <TouchableOpacity
          style={[seg.filterBtn, { flex: 1 }, priorityFilter && seg.filterBtnActive]}
          onPress={() => setPrioritySheet(true)}
        >
          <View style={[seg.priorityDot, { backgroundColor: priorityFilter ? PRIORITY_META[priorityFilter].color : '#CBD5E1' }]} />
          <Text style={[seg.filterBtnText, priorityFilter && seg.filterBtnTextActive]} numberOfLines={1}>
            {priorityFilter ? PRIORITY_META[priorityFilter].label : 'Priority'}
          </Text>
          <Ionicons name="chevron-down" size={13} color={priorityFilter ? COLORS.primary : '#94A3B8'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[seg.filterBtn, { flex: 1 }, statusFilter && seg.filterBtnActive]}
          onPress={() => setStatusSheet(true)}
        >
          <View style={[seg.priorityDot, { backgroundColor: statusFilter ? STATUS_META[statusFilter].color : '#CBD5E1' }]} />
          <Text style={[seg.filterBtnText, statusFilter && seg.filterBtnTextActive]} numberOfLines={1}>
            {statusFilter ? STATUS_META[statusFilter].label : 'Status'}
          </Text>
          <Ionicons name="chevron-down" size={13} color={statusFilter ? COLORS.primary : '#94A3B8'} />
        </TouchableOpacity>

        {anyFilter && (
          <TouchableOpacity onPress={() => { setPriorityFilter(null); setStatusFilter(null); }} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {dayFiltered.length === 0 ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <EmptyState message={search || anyFilter ? 'No matching tasks' : 'No tasks on this day'} variant="tasks" />
        </ScrollView>
      ) : (
        <FlatList
          data={dayFiltered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={seg.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            remaining > 0
              ? <Text style={seg.taskHeader}>{remaining} remaining</Text>
              : <Text style={[seg.taskHeader, { color: COLORS.primary }]}>All done!</Text>
          }
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status];
            const pMeta = PRIORITY_META[item.priority ?? 'MEDIUM'];
            return (
              <View style={[seg.taskCard, { borderLeftColor: meta.color, backgroundColor: c.surface }]}>
                <View style={seg.taskCardTop}>
                  <Text style={[seg.taskCardTitle, { color: c.text }, item.completed && seg.strikethrough]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={seg.taskCardActions}>
                    <TouchableOpacity
                      onPress={() => router.push(`/task-editor?id=${item.id}`)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="create-outline" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Share.share({ message: [item.title, item.description, `Status: ${meta.label}`, `Priority: ${pMeta.label}`].filter(Boolean).join('\n') })}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="share-outline" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      onPress={() => showAlert({ type: 'confirm', title: 'Delete Task', message: `Are you sure you want to delete "${item.title}"? This cannot be undone.`, buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteTodo(item.id) }] })}
                    >
                      <Ionicons name="trash-outline" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                  </View>
                </View>
                {item.description ? (
                  <Text style={[seg.taskCardDesc, item.completed && seg.strikethrough]} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
                <View style={seg.taskCardBadges}>
                  <View style={[seg.statusBadge, { backgroundColor: meta.color + '20' }]}>
                    <Text style={[seg.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <View style={[seg.priorityBadge, { backgroundColor: pMeta.bg }]}>
                    <View style={[seg.priorityDot, { backgroundColor: pMeta.color, width: 6, height: 6 }]} />
                    <Text style={[seg.priorityBadgeText, { color: pMeta.color }]}>{pMeta.label}</Text>
                  </View>
                  {item.dueTime ? (
                    <View style={seg.timeBadge}>
                      <Ionicons name="time-outline" size={11} color="#64748B" />
                      <Text style={seg.timeBadgeText}>
                        {(() => { const [h, m] = item.dueTime.split(':'); const d = new Date(); d.setHours(+h, +m); return d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); })()}
                        </Text>
                    </View>
                  ) : null}
                  {item.alarmAt && alarmsEnabled && new Date(item.alarmAt) > now ? (
                    <View style={seg.timeBadge}>
                      <Ionicons name="alarm-outline" size={11} color="#2b89ed" />
                      <Text style={[seg.timeBadgeText, { color: '#2b89ed' }]}>
                        {new Date(item.alarmAt).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshing={isLoading}
          onRefresh={fetchTodos}
        />
      )}

      {/* Priority bottom sheet */}
      <Modal visible={prioritySheet} transparent animationType="slide" onRequestClose={() => setPrioritySheet(false)}>
        <TouchableOpacity style={seg.overlay} activeOpacity={1} onPress={() => setPrioritySheet(false)} />
        <View style={[seg.editSheet, { backgroundColor: c.surface }]}>
          <View style={[seg.handle, { backgroundColor: c.border }]} />
          <Text style={[seg.editTitle, { color: c.text }]}>Filter by Priority</Text>
          <View style={seg.catCardGrid}>
            {([
              { p: null,     label: 'All',    icon: 'apps-outline' as const,               color: COLORS.primary, iconBg: '#BAE6FD', bg: '#F0F9FF' },
              { p: 'HIGH',   label: 'High',   icon: 'flame-outline' as const,              color: '#EF4444',      iconBg: '#FECACA', bg: '#FEF2F2' },
              { p: 'MEDIUM', label: 'Medium', icon: 'remove-circle-outline' as const,      color: '#F59E0B',      iconBg: '#FDE68A', bg: '#FFFBEB' },
              { p: 'LOW',    label: 'Low',    icon: 'chevron-down-circle-outline' as const, color: '#22C55E',     iconBg: '#BBF7D0', bg: '#F0FDF4' },
            ]).map(({ p, label, icon, color, iconBg, bg }) => {
              const active = priorityFilter === p;
              return (
                <TouchableOpacity
                  key={label}
                  style={[seg.catCard, active && { backgroundColor: bg, borderColor: color, borderWidth: 2 }]}
                  onPress={() => { setPriorityFilter(p as TodoPriority | null); setPrioritySheet(false); }}
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

      {/* Status bottom sheet */}
      <Modal visible={statusSheet} transparent animationType="slide" onRequestClose={() => setStatusSheet(false)}>
        <TouchableOpacity style={seg.overlay} activeOpacity={1} onPress={() => setStatusSheet(false)} />
        <View style={[seg.editSheet, { backgroundColor: c.surface }]}>
          <View style={[seg.handle, { backgroundColor: c.border }]} />
          <Text style={[seg.editTitle, { color: c.text }]}>Filter by Status</Text>
          <View style={seg.catCardGrid}>
            {([
              { st: null,          label: 'All',         icon: 'apps-outline' as const,             color: COLORS.primary, iconBg: '#BAE6FD', bg: '#F0F9FF' },
              { st: 'TODO',        label: 'To Do',       icon: 'ellipse-outline' as const,          color: '#94A3B8',      iconBg: '#E2E8F0', bg: '#F8FAFC' },
              { st: 'IN_PROGRESS', label: 'In Progress', icon: 'time-outline' as const,             color: '#3B82F6',      iconBg: '#BFDBFE', bg: '#EFF6FF' },
              { st: 'COMPLETED',   label: 'Completed',   icon: 'checkmark-circle-outline' as const, color: '#22C55E',      iconBg: '#BBF7D0', bg: '#F0FDF4' },
            ]).map(({ st, label, icon, color, iconBg, bg }) => {
              const active = statusFilter === st;
              return (
                <TouchableOpacity
                  key={label}
                  style={[seg.catCard, active && { backgroundColor: bg, borderColor: color, borderWidth: 2 }]}
                  onPress={() => { setStatusFilter(st as TodoStatus | null); setStatusSheet(false); }}
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
      {AlertModal}
    </View>
  );
}

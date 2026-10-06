import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ProgressCircle } from './ProgressCircle';
import { toLocalDateStrFromDate } from '../utils/dateUtils';

interface Props {
  completed: number;
  inProgress: number;
  todo: number;
  total: number;
  date: string;               // 'YYYY-MM-DD'
  onPrevDay?: () => void;
  onNextDay?: () => void;
  onDateChange?: (dateStr: string) => void;
}

interface StatusRowProps {
  color: string;
  label: string;
  count: number;
}

function StatusRow({ color, label, count }: StatusRowProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.badge, { backgroundColor: color + '20' }]}>
        <Text style={[styles.badgeText, { color }]}>{count}</Text>
      </View>
    </View>
  );
}

export function TodayTaskCard({
  completed, inProgress, todo, total,
  date,
  onPrevDay, onNextDay, onDateChange,
}: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date(date + 'T12:00:00'));

  // Keep picker date in sync when date prop changes externally
  useEffect(() => {
    setPickerDate(new Date(date + 'T12:00:00'));
  }, [date]);

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const handleDone = () => {
    setShowPicker(false);
    onDateChange?.(toLocalDateStrFromDate(pickerDate));
  };

  return (
    <View style={styles.card}>
      {/* Date navigator — only shown when navigation props are provided */}
      {(onPrevDay || onNextDay || onDateChange) ? (
        <View style={styles.dateRow}>
          <TouchableOpacity onPress={onPrevDay} style={styles.chevron} activeOpacity={0.6}>
            <Ionicons name="chevron-back-outline" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowPicker(true)} activeOpacity={0.7} style={styles.dateLabelWrap}>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
            <Ionicons name="calendar-outline" size={22} color="#94A3B8" style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onNextDay}
            style={styles.chevron}
            activeOpacity={0.6}
          >
            <Ionicons name="chevron-forward-outline" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Circle + status rows */}
      <View style={styles.body}>
        <ProgressCircle
          completed={completed}
          inProgress={inProgress}
          todo={todo}
          total={total}
          size={110}
          strokeWidth={10}
        />
        <View style={styles.right}>
          <StatusRow color="#22C55E" label="Completed"   count={completed} />
          <StatusRow color="#3B82F6" label="In Progress" count={inProgress} />
          <StatusRow color="#CBD5E1" label="Left To Do"  count={todo} />
        </View>
      </View>

      {/* Date picker — Android: native dialog, iOS: bottom sheet */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          onChange={(_, selected) => {
            setShowPicker(false);
            if (selected) onDateChange?.(toLocalDateStrFromDate(selected));
          }}
        />
      )}

      {showPicker && Platform.OS === 'ios' && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={handleDone}>
            <View style={styles.pickerSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Date</Text>
                <TouchableOpacity onPress={handleDone}>
                  <Text style={styles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                onChange={(_, selected) => { if (selected) setPickerDate(selected); }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chevron: { padding: 4 },
  chevronDisabled: { opacity: 0.3 },
  dateLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  right: {
    flex: 1,
    paddingLeft: 20,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: 13, fontWeight: '500', color: '#475569' },
  badge: {
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
    minWidth: 28, alignItems: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  // Date picker
  pickerBackdrop: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  pickerDone: { fontSize: 15, fontWeight: '700', color: '#3B82F6' },
});

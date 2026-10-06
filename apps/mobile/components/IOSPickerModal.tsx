import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../store/themeStore';

type Props = {
  visible: boolean;
  value: Date;
  mode: 'date' | 'time';
  minimumDate?: Date;
  maximumDate?: Date;
  is24Hour?: boolean;
  onDone: (date: Date) => void;
  onCancel: () => void;
};

/**
 * iOS-only bottom-sheet wrapper for DateTimePicker.
 * Colour scheme follows the app theme (light/dark).
 * On Android this renders nothing — callers use DateTimePicker directly.
 */
export function IOSPickerModal({
  visible, value, mode, minimumDate, maximumDate, is24Hour = false,
  onDone, onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();

  // Track picker value locally without re-renders; committed only on Done tap.
  let _current = value;
  const handleChange = (_: DateTimePickerEvent, d?: Date) => {
    if (d) _current = d;
  };

  if (Platform.OS !== 'ios') return null;

  const isDark = c.bg === '#0F172A' || c.bg === '#1E293B';

  // Sheet and handle colours derived from theme
  const sheetBg    = isDark ? '#1E293B' : '#FFFFFF';
  const handleBg   = isDark ? '#475569' : '#CBD5E1';
  const borderCol  = isDark ? '#334155' : '#E2E8F0';
  const titleCol   = isDark ? '#F1F5F9' : '#1E293B';
  const cancelCol  = isDark ? '#94A3B8' : '#64748B';
  const doneCol    = '#3B82F6';
  const pickerText = isDark ? '#F1F5F9' : '#1E293B';

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      {/* Dim backdrop — tap to cancel */}
      <TouchableOpacity
        style={s.backdrop}
        activeOpacity={1}
        onPress={onCancel}
      />

      <View style={[s.sheet, { backgroundColor: sheetBg, paddingBottom: Math.max(insets.bottom, 20) }]}>
        {/* Drag handle */}
        <View style={[s.handle, { backgroundColor: handleBg }]} />

        {/* Header */}
        <View style={[s.header, { borderBottomColor: borderCol }]}>
          <TouchableOpacity
            onPress={onCancel}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={s.headerBtn}
          >
            <Text style={[s.cancelText, { color: cancelCol }]}>Cancel</Text>
          </TouchableOpacity>

          <Text style={[s.titleText, { color: titleCol }]}>
            {mode === 'date' ? 'Select Date' : 'Select Time'}
          </Text>

          <TouchableOpacity
            onPress={() => onDone(_current)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={s.headerBtn}
          >
            <Text style={[s.doneText, { color: doneCol }]}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Picker */}
        <DateTimePicker
          value={value}
          mode={mode}
          display="spinner"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          is24Hour={is24Hour}
          onChange={handleChange}
          style={s.picker}
          textColor={pickerText}
          themeVariant={isDark ? 'dark' : 'light'}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    minWidth: 60,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
  doneText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  picker: {
    width: '100%',
    height: 200,
  },
});

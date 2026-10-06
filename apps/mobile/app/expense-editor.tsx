import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IOSPickerModal } from '../components/IOSPickerModal';
import { useAppAlert } from '../components/AppAlert';
import { useExpenseStore, type ExpenseCategory } from '../store/expenseStore';
import { useThemeColors } from '../store/themeStore';
import { COLORS } from '../constants/colors';

// ─── Category meta ────────────────────────────────────────────

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CAT_META: Record<ExpenseCategory, { icon: IoniconName; color: string }> = {
  Food:      { icon: 'fast-food-outline',           color: '#F59E0B' },
  Transport: { icon: 'car-outline',                 color: '#3B82F6' },
  Shopping:  { icon: 'bag-outline',                 color: '#EC4899' },
  Health:    { icon: 'fitness-outline',             color: '#10B981' },
  Bills:     { icon: 'receipt-outline',             color: '#8B5CF6' },
  Other:     { icon: 'ellipsis-horizontal-outline', color: '#64748B' },
};

const CATEGORIES = Object.keys(CAT_META) as ExpenseCategory[];

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Screen ───────────────────────────────────────────────────

export default function ExpenseEditorScreen() {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const { showAlert, AlertModal } = useAppAlert();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { expenses, createExpense, updateExpense } = useExpenseStore();

  const existing = id ? expenses.find((e) => e.id === id) ?? null : null;
  const isNew = !existing;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const isStandardCat = (cat: string): cat is ExpenseCategory => CATEGORIES.includes(cat as ExpenseCategory);
  const [category, setCategory] = useState<ExpenseCategory>(
    existing && !isStandardCat(existing.category) ? 'Other' : (existing?.category ?? 'Food')
  );
  const [customCategory, setCustomCategory] = useState(
    existing && !isStandardCat(existing.category) ? existing.category : ''
  );
  const [date, setDate] = useState(() => {
    if (existing) {
      const [y, m, d] = existing.date.split('-');
      return new Date(Number(y), Number(m) - 1, Number(d));
    }
    return new Date();
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const effectiveCategory = category === 'Other' && customCategory.trim()
    ? customCategory.trim()
    : category;

  const isDirty = isNew || (
    title.trim() !== (existing?.title ?? '') ||
    amount !== String(existing?.amount ?? '') ||
    effectiveCategory !== (existing?.category ?? 'Food') ||
    dateToStr(date) !== (existing?.date ?? '')
  );

  const handleSave = async () => {
    if (saving) return;
    if (!title.trim()) {
      showAlert({ type: 'error', title: 'Title Required', message: 'Please enter a title for this expense.' });
      return;
    }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      showAlert({ type: 'error', title: 'Invalid Amount', message: 'Please enter a valid amount greater than zero.' });
      return;
    }
    if (category === 'Other' && !customCategory.trim()) {
      showAlert({ type: 'error', title: 'Category Required', message: 'Please enter a custom category name.' });
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updateExpense(existing.id, { title: title.trim(), amount: amt, category: effectiveCategory, date: dateToStr(date) });
      } else {
        await createExpense({ title: title.trim(), amount: amt, category: effectiveCategory, date: dateToStr(date) });
      }
      router.back();
    } catch {
      showAlert({ type: 'error', title: 'Save Failed', message: 'Could not save the expense. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: c.hairline }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: c.text }]}>{isNew ? 'New Expense' : 'Edit Expense'}</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isDirty || saving}
            style={[s.saveBtn, { backgroundColor: COLORS.primary }, (!isDirty || saving) && { opacity: 0.4 }]}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.saveBtnText}>{isNew ? 'Save' : 'Update'}</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <Text style={[s.label, { color: c.textSub }]}>Title</Text>
          <TextInput
            style={[s.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
            placeholder="e.g. Lunch, Uber ride..."
            placeholderTextColor={c.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={50}
          />
          <Text style={[s.charCount, { color: title.length >= 40 ? '#EF4444' : c.textMuted }]}>
            {title.length}/50
          </Text>

          {/* Amount */}
          <Text style={[s.label, { color: c.textSub }]}>Amount (₹)</Text>
          <TextInput
            style={[s.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
            placeholder="0.00"
            placeholderTextColor={c.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            maxLength={10}
          />

          {/* Category */}
          <Text style={[s.label, { color: c.textSub }]}>Category</Text>
          <View style={s.catGrid}>
            {CATEGORIES.map((cat) => {
              const meta = CAT_META[cat];
              const active = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[s.catChip, { backgroundColor: c.surface, borderColor: c.border },
                    active && { backgroundColor: meta.color + '22', borderColor: meta.color, borderWidth: 2 }]}
                  onPress={() => { setCategory(cat); if (cat !== 'Other') setCustomCategory(''); }}
                >
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                  <Text style={[s.catChipText, { color: meta.color }, active && { fontWeight: '700' }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {category === 'Other' && (
            <>
              <Text style={[s.label, { color: c.textSub }]}>Custom Category</Text>
              <TextInput
                style={[s.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
                placeholder="e.g. Groceries, Rent..."
                placeholderTextColor={c.textMuted}
                value={customCategory}
                onChangeText={setCustomCategory}
                maxLength={30}
              />
            </>
          )}

          {/* Date */}
          <Text style={[s.label, { color: c.textSub }]}>Date</Text>
          <TouchableOpacity
            style={[s.datePill, { backgroundColor: c.inputBg, borderColor: c.border }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
            <Text style={[s.datePillText, { color: COLORS.primary }]}>
              {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </TouchableOpacity>
          {Platform.OS === 'ios' ? (
            <IOSPickerModal
              visible={showDatePicker}
              value={date}
              mode="date"
              maximumDate={new Date()}
              onCancel={() => setShowDatePicker(false)}
              onDone={(d) => { setShowDatePicker(false); setDate(d); }}
            />
          ) : showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {AlertModal}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  saveBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  content: { padding: 24, paddingBottom: 60 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 8 },
  input: {
    height: 52, borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, fontSize: 15, marginBottom: 4,
  },
  charCount: { fontSize: 11, textAlign: 'right', marginBottom: 8 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
  },
  catChipText: { fontSize: 13, fontWeight: '600' },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 52, borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, marginBottom: 8,
  },
  datePillText: { fontSize: 14, fontWeight: '600' },
});

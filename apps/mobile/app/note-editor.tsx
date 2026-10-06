import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { useAppAlert } from '../components/AppAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNotesStore } from '../store/notesStore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { notesApi } from '../services/api';
import { useExpenseStore, type ExpenseCategory, type Expense } from '../store/expenseStore';
import { useHomeStore } from '../store/homeStore';
import { COLORS, NOTE_COLOR_OPTIONS } from '../constants/colors';
import { useThemeColors, useIsDark } from '../store/themeStore';
import { noteDraft, clearNoteDraft } from '../utils/noteDraft';
import { isBiometricAvailable } from '../utils/biometrics';
import { detectAllExpenses, type DetectedExpense } from '../utils/detectExpense';
import type { Note } from '@repo/types';
import { IOSPickerModal } from '@/components/IOSPickerModal';

// ─── Block Model ──────────────────────────────────────────────

type TextBlock = { type: 'text'; id: string; text: string };
type ImageBlock = {
  type: 'image';
  id: string;
  uri: string;
  widthPct: 50 | 75 | 100;
  height: number;
};
type NoteBlock = TextBlock | ImageBlock;

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

function loadBlocks(note: Note | undefined, draftBlocks: NoteBlock[] | null): NoteBlock[] {
  if (draftBlocks) return draftBlocks;
  if (!note) return [{ type: 'text', id: uid(), text: '' }];
  if (note.content?.startsWith('[')) {
    try {
      return JSON.parse(note.content) as NoteBlock[];
    } catch {
      // ignore
    }
  }
  const blocks: NoteBlock[] = [{ type: 'text', id: uid(), text: note.content ?? '' }];
  for (const uri of (note as unknown as { images?: string[] }).images ?? []) {
    blocks.push({ type: 'image', id: uid(), uri, widthPct: 100, height: 200 });
    blocks.push({ type: 'text', id: uid(), text: '' });
  }
  return blocks;
}

// ─── Categories ───────────────────────────────────────────────

const CATEGORIES: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  iconBg: string;
  bg: string;
}[] = [
  { label: 'Education', icon: 'book-outline', color: '#3B82F6', iconBg: '#BFDBFE', bg: '#EFF6FF' },
  { label: 'Work', icon: 'briefcase-outline', color: '#10B981', iconBg: '#BBF7D0', bg: '#F0FDF4' },
  { label: 'Personal', icon: 'home-outline', color: '#8B5CF6', iconBg: '#DDD6FE', bg: '#F5F3FF' },
  { label: 'Health', icon: 'fitness-outline', color: '#EC4899', iconBg: '#F9A8D4', bg: '#FDF2F8' },
  { label: 'Finance', icon: 'wallet-outline', color: '#D97706', iconBg: '#FDE68A', bg: '#FFFBEB' },
  { label: 'Travel', icon: 'airplane-outline', color: '#059669', iconBg: '#6EE7B7', bg: '#ECFDF5' },
  { label: 'Ideas', icon: 'bulb-outline', color: '#7C3AED', iconBg: '#D8B4FE', bg: '#F5F3FF' },
  { label: 'Other', icon: 'document-outline', color: '#64748B', iconBg: '#CBD5E1', bg: '#F8FAFC' },
];

// ─── Category Sheet ───────────────────────────────────────────

function CategorySheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (cat: string) => void;
  onClose: () => void;
}) {
  const c = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={cs.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[cs.sheet, { backgroundColor: c.surface }]}>
        <View style={[cs.handle, { backgroundColor: c.border }]} />
        <Text style={[cs.sheetTitle, { color: c.text }]}>Choose Category</Text>
        <View style={cs.chipGrid}>
          {CATEGORIES.map(({ label, icon, color, bg }) => {
            const active = selected === label;
            return (
              <TouchableOpacity
                key={label}
                style={[
                  cs.chip,
                  active && { backgroundColor: bg, borderColor: color, borderWidth: 2 },
                ]}
                onPress={() => {
                  onSelect(label);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name={icon} size={16} color={color} />
                <Text style={[cs.chipLabel, { color }, active && { fontWeight: '700' }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const cs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: 18, textAlign: 'center' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
});

// ─── Resize Sheet ─────────────────────────────────────────────

function ResizeSheet({
  block,
  onUpdate,
  onClose,
}: {
  block: ImageBlock;
  onUpdate: (widthPct: 50 | 75 | 100, height: number) => void;
  onClose: () => void;
}) {
  const c = useThemeColors();
  const [widthPct, setWidthPct] = useState<50 | 75 | 100>(block.widthPct);
  const [height, setHeight] = useState(block.height);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={rs.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[rs.sheet, { backgroundColor: c.surface }]}>
        <View style={[rs.handle, { backgroundColor: c.border }]} />
        <Text style={[rs.title, { color: c.text }]}>Resize Image</Text>

        {/* Width */}
        <Text style={[rs.label, { color: c.textSub }]}>Width</Text>
        <View style={rs.widthRow}>
          {([50, 75, 100] as const).map((w) => (
            <TouchableOpacity
              key={w}
              style={[rs.widthBtn, widthPct === w && rs.widthBtnActive]}
              onPress={() => setWidthPct(w)}
              activeOpacity={0.75}
            >
              <Text style={[rs.widthBtnText, widthPct === w && rs.widthBtnTextActive]}>{w}%</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Height */}
        <Text style={[rs.label, { color: c.textSub }]}>Height</Text>
        <View style={rs.heightRow}>
          <TouchableOpacity
            style={[rs.hBtn, { backgroundColor: c.surface2 ?? c.inputBg }]}
            onPress={() => setHeight((h) => Math.max(100, h - 50))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="remove" size={22} color={c.text} />
          </TouchableOpacity>
          <Text style={[rs.hValue, { color: c.text }]}>{height}px</Text>
          <TouchableOpacity
            style={[rs.hBtn, { backgroundColor: c.surface2 ?? c.inputBg }]}
            onPress={() => setHeight((h) => Math.min(600, h + 50))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={22} color={c.text} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={rs.applyBtn}
          onPress={() => {
            onUpdate(widthPct, height);
            onClose();
          }}
        >
          <Text style={rs.applyBtnText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const rs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 10 },
  widthRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  widthBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  widthBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#0EA5E9' },
  widthBtnText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  widthBtnTextActive: { color: '#0EA5E9' },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 28,
  },
  hBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hValue: { fontSize: 20, fontWeight: '700', minWidth: 80, textAlign: 'center' },
  applyBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  applyBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

// ─── Image Block Component ────────────────────────────────────

function ImageBlockView({
  block,
  onRemove,
  onResize,
}: {
  block: ImageBlock;
  onRemove: () => void;
  onResize: () => void;
}) {
  const widthMap = { 50: '50%', 75: '75%', 100: '100%' } as const;
  return (
    <View style={[ib.wrap, { width: widthMap[block.widthPct] as `${number}%` }]}>
      <Image
        source={{ uri: block.uri }}
        style={{ width: '100%', height: block.height, borderRadius: 12 }}
        resizeMode="cover"
      />
      <TouchableOpacity
        style={ib.removeBtn}
        onPress={onRemove}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="close-circle" size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity
        style={ib.resizeBtn}
        onPress={onResize}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="expand-outline" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const ib = StyleSheet.create({
  wrap: { position: 'relative', marginVertical: 8, alignSelf: 'flex-start' },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    padding: 3,
  },
  resizeBtn: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    padding: 3,
  },
});

// ─── Expense Queue Types ──────────────────────────────────────

type ExpenseQueueItem =
  | { type: 'add'; detected: DetectedExpense }
  | { type: 'remove'; existing: Expense };

// ─── Expense Confirm Sheet ────────────────────────────────────

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Transport',
  'Shopping',
  'Health',
  'Bills',
  'Other',
];

function ExpenseConfirmSheet({
  item,
  index,
  total,
  onAction,
}: {
  item: ExpenseQueueItem;
  index: number;
  total: number;
  onAction: (
    confirm: boolean,
    title: string,
    amount: number,
    category: ExpenseCategory,
    date: Date,
  ) => void;
}) {
  const c = useThemeColors();
  const { showAlert, AlertModal } = useAppAlert();
  const isAdd = item.type === 'add';
  const d = isAdd ? item.detected : null;
  const e = !isAdd ? item.existing : null;

  const [expTitle, setExpTitle] = useState(d?.title ?? e?.title ?? '');
  const [expAmount, setExpAmount] = useState(String(d?.amount ?? e?.amount ?? 0));
  const [expCategory, setExpCategory] = useState<ExpenseCategory>(
    d?.category ?? (e?.category as ExpenseCategory) ?? 'Other',
  );
  const [customCategory, setCustomCategory] = useState('');
  const [expDate, setExpDate] = useState<Date>(
    d?.date ? new Date(d.date) : e?.date ? new Date(e.date) : new Date(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  useEffect(() => {
    setExpTitle(d?.title ?? e?.title ?? '');
    setExpAmount(String(d?.amount ?? e?.amount ?? 0));
    setExpCategory(d?.category ?? (e?.category as ExpenseCategory) ?? 'Other');
    setCustomCategory('');
    setExpDate(d?.date ? new Date(d.date) : e?.date ? new Date(e.date) : new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const handleConfirm = () => {
    if (isAdd) {
      const amt = parseFloat(expAmount);
      if (!expTitle.trim() || isNaN(amt) || amt <= 0) {
        showAlert({
          type: 'error',
          title: 'Invalid Details',
          message: 'Please enter a valid title and amount for this expense.',
        });
        return;
      }
      if (expCategory === 'Other' && !customCategory.trim()) {
        showAlert({
          type: 'error',
          title: 'Category Required',
          message: 'Please enter a custom category name.',
        });
        return;
      }
      const finalCategory =
        expCategory === 'Other'
          ? (customCategory.trim() as ExpenseCategory)
          : expCategory;
      onAction(true, expTitle.trim(), amt, finalCategory, expDate);
    } else {
      onAction(
        true,
        e?.title ?? '',
        e?.amount ?? 0,
        (e?.category as ExpenseCategory) ?? 'Other',
        e?.date ? new Date(e.date) : new Date(),
      );
    }
  };

  const handleSkip = () => onAction(false, '', 0, 'Other', new Date());

  return (
    <>
      <Modal visible transparent animationType="slide" onRequestClose={handleSkip}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={ecs.overlay}>
            <View style={[ecs.sheet, { backgroundColor: c.surface }]}>
              <View style={[ecs.handle, { backgroundColor: c.border }]} />
              <View style={ecs.headerRow}>
                <View style={[ecs.iconCircle, { backgroundColor: isAdd ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Ionicons
                    name={isAdd ? 'wallet-outline' : 'trash-outline'}
                    size={22}
                    color={isAdd ? '#10B981' : '#EF4444'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ecs.title, { color: c.text }]}>
                    {isAdd ? 'Expense Detected' : 'Expense Removed?'}
                  </Text>
                  {total > 1 && (
                    <Text style={[ecs.subtitle, { color: c.textMuted }]}>
                      {index} of {total}
                    </Text>
                  )}
                </View>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {isAdd ? (
                  <>
                    {!!d?.snippet && (
                      <View style={[ecs.snippetBox, { backgroundColor: c.surface2 ?? c.inputBg }]}>
                        <Text style={[ecs.snippetText, { color: c.textSub }]}>
                          &ldquo;{d.snippet}&rdquo;
                        </Text>
                      </View>
                    )}
                    <Text style={[ecs.label, { color: c.textSub }]}>What was it for?</Text>
                    <TextInput
                      style={[
                        ecs.input,
                        { backgroundColor: c.inputBg, borderColor: c.border, color: c.text },
                      ]}
                      value={expTitle}
                      onChangeText={setExpTitle}
                      placeholder="Expense title"
                      placeholderTextColor={c.textMuted}
                    />
                    <Text style={[ecs.label, { color: c.textSub }]}>Amount (₹)</Text>
                    <TextInput
                      style={[
                        ecs.input,
                        { backgroundColor: c.inputBg, borderColor: c.border, color: c.text },
                      ]}
                      value={expAmount}
                      onChangeText={setExpAmount}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={c.textMuted}
                    />
                    <Text style={[ecs.label, { color: c.textSub }]}>Category</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={ecs.pillScroll}
                      keyboardShouldPersistTaps="handled"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            ecs.pill,
                            { borderColor: c.border },
                            expCategory === cat && ecs.pillActive,
                          ]}
                          onPress={() => setExpCategory(cat)}
                        >
                          <Text
                            style={[
                              ecs.pillText,
                              { color: expCategory === cat ? '#fff' : c.textSub },
                            ]}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {expCategory === 'Other' && (
                      <TextInput
                        style={[
                          ecs.input,
                          { backgroundColor: c.inputBg, borderColor: c.border, color: c.text },
                        ]}
                        value={customCategory}
                        onChangeText={setCustomCategory}
                        placeholder="Enter custom category *"
                        placeholderTextColor={c.textMuted}
                        autoFocus
                      />
                    )}
                    <Text style={[ecs.label, { color: c.textSub }]}>Date</Text>
                    <TouchableOpacity
                      style={[ecs.datePill, { backgroundColor: c.inputBg, borderColor: c.border }]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                      <Text style={[ecs.datePillText, { color: COLORS.primary }]}>
                        {expDate.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </TouchableOpacity>

                    {Platform.OS === 'ios' ? (
                      <IOSPickerModal
                        visible={showDatePicker}
                        value={expDate}
                        mode="date"
                        maximumDate={new Date()}
                        onCancel={() => setShowDatePicker(false)}
                        onDone={(d) => {
                          setShowDatePicker(false);
                          setExpDate(d);
                        }}
                      />
                    ) : (
                      showDatePicker && (
                        <DateTimePicker
                          value={expDate}
                          mode="date"
                          display="default"
                          maximumDate={new Date()}
                          onChange={(_, d) => {
                            setShowDatePicker(false);
                            if (d) setExpDate(d);
                          }}
                        />
                      )
                    )}
                  </>
                ) : (
                  <View style={[ecs.removeCard, { backgroundColor: c.surface2 ?? c.inputBg }]}>
                    <Text style={[ecs.removeTitle, { color: c.text }]}>{e?.title}</Text>
                    <Text style={[ecs.removeAmount, { color: '#EF4444' }]}>₹{e?.amount}</Text>
                    <Text style={[ecs.removeHint, { color: c.textMuted }]}>
                      This expense is no longer mentioned in your note.
                    </Text>
                  </View>
                )}
              </ScrollView>

              <View style={ecs.btnRow}>
                <TouchableOpacity
                  style={[ecs.btnSkip, { borderColor: c.border }]}
                  onPress={handleSkip}
                >
                  <Text style={[ecs.btnSkipText, { color: c.textSub }]}>
                    {isAdd ? 'Skip' : 'Keep'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ecs.btnAdd, { backgroundColor: isAdd ? '#10B981' : '#EF4444' }]}
                  onPress={handleConfirm}
                >
                  <Text style={ecs.btnAddText}>{isAdd ? 'Add to Expenses' : 'Remove'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {AlertModal}
    </>
  );
}

const ecs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  snippetBox: { borderRadius: 10, padding: 12, marginBottom: 16 },
  snippetText: { fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  pillScroll: { marginBottom: 20 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 8,
  },
  pillActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  pillText: { fontSize: 13, fontWeight: '600' },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  datePillText: { fontSize: 14, fontWeight: '600' },
  removeCard: { borderRadius: 14, padding: 16, marginBottom: 20, gap: 6 },
  removeTitle: { fontSize: 16, fontWeight: '700' },
  removeAmount: { fontSize: 22, fontWeight: '800' },
  removeHint: { fontSize: 13 },
  btnRow: { flexDirection: 'row', gap: 12 },
  btnSkip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSkipText: { fontSize: 15, fontWeight: '600' },
  btnAdd: { flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnAddText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ─── Color Picker ─────────────────────────────────────────────

function ColorPicker({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (c: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cp.overlay} activeOpacity={1} onPress={onClose} />
      <View style={cp.box}>
        <Text style={cp.label}>Note color</Text>
        <View style={cp.swatches}>
          {NOTE_COLOR_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[cp.swatch, { backgroundColor: c }, selected === c && cp.swatchActive]}
              onPress={() => {
                onSelect(c);
                onClose();
              }}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const cp = StyleSheet.create({
  overlay: { flex: 1 },
  box: {
    position: 'absolute',
    bottom: 130,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  label: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textAlign: 'center' },
  swatches: { flexDirection: 'row', gap: 8 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderColor: '#6c7076', borderWidth: 1 },
  swatchActive: { borderWidth: 3, borderColor: '#090a0e' },
});

// ─── Helpers ──────────────────────────────────────────────────

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

// ─── Main Screen ──────────────────────────────────────────────

export default function NoteEditorScreen() {
  const insets = useSafeAreaInsets();
  const { id, category: initialCategory } = useLocalSearchParams<{
    id?: string;
    category?: string;
  }>();
  const router = useRouter();
  const { showAlert, AlertModal } = useAppAlert();
  const { notes, createNote, updateNote } = useNotesStore();
  const { expenses, createExpense, deleteExpense } = useExpenseStore();
  const setHomeSegment = useHomeStore((s) => s.setHomeSegment);
  const isDark = useIsDark();

  const existingNote: Note | undefined = id ? notes.find((n) => n.id === id) : undefined;
  const isNew = !existingNote;

  const defaultColor = isDark ? '#000000' : '#FFFFFF';

  const [title, setTitle] = useState(existingNote?.title ?? noteDraft.title);
  const [color, setColor] = useState(existingNote?.color ?? (noteDraft.color || defaultColor));
  const [category, setCategory] = useState(
    existingNote?.category ?? initialCategory ?? noteDraft.category,
  );

  // ── Block state ──────────────────────────────────────────────
  const [blocks, setBlocks] = useState<NoteBlock[]>(() =>
    loadBlocks(existingNote, isNew ? (noteDraft.blocks as NoteBlock[] | null) : null),
  );
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [resizingBlock, setResizingBlock] = useState<ImageBlock | null>(null);

  const [isLocked, setIsLocked] = useState(existingNote?.isLocked ?? false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [catVisible, setCatVisible] = useState(false);
  const [colorVisible, setColorVisible] = useState(false);
  const [autoDetectExpense, setAutoDetectExpense] = useState(true);
  const [expenseQueue, setExpenseQueue] = useState<ExpenseQueueItem[]>([]);
  const totalDetectedRef = useRef(0);
  const pendingExpensesRef = useRef<
    { title: string; amount: number; category: ExpenseCategory; date: Date }[]
  >([]);
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!existingNote) setTimeout(() => titleRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  // Keep draft in sync (new notes only)
  useEffect(() => {
    if (isNew) noteDraft.title = title;
  }, [title, isNew]);
  useEffect(() => {
    if (isNew) noteDraft.color = color;
  }, [color, isNew]);
  useEffect(() => {
    if (isNew) noteDraft.category = category;
  }, [category, isNew]);
  useEffect(() => {
    if (isNew) noteDraft.blocks = blocks;
  }, [blocks, isNew]);

  // ── Dirty check ──────────────────────────────────────────────
  const originalBlocks = loadBlocks(existingNote, null);
  const isDirty =
    isNew ||
    title !== (existingNote?.title ?? '') ||
    color !== existingNote?.color ||
    category !== (existingNote?.category ?? '') ||
    isLocked !== (existingNote?.isLocked ?? false) ||
    JSON.stringify(blocks) !== JSON.stringify(originalBlocks);

  // ── Block helpers ─────────────────────────────────────────────
  const updateBlock = useCallback((blockId: string, patch: Partial<NoteBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? ({ ...b, ...patch } as NoteBlock) : b)),
    );
  }, []);

  const removeBlock = useCallback((blockId: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx === -1) return prev;
      const block = prev[idx];
      // Delete image from MinIO if it's a MinIO-hosted URL
      if (block?.type === 'image' && block.uri.includes('/notes-images/')) {
        notesApi.deleteImage(block.uri).catch(() => {});
      }
      const next = [...prev];
      next.splice(idx, 1);
      // Remove the empty text separator that was inserted right after the image.
      // Without this, deleting an image leaves two adjacent text blocks both
      // showing "Write here…" as placeholders.
      if (
        next[idx]?.type === 'text' &&
        (next[idx] as TextBlock).text === '' &&
        next[idx - 1]?.type === 'text'
      ) {
        next.splice(idx, 1);
      }
      return next.length === 0 ? [{ type: 'text', id: uid(), text: '' }] : next;
    });
  }, []);

  // ── Save ──────────────────────────────────────────────────────
  const doSave = useCallback(async (): Promise<string | null> => {
    const t = title.trim();
    setSaving(true);
    try {
      // Strip empty text blocks before saving — no point storing {"type":"text","text":""}
      // objects in the DB. Only keep image blocks and text blocks with actual content.
      const saveBlocks = blocks.filter(
        (b) => b.type === 'image' || (b.type === 'text' && b.text.trim() !== ''),
      );
      const textContent = saveBlocks.length > 0 ? JSON.stringify(saveBlocks) : '';
      if (existingNote) {
        await updateNote(existingNote.id, { title: t, content: textContent, color, category, isLocked });
        setHomeSegment('notes');
        router.replace('/(tabs)/home');
        return existingNote.id;
      } else {
        const note = await createNote({ title: t, content: textContent, color, category, isLocked });
        clearNoteDraft();
        setHomeSegment('notes');
        router.replace('/(tabs)/home');
        return note.id;
      }
    } catch {
      showAlert({
        type: 'info',
        title: 'Something Went Wrong',
        message: 'Unable to save the note. Please try again.',
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, [
    title,
    blocks,
    color,
    category,
    isLocked,
    existingNote,
    createNote,
    updateNote,
    router,
    setHomeSegment,
    showAlert,
  ]);

  // ── Expense queue ─────────────────────────────────────────────
  const advanceQueue = useCallback(
    (
      confirm: boolean,
      item: ExpenseQueueItem,
      expTitle: string,
      amount: number,
      cat: ExpenseCategory,
      expDate: Date,
    ) => {
      if (!autoDetectExpense) return null;
      if (item.type === 'add' && confirm)
        pendingExpensesRef.current.push({ title: expTitle, amount, category: cat, date: expDate });
      if (item.type === 'remove' && confirm) deleteExpense(item.existing.id);
      setExpenseQueue((prev) => {
        const remaining = prev.slice(1);
        if (remaining.length === 0) {
          doSave().then((savedNoteId) => {
            for (const exp of pendingExpensesRef.current) {
              createExpense({
                title: exp.title,
                amount: exp.amount,
                category: exp.category,
                date: exp.date.toISOString().slice(0, 10),
                noteId: savedNoteId ?? null,
                source: 'note',
              });
            }
            pendingExpensesRef.current = [];
          });
        }
        return remaining;
      });
    },
    [autoDetectExpense, doSave, createExpense, deleteExpense],
  );

  const handleSave = useCallback(async () => {
    
    const t = title.trim();
    if (!t) {
      showAlert({
        type: 'error',
        title: 'Title Required',
        message: 'Please add a title before saving.',
      });
      return;
    }
    if(autoDetectExpense){
    setDetecting(true);
    try {
      const allText = blocks
        .filter((b): b is TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      const detected = await detectAllExpenses(t + '\n' + allText);
      const noteExpenses = existingNote ? expenses.filter((e) => e.noteId === existingNote.id) : [];

      const toRemove: ExpenseQueueItem[] = noteExpenses
        .filter((e) => !detected.some((d) => d.amount === e.amount && d.category === e.category))
        .map((e) => ({ type: 'remove' as const, existing: e }));
      const toAdd: ExpenseQueueItem[] = detected
        .filter(
          (d) => !noteExpenses.some((e) => e.amount === d.amount && e.category === d.category),
        )
        .map((d) => ({ type: 'add' as const, detected: d }));

      const queue = [...toAdd, ...toRemove];
      if (queue.length > 0) {
        totalDetectedRef.current = queue.length;
        setExpenseQueue(queue);
        return;
      }
    } finally {
      setDetecting(false);
    }}
    await doSave();
  }, [title, blocks, existingNote, expenses, doSave, showAlert]);

  // ── Image picker ──────────────────────────────────────────────
  const [uploadingImage, setUploadingImage] = useState(false);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert({
        type: 'permission',
        title: 'Photo Access Required',
        message: 'Allow access to your photo library to attach images.',
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (!result.canceled && result.assets.length > 0) {
      setUploadingImage(true);
      const newBlocks: NoteBlock[] = [];
      let failed = 0;
      for (const asset of result.assets) {
        try {
          const ext = asset.uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpeg';
          const mimeType = asset.mimeType ?? (ext === 'jpg' ? 'image/jpeg' : `image/${ext}`);
          const filename = `image-${Date.now()}.${ext}`;
          // First request in a session can fail due to connection cold-start — retry once silently
          let url: string;
          try {
            url = await notesApi.uploadImage(asset.uri, mimeType, filename);
          } catch {
            await new Promise((r) => setTimeout(r, 800));
            url = await notesApi.uploadImage(asset.uri, mimeType, filename);
          }
          newBlocks.push({ type: 'image', id: uid(), uri: url, widthPct: 100, height: 200 });
          newBlocks.push({ type: 'text', id: uid(), text: '' });
        } catch (err) {
          console.error('[ImageUpload] failed:', err);
          failed++;
        }
      }
      setUploadingImage(false);
      if (newBlocks.length === 0) {
        showAlert({
          type: 'error',
          title: 'Upload Failed',
          message: 'Could not upload image. Check your connection and try again.',
        });
        return;
      }
      if (failed > 0) {
        showAlert({
          type: 'error',
          title: 'Some Images Failed',
          message: `${failed} image(s) could not be uploaded.`,
        });
      }
      setBlocks((prev) => {
        const insertIdx = focusedBlockId
          ? prev.findIndex((b) => b.id === focusedBlockId) + 1
          : prev.length;
        const next = [...prev];
        next.splice(insertIdx, 0, ...newBlocks);
        return next;
      });
    }
  }, [showAlert, focusedBlockId]);

  // ── Theme ─────────────────────────────────────────────────────
  const isLight = isLightColor(color);
  const onNote = isLight ? '#1E293B' : '#F1F5F9';
  const onNoteSub = isLight ? '#475569' : '#94A3B8';
  const onNoteFaint = isLight ? 'rgba(30,41,59,0.35)' : 'rgba(241,245,249,0.4)';
  const onNoteBodyFaint = isLight ? 'rgba(71,85,105,0.5)' : 'rgba(148,163,184,0.5)';
  const doneBg = isLight ? '#1E293B' : '#F1F5F9';
  const doneTxtColor = isLight ? '#fff' : '#1E293B';
  const toolbarBg = isLight ? 'rgba(255,255,255,0.82)' : 'rgba(30,41,59,0.88)';
  const toolIconColor = isLight ? '#475569' : '#94A3B8';
  const dividerColor = isLight ? 'rgba(30,41,59,0.12)' : 'rgba(241,245,249,0.15)';

  const catInfo = CATEGORIES.find((c) => c.label === category);

  return (
    <View style={[s.safe, { backgroundColor: color, paddingTop: insets.top }]}>
      <View style={[s.blob, s.blob1]} />
      <View style={[s.blob, s.blob2]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={onNote} />
          </TouchableOpacity>
          <View style={s.headerRight}>
            {biometricAvailable && (
              <TouchableOpacity
                onPress={() => setIsLocked((v) => !v)}
                style={[
                  s.lockToggleBtn,
                  isLocked
                    ? { backgroundColor: doneBg }
                    : { backgroundColor: 'rgba(0,0,0,0.08)' },
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={isLocked ? 'lock-closed' : 'lock-open-outline'}
                  size={18}
                  color={isLocked ? doneTxtColor : onNoteSub}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSave}
              style={[
                s.doneBtn,
                { backgroundColor: doneBg },
                (!isDirty || saving || detecting) && { opacity: 0.4 },
              ]}
              disabled={saving || detecting || !isDirty}
              activeOpacity={0.8}
            >
              {saving || detecting ? (
                <ActivityIndicator size="small" color={doneTxtColor} />
              ) : (
                <Text style={[s.doneTxt, { color: doneTxtColor }]}>{isNew ? 'Done' : 'Save'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Editor */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            ref={titleRef}
            style={[s.titleInput, { color: onNote }]}
            placeholder="Untitled Note"
            placeholderTextColor={onNoteFaint}
            value={title}
            onChangeText={setTitle}
            maxLength={50}
            multiline
            returnKeyType="next"
          />
          <Text style={[s.charCount, { color: title.length >= 40 ? '#EF4444' : onNoteFaint }]}>
            {title.length}/50
          </Text>
          <View style={[s.divider, { backgroundColor: dividerColor }]} />

          {/* Blocks */}
          {blocks.map((block) =>
            block.type === 'text' ? (
              <TextInput
                key={block.id}
                style={[s.bodyInput, { color: onNoteSub }]}
                placeholder="Write here…"
                placeholderTextColor={onNoteBodyFaint}
                value={block.text}
                onChangeText={(t) => updateBlock(block.id, { text: t })}
                onFocus={() => setFocusedBlockId(block.id)}
                multiline
                textAlignVertical="top"
                maxLength={5000}
              />
            ) : (
              <ImageBlockView
                key={block.id}
                block={block}
                onRemove={() => removeBlock(block.id)}
                onResize={() => setResizingBlock(block)}
              />
            ),
          )}
        </ScrollView>

        {/* Toolbar */}
        <View style={[s.toolbarWrap, { bottom: insets.bottom + 2 }]}>
          {/* Auto-detect toggle pill */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setAutoDetectExpense((v) => !v)}
            style={[s.togglePill, { backgroundColor: toolbarBg, borderColor: autoDetectExpense ? COLORS.primary : dividerColor }]}
          >
            <Ionicons
              name={autoDetectExpense ? 'wallet' : 'wallet-outline'}
              size={14}
              color={autoDetectExpense ? COLORS.primary : toolIconColor}
            />
            <Text style={[s.toggleLabel, { color: autoDetectExpense ? COLORS.primary : toolIconColor }]}>
              Auto-detect expenses
            </Text>
            {/* Custom toggle track */}
            <View style={[s.toggleTrack, { backgroundColor: autoDetectExpense ? COLORS.primary : '#CBD5E1' }]}>
              <View style={[s.toggleThumb, { alignSelf: autoDetectExpense ? 'flex-end' : 'flex-start' }]} />
            </View>
          </TouchableOpacity>
          <View style={[s.toolbar, { backgroundColor: toolbarBg }]}>
            <View style={s.toolbarLeft}>
              <TouchableOpacity
                style={s.toolIcon}
                activeOpacity={0.7}
                onPress={handlePickImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color={toolIconColor} />
                ) : (
                  <Ionicons name="image-outline" size={22} color={toolIconColor} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setColorVisible(true)}
                style={[s.colorDot, { backgroundColor: color }]}
                activeOpacity={0.8}
              />
            </View>
            <View
              style={[
                s.toolDivider,
                { backgroundColor: isLight ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.4)' },
              ]}
            />
            <TouchableOpacity
              style={s.catBadge}
              onPress={() => setCatVisible(true)}
              activeOpacity={0.75}
            >
              <Ionicons name={catInfo?.icon ?? 'pricetag-outline'} size={14} color="#fff" />
              <Text style={s.catLabel}>{category}</Text>
              <Ionicons name="chevron-down" size={12} color="#fff" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <CategorySheet
        visible={catVisible}
        selected={category}
        onSelect={setCategory}
        onClose={() => setCatVisible(false)}
      />
      <ColorPicker
        visible={colorVisible}
        selected={color}
        onSelect={setColor}
        onClose={() => setColorVisible(false)}
      />

      {resizingBlock && (
        <ResizeSheet
          block={resizingBlock}
          onUpdate={(widthPct, height) => {
            updateBlock(resizingBlock.id, { widthPct, height });
            setResizingBlock(null);
          }}
          onClose={() => setResizingBlock(null)}
        />
      )}

      {autoDetectExpense && expenseQueue.length > 0 && (
        <ExpenseConfirmSheet
          item={expenseQueue[0]}
          index={totalDetectedRef.current - expenseQueue.length + 1}
          total={totalDetectedRef.current}
          onAction={(confirm, t, amt, cat, date) =>
            advanceQueue(confirm, expenseQueue[0], t, amt, cat, date)
          }
        />
      )}
      {AlertModal}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 300, opacity: 0.18 },
  blob1: { width: 260, height: 260, backgroundColor: '#A5F3FC', top: -60, left: -60 },
  blob2: { width: 220, height: 220, backgroundColor: '#BAE6FD', bottom: 120, right: -40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockToggleBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: 'rgba(0,0,0,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  doneBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  doneTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 140 },

  titleInput: { fontSize: 30, fontWeight: '700', lineHeight: 38, marginBottom: 10 },
  divider: { height: 1.5, marginBottom: 14 },
  bodyInput: { fontSize: 16, lineHeight: 26, minHeight: 60 },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 2,
    marginBottom: 4,
    paddingHorizontal: 4,
  },

  toolbarWrap: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 32,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    gap: 4,
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  toolDivider: { width: 1, height: 24, marginHorizontal: 8 },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0EA5E9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  catLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },

  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    marginBottom: 8,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  toggleLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  toggleTrack: {
    width: 40,
    height: 22,
    borderRadius: 11,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});

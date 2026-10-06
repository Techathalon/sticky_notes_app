import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAppAlert } from '../../components/AppAlert';
import { GradientScreen } from '../../components/GradientScreen';
import { EmptyState } from '../../components/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useExpenseStore, type Expense, type ExpenseCategory } from '../../store/expenseStore';
import { useBudgetStore } from '../../store/budgetStore';
import { useThemeColors } from '../../store/themeStore';
import { COLORS } from '../../constants/colors';
import { router } from 'expo-router';
import { IOSPickerModal } from '@/components/IOSPickerModal';

// ─── Category meta ────────────────────────────────────────────

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CAT_META: Record<ExpenseCategory, { icon: IoniconName; color: string; bg: string }> = {
  Food: { icon: 'fast-food-outline', color: '#F59E0B', bg: '#FFFBEB' },
  Transport: { icon: 'car-outline', color: '#3B82F6', bg: '#EFF6FF' },
  Shopping: { icon: 'bag-outline', color: '#EC4899', bg: '#FDF2F8' },
  Health: { icon: 'fitness-outline', color: '#10B981', bg: '#ECFDF5' },
  Bills: { icon: 'receipt-outline', color: '#8B5CF6', bg: '#F5F3FF' },
  Other: { icon: 'ellipsis-horizontal-outline', color: '#64748B', bg: '#F8FAFC' },
};

const CATEGORIES = Object.keys(CAT_META) as ExpenseCategory[];

// ─── Helpers ──────────────────────────────────────────────────

function fmtAmount(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type ListItem =
  | { kind: 'dateHeader'; date: string; total: number }
  | { kind: 'expense'; data: Expense };

function buildDateGroupedItems(expenses: Expense[]): ListItem[] {
  const byDate = new Map<string, Expense[]>();
  [...expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((e) => {
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date)!.push(e);
    });
  const items: ListItem[] = [];
  byDate.forEach((exps, date) => {
    items.push({ kind: 'dateHeader', date, total: exps.reduce((s, e) => s + e.amount, 0) });
    exps.forEach((e) => items.push({ kind: 'expense', data: e }));
  });
  return items;
}

function filterExpenses(
  expenses: Expense[],
  from: Date | null,
  to: Date | null,
  cat: ExpenseCategory | null,
): Expense[] {
  return expenses.filter((e) => {
    if (cat && e.category !== cat) return false;
    const [y, m, d] = e.date.split('-');
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (from) {
      const f = new Date(from);
      f.setHours(0, 0, 0, 0);
      if (date < f) return false;
    }
    if (to) {
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      if (date > t) return false;
    }
    return true;
  });
}

// ─── Set Budget Modal ─────────────────────────────────────────

function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
}

function addMonths(m: string, delta: number): string {
  const [y, mo] = m.split('-');
  const d = new Date(Number(y), Number(mo) - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function SetBudgetModal({ initialMonth, onClose }: { initialMonth: string; onClose: () => void }) {
  const c = useThemeColors();
  const { showAlert, AlertModal } = useAppAlert();
  const { getBudgetForMonth, fetchBudgetForMonth, setBudgetForMonth } = useBudgetStore();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(initialMonth);
  const [value, setValue] = useState(() => {
    const existing = getBudgetForMonth(initialMonth);
    return existing > 0 ? String(existing) : '';
  });

  useEffect(() => {
    fetchBudgetForMonth(month).then(() => {
      const existing = getBudgetForMonth(month);
      setValue(existing > 0 ? String(existing) : '');
    });
  }, [month, fetchBudgetForMonth, getBudgetForMonth]);

  const changeMonth = (delta: number) => {
    setMonth(addMonths(month, delta));
  };

  const save = async () => {
    const amt = parseFloat(value);
    if (!value || isNaN(amt) || amt <= 0) {
      showAlert({
        type: 'error',
        title: 'Invalid Budget',
        message: 'Please enter a valid budget amount greater than zero.',
      });
      return;
    }
    await setBudgetForMonth(month, amt);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={ms.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[ms.sheet, { backgroundColor: c.surface }]}>
          <View style={[ms.handle, { backgroundColor: c.border }]} />
          <Text style={[ms.title, { color: c.text }]}>Set Budget</Text>

          {/* Month navigator */}
          <View style={ms.monthNav}>
            <TouchableOpacity
              onPress={() => changeMonth(-1)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color={c.textSub} />
            </TouchableOpacity>
            <Text style={[ms.monthLabel, { color: c.text }]}>{fmtMonth(month)}</Text>
            <TouchableOpacity
              onPress={() => changeMonth(1)}
              disabled={month >= currentMonth}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={month >= currentMonth ? c.textMuted : c.textSub}
              />
            </TouchableOpacity>
          </View>

          <Text style={[ms.label, { color: c.textSub }]}>Budget for {fmtMonth(month)} (₹)</Text>
          <TextInput
            style={[ms.input, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
            placeholder="e.g. 10000"
            placeholderTextColor={c.textMuted}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            maxLength={10}
            autoFocus
          />
          <View style={ms.btns}>
            <TouchableOpacity style={[ms.cancelBtn, { borderColor: c.border }]} onPress={onClose}>
              <Text style={[ms.cancelBtnText, { color: c.textSub }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.saveBtn} onPress={save}>
              <Text style={ms.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      {AlertModal}
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

export default function ExpenseScreen() {
  const c = useThemeColors();
  const { showAlert, AlertModal } = useAppAlert();
  const { expenses, fetchExpenses, deleteExpense } = useExpenseStore();
  const { getBudgetForMonth, fetchBudgetForMonth } = useBudgetStore();

  useFocusEffect(
    useCallback(() => {
      fetchExpenses();
    }, [fetchExpenses]),
  );

  const currentMonth = new Date().toISOString().slice(0, 7);

  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const budgetMonth = fromDate
    ? `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`
    : currentMonth;
  const monthBudget = getBudgetForMonth(budgetMonth);

  useEffect(() => {
    fetchBudgetForMonth(budgetMonth);
  }, [budgetMonth, fetchBudgetForMonth]);

  const today = new Date();
  const endOfFromMonth = fromDate
    ? new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0)
    : today;
  // "To" picker must never allow future dates — cap at today even when fromDate's month extends past today
  const maxToDate = endOfFromMonth < today ? endOfFromMonth : today;
  const [catFilter, setCatFilter] = useState<ExpenseCategory | null>(null);
  const [showBudget, setShowBudget] = useState(false);

  // Scope everything to budgetMonth first, then apply date/category filters on top
  const monthExpenses = expenses.filter((e) => e.date.startsWith(budgetMonth));
  const filtered = filterExpenses(monthExpenses, fromDate, toDate, catFilter);
  const listData = buildDateGroupedItems(filtered);
  const totalSpent = filtered.reduce((sum, e) => sum + e.amount, 0);

  // Budget card always shows full month total (ignores date/category filters)
  const monthSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const budgetPct = monthBudget > 0 ? Math.min(monthSpent / monthBudget, 1) : 0;
  const barColor = budgetPct < 0.7 ? '#22C55E' : budgetPct < 0.9 ? '#F59E0B' : '#EF4444';
  const remaining = monthBudget - monthSpent;

  const catTotals = CATEGORIES.map((cat) => ({
    cat,
    total: filtered.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0),
  }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);

  const maxCat = catTotals[0]?.total ?? 1;
  const hasFilter = !!(fromDate || toDate || catFilter);

  const ListHeader = (
    <>
      {/* Budget card */}
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <View style={s.cardHeader}>
          <Text style={[s.cardTitle, { color: c.text }]}>Budget · {fmtMonth(budgetMonth)}</Text>
          <TouchableOpacity onPress={() => setShowBudget(true)}>
            <Text style={[s.editBudgetBtn, { color: COLORS.primary }]}>
              {monthBudget > 0 ? 'Edit' : 'Set Budget'}
            </Text>
          </TouchableOpacity>
        </View>
        {monthBudget > 0 ? (
          <>
            <Text style={[s.spentLabel, { color: c.textSub }]}>
              <Text style={[s.spentAmount, { color: c.text }]}>₹{fmtAmount(monthSpent)}</Text> spent
              of ₹{fmtAmount(monthBudget)}
            </Text>
            <View style={[s.progressTrack, { backgroundColor: c.surface2 }]}>
              <View
                style={[
                  s.progressFill,
                  { width: `${budgetPct * 100}%` as any, backgroundColor: barColor },
                ]}
              />
            </View>
            <View style={s.budgetMeta}>
              <Text style={[s.budgetMetaText, { color: barColor }]}>
                {Math.round(budgetPct * 100)}% used
              </Text>
              <Text style={[s.budgetMetaText, { color: c.textMuted }]}>
                {remaining >= 0
                  ? `₹${fmtAmount(remaining)} left`
                  : `₹${fmtAmount(Math.abs(remaining))} over budget`}
              </Text>
            </View>
          </>
        ) : (
          <TouchableOpacity onPress={() => setShowBudget(true)}>
            <Text style={[s.noBudget, { color: c.textMuted }]}>
              No budget set — tap Set Budget to add one
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category breakdown card */}
      {catTotals.length > 0 && (
        <View style={[s.card, { backgroundColor: c.surface }]}>
          <Text style={[s.cardTitle, { color: c.text }]}>By Category</Text>
          {catTotals.map(({ cat, total }) => {
            const meta = CAT_META[cat];
            const pct = total / maxCat;
            return (
              <View key={cat} style={s.catRow}>
                <View style={[s.catIcon, { backgroundColor: meta.color + '20' }]}>
                  <Ionicons name={meta.icon} size={15} color={meta.color} />
                </View>
                <Text style={[s.catLabel, { color: c.textSub }]}>{cat}</Text>
                <View style={[s.miniTrack, { backgroundColor: c.surface2 }]}>
                  <View
                    style={[
                      s.miniFill,
                      { width: `${pct * 100}%` as any, backgroundColor: meta.color },
                    ]}
                  />
                </View>
                <Text style={[s.catAmount, { color: c.text }]}>₹{fmtAmount(total)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {filtered.length > 0 && (
        <Text style={[s.listHeader, { color: c.textSub }]}>
          Expenses{'  '}
          <Text style={{ color: COLORS.primary }}>{filtered.length}</Text>
        </Text>
      )}
    </>
  );

  return (
    <GradientScreen style={s.root}>
      <View style={[s.header, { borderBottomColor: c.hairline }]}>
        <Text style={[s.headerTitle, { color: c.text }]}>Expenses</Text>
        <Text style={[s.headerSub, { color: c.textMuted }]}>₹{fmtAmount(totalSpent)} total</Text>
      </View>

      {/* From → To date filter — sticky */}
      <View style={[s.filterBar, { backgroundColor: c.surface }]}>
        <TouchableOpacity
          style={[
            s.datePill,
            { borderColor: fromDate ? COLORS.primary : c.border, backgroundColor: c.inputBg },
          ]}
          onPress={() => setShowFromPicker(true)}
        >
          <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
          <Text style={[s.datePillText, { color: fromDate ? c.text : c.textMuted }]}>
            {fromDate ? fmtDate(dateToStr(fromDate)) : 'From'}
          </Text>
        </TouchableOpacity>

        <Ionicons name="arrow-forward" size={14} color={c.textMuted} />

        <TouchableOpacity
          style={[
            s.datePill,
            { borderColor: toDate ? COLORS.primary : c.border, backgroundColor: c.inputBg },
          ]}
          onPress={() => setShowToPicker(true)}
        >
          <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
          <Text style={[s.datePillText, { color: toDate ? c.text : c.textMuted }]}>
            {toDate ? fmtDate(dateToStr(toDate)) : 'To'}
          </Text>
        </TouchableOpacity>

        {hasFilter && (
          <TouchableOpacity
            onPress={() => {
              setFromDate(null);
              setToDate(null);
              setCatFilter(null);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={22} color={c.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {Platform.OS === 'ios' ? (
        <>
          <IOSPickerModal
            visible={showFromPicker}
            mode="date"
            value={fromDate ?? new Date()}
            maximumDate={toDate ?? new Date()}
            onCancel={() => setShowFromPicker(false)}
            onDone={(d) => {
              setShowFromPicker(false);
              setFromDate(d);
              if (
                toDate &&
                (toDate.getMonth() !== d.getMonth() ||
                  toDate.getFullYear() !== d.getFullYear() ||
                  d > toDate)
              ) {
                setToDate(null);
              }
            }}
          />
          <IOSPickerModal
            visible={showToPicker}
            mode="date"
            value={toDate ?? maxToDate}
            minimumDate={fromDate ?? undefined}
            maximumDate={maxToDate}
            onCancel={() => setShowToPicker(false)}
            onDone={(d) => {
              setShowFromPicker(false);
              if (fromDate && d < fromDate) setFromDate(null);
              setToDate(d);
            }}
          />
        </>
      ) : (
        <>
          {showFromPicker && (
            <DateTimePicker
              value={fromDate ?? new Date()}
              mode="date"
              display="default"
              maximumDate={toDate ?? new Date()}
              onChange={(_, d) => {
                setShowFromPicker(false);
                if (d) {
                  setFromDate(d);
                  if (
                    toDate &&
                    (toDate.getMonth() !== d.getMonth() ||
                      toDate.getFullYear() !== d.getFullYear() ||
                      d > toDate)
                  ) {
                    setToDate(null);
                  }
                }
              }}
            />
          )}
          {showToPicker && (
            <DateTimePicker
              value={toDate ?? maxToDate}
              mode="date"
              display="default"
              minimumDate={fromDate ?? undefined}
              maximumDate={maxToDate}
              onChange={(_, d) => {
                setShowToPicker(false);
                if (d) {
                  if (fromDate && d < fromDate) setFromDate(null);
                  setToDate(d);
                }
              }}
            />
          )}
        </>
      )}

      {/* Category filter — sticky */}
      <View style={{ height: 52 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={s.catFilterScroll}
        >
          {([null, ...CATEGORIES] as (ExpenseCategory | null)[]).map((cat) => {
            const active = catFilter === cat;
            const meta = cat ? CAT_META[cat] : null;
            return (
              <TouchableOpacity
                key={cat ?? 'all'}
                style={[
                  s.catFilterPill,
                  { backgroundColor: c.surface, borderColor: c.border },
                  active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                ]}
                onPress={() => setCatFilter(cat)}
              >
                {meta && (
                  <Ionicons name={meta.icon} size={13} color={active ? '#fff' : c.textSub} />
                )}
                <Text
                  style={[
                    s.catFilterText,
                    { color: active ? '#fff' : c.textSub, fontWeight: active ? '700' : '500' },
                  ]}
                >
                  {cat ?? 'All'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={listData}
        keyExtractor={(item, i) =>
          item.kind === 'dateHeader' ? `dh-${item.date}` : item.data.id + i
        }
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={<EmptyState variant="default" message="No expenses found" />}
        renderItem={({ item }) => {
          if (item.kind === 'dateHeader') {
            return (
              <View style={[s.dateHeader, { borderBottomColor: c.hairline }]}>
                <Text style={[s.dateHeaderText, { color: c.textSub }]}>{fmtDate(item.date)}</Text>
                <Text style={[s.dateHeaderAmount, { color: c.text }]}>
                  ₹{fmtAmount(item.total)}
                </Text>
              </View>
            );
          }
          const { data: exp } = item;
          const meta = CAT_META[exp.category as ExpenseCategory] ?? CAT_META['Other'];
          return (
            <View style={[s.expenseRow, { backgroundColor: c.surface }]}>
              <View style={[s.expIcon, { backgroundColor: meta.color + '20' }]}>
                <Ionicons name={meta.icon} size={18} color={meta.color} />
              </View>
              <View style={s.expInfo}>
                <Text style={[s.expTitle, { color: c.text }]} numberOfLines={1}>
                  {exp.title}
                </Text>
                <Text style={[s.expMeta, { color: c.textMuted }]}>
                  {exp.category} · {fmtDate(exp.date)}
                </Text>
              </View>
              <Text style={[s.expAmount, { color: c.text }]}>₹{fmtAmount(exp.amount)}</Text>
              <TouchableOpacity
                onPress={() => router.push(`/expense-editor?id=${exp.id}`)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginRight: 4 }}
              >
                <Ionicons name="pencil-outline" size={17} color={c.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  showAlert({
                    type: 'confirm',
                    title: 'Delete Expense',
                    message: `Are you sure you want to delete "${exp.title}"? This cannot be undone.`,
                    buttons: [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => deleteExpense(exp.id),
                      },
                    ],
                  })
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={17} color="#EF4444" />
              </TouchableOpacity>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      {showBudget && (
        <SetBudgetModal initialMonth={budgetMonth} onClose={() => setShowBudget(false)} />
      )}
      {AlertModal}
    </GradientScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent',marginBottom:4 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSub: { fontSize: 13, fontWeight: '500' },

  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    flex: 1,
  },
  datePillText: { fontSize: 13, fontWeight: '600' },

  catFilterScroll: { paddingHorizontal: 16, paddingVertical: 10 },
  catFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 8,
  },
  catFilterText: { fontSize: 12 },

  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  dateHeaderText: { fontSize: 13, fontWeight: '600' },
  dateHeaderAmount: { fontSize: 13, fontWeight: '700' },

  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  editBudgetBtn: { fontSize: 13, fontWeight: '700' },

  spentLabel: { fontSize: 13, marginBottom: 10 },
  spentAmount: { fontSize: 20, fontWeight: '800' },
  progressTrack: { height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 5 },
  budgetMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetMetaText: { fontSize: 12, fontWeight: '600' },
  noBudget: { fontSize: 13, fontStyle: 'italic', marginTop: 4 },

  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  catIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: { width: 72, fontSize: 13, fontWeight: '500' },
  miniTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: 3 },
  catAmount: { fontSize: 13, fontWeight: '700', minWidth: 70, textAlign: 'right' },

  listHeader: { fontSize: 13, fontWeight: '600', paddingHorizontal: 16, marginBottom: 6 },
  list: { paddingBottom: 120 },

  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  expIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expInfo: { flex: 1 },
  expTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  expMeta: { fontSize: 12 },
  expAmount: { fontSize: 15, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyText: { fontSize: 14, fontWeight: '500' },
});

const ms = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  btns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  monthLabel: { fontSize: 16, fontWeight: '700' },
});

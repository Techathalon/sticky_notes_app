import { StyleSheet, Platform, Dimensions } from 'react-native';
import { COLORS } from '../../constants/colors';
import { toLocalDateStr } from '../../utils/dateUtils';
import type { TodoStatus, TodoPriority } from '@repo/types';

const { width } = Dimensions.get('window');
export const CARD_WIDTH = (width - 48) / 2;
export const ROTATIONS = ['-2.5deg', '2deg', '-1.5deg', '3deg', '-2deg', '1.5deg'];

export const STATUS_META: Record<TodoStatus, { label: string; color: string }> = {
  TODO:        { label: 'To Do',       color: '#94A3B8' },
  IN_PROGRESS: { label: 'In Progress', color: '#3B82F6' },
  COMPLETED:   { label: 'Completed',   color: '#22C55E' },
};

export const PRIORITY_META: Record<TodoPriority, { label: string; color: string; bg: string }> = {
  HIGH:   { label: 'High',   color: '#EF4444', bg: '#FEF2F2' },
  MEDIUM: { label: 'Medium', color: '#F59E0B', bg: '#FFFBEB' },
  LOW:    { label: 'Low',    color: '#22C55E', bg: '#F0FDF4' },
};

export function todayStr() {
  return toLocalDateStr(new Date().toISOString());
}

export const seg = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  grid: { padding: 12, paddingTop: 24, paddingBottom: 40 },
  gridRow: { justifyContent: 'space-between', marginBottom: 8 },

  // Today
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 6, paddingLeft: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  badge: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12,
    padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  taskStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  taskTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1E293B' },
  strikethrough: { textDecorationLine: 'line-through', color: '#94A3B8' },
  eventRow: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  eventBar: { width: 4 },
  eventBody: { flex: 1, padding: 12 },
  eventTitle: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 2 },
  eventTime: { fontSize: 12, color: '#94A3B8' },
  emptyRow: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 12 },
  emptyRowText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },

  // Notes grid
  noteCard: {
    width: CARD_WIDTH, minHeight: 140, borderRadius: 10, padding: 14, paddingTop: 32,
    justifyContent: 'space-between',
    overflow: 'visible',
    shadowColor: '#000', shadowOffset: { width: 2, height: 5 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  // Lock overlay — covers the entire note card when locked
  cardLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  cardLockBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  noteTitle: { fontSize: 14, fontWeight: '700', color: '#2D2D2D', marginBottom: 6 },
  noteContent: { fontSize: 12, color: '#4B4B4B', lineHeight: 18, flex: 1 },
  noteFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  noteActions: { flexDirection: 'row', gap: 8 },
  noteDate: { fontSize: 10, color: '#888' },

  // Filters
  filterBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#cce2f9', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: 'transparent',
    flexShrink: 1,
  },
  filterBtnActive: { backgroundColor: '#EFF6FF', borderColor: COLORS.primary },
  filterBtnIcon: { fontSize: 14 },
  filterBtnText: { fontSize: 13, fontWeight: '600', color: '#67696b', flex: 1 },
  filterBtnTextActive: { color: COLORS.primary },
  dateGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#cce2f9', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  datePillActive: { backgroundColor: '#EFF6FF', borderColor: COLORS.primary },
  datePillText: { fontSize: 13, fontWeight: '600', color: '#67696b' },
  datePillTextActive: { color: COLORS.primary },
  dateSep: { fontSize: 12, color: '#3a3b3c' },
  catCardGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 8,
  },
  catCard: {
    width: '22%', flexGrow: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, paddingHorizontal: 6,
    borderRadius: 16, backgroundColor: '#F8FAFC',
    borderWidth: 1.5, borderColor: 'transparent',
    gap: 8,
  },
  catCardIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  catCardLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', textAlign: 'center' },
  catChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, backgroundColor: '#F1F5F9',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  catChipActive: { backgroundColor: '#EFF6FF', borderColor: COLORS.primary },
  catChipIcon: { fontSize: 16 },
  catChipText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  catChipTextActive: { color: COLORS.primary },

  // Event cards
  eventCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  eventCardBar: { width: 5 },
  eventCardBody: { flex: 1, padding: 14 },
  eventCardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  eventCardDesc: { fontSize: 13, color: '#64748B', marginBottom: 6 },
  eventCardDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventCardDate: { fontSize: 12, color: '#94A3B8' },
  eventCatBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 6 },
  eventCatBadgeText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  deleteBtn: { padding: 14, justifyContent: 'center' },
  eventCardActions: { flexDirection: 'column', gap: 10, paddingRight: 14, paddingVertical: 14 },

  // Task cards
  taskHeader: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 12, paddingLeft: 4 },
  taskCard: {
    backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 12, paddingLeft: 14,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  taskCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  taskCardActions: { flexDirection: 'row', gap: 8, marginTop: 1 },
  taskCardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1E293B' },
  taskCardDesc: { fontSize: 13, color: '#94A3B8', marginTop: 4, marginBottom: 2 },
  statusBadge: { alignSelf: 'flex-start', marginTop: 6, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  // Bottom sheets
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  editSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 16 },
  editTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 16 },
  editInput: {
    height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC', paddingHorizontal: 16, fontSize: 15, color: '#1E293B', marginBottom: 12,
  },
  pickerRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: {
    flex: 1, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC',
  },
  pillText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  editBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 24,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  saveBtn: { flex: 1, height: 48, borderRadius: 24, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Task priority / time badges
  taskCardBadges:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  priorityDot:       { width: 8, height: 8, borderRadius: 4 },
  priorityBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  priorityBadgeText: { fontSize: 11, fontWeight: '600' },
  timeBadge:         { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: '#F1F5F9' },
  timeBadgeText:     { fontSize: 11, fontWeight: '500', color: '#64748B' },
});

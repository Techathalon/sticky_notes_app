import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Modal, Share, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IOSPickerModal } from '../IOSPickerModal';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotesStore } from '../../store/notesStore';
import { useAppAlert } from '../AppAlert';
import { EmptyState } from '../EmptyState';
import { NoteDecoration } from '../NoteDecoration';
import { NoteLockOverlay } from '../NoteLockOverlay';
import { COLORS } from '../../constants/colors';
import { useThemeColors } from '../../store/themeStore';
import { seg, ROTATIONS } from './segStyles';
import type { Note } from '@repo/types';

// Extracts plain text from note content (handles both old plain string and new blocks JSON)
function extractText(content: string | null | undefined): string {
  if (!content) return '';
  if (content.startsWith('[')) {
    try {
      const blocks = JSON.parse(content) as { type: string; text?: string }[];
      return blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ').trim();
    } catch {// ignore
      }
  }
  return content;
}

const NOTE_CATS_META: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string; iconBg: string; bg: string }[] = [
  { label: 'Education', icon: 'book-outline',      color: '#3B82F6', iconBg: '#BFDBFE', bg: '#EFF6FF' },
  { label: 'Work',      icon: 'briefcase-outline', color: '#10B981', iconBg: '#BBF7D0', bg: '#F0FDF4' },
  { label: 'Health',    icon: 'fitness-outline',   color: '#EC4899', iconBg: '#F9A8D4', bg: '#FDF2F8' },
  { label: 'Finance',   icon: 'wallet-outline',    color: '#D97706', iconBg: '#FDE68A', bg: '#FFFBEB' },
  { label: 'Travel',    icon: 'airplane-outline',  color: '#059669', iconBg: '#6EE7B7', bg: '#ECFDF5' },
  { label: 'Ideas',     icon: 'bulb-outline',      color: '#7C3AED', iconBg: '#D8B4FE', bg: '#F5F3FF' },
  { label: 'Other',     icon: 'document-outline',  color: '#64748B', iconBg: '#CBD5E1', bg: '#F8FAFC' },
];

export function NotesSegment({ search }: { search: string }) {
  const c = useThemeColors();
  const { showAlert, AlertModal } = useAppAlert();
  const { notes, isLoading, fetchNotes, deleteNote, unlockNote, isNoteUnlocked } = useNotesStore();
  const router = useRouter();
  useFocusEffect(useCallback(() => { fetchNotes(); }, [fetchNotes]));

  const [pendingLockedNote, setPendingLockedNote] = useState<{ id: string; title: string } | null>(null);

  const handleNoteTap = useCallback((item: Note) => {
    if (item.isLocked && !isNoteUnlocked(item.id)) {
      setPendingLockedNote({ id: item.id, title: item.title });
      return;
    }
    router.push(`/note-editor?id=${item.id}`);
  }, [isNoteUnlocked, router]);

  const [catFilter, setCatFilter]                   = useState<string | null>(null);
  const [catDropdownVisible, setCatDropdownVisible] = useState(false);
  const [dateFrom, setDateFrom]                     = useState<Date | null>(null);
  const [dateTo, setDateTo]                         = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker]         = useState(false);
  const [showToPicker, setShowToPicker]             = useState(false);

  const filtered = notes.filter((n) => {
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) &&
        !extractText(n.content).toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter && n.category !== catFilter) return false;
    if (dateFrom) {
      const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
      if (new Date(n.createdAt) < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
      if (new Date(n.createdAt) > to) return false;
    }
    return true;
  });

  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (isLoading && notes.length === 0) {
    return <View style={seg.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Filter bar */}
      <View style={[seg.filterBar, { alignSelf: 'flex-start' }]}>
        <TouchableOpacity
          style={[seg.filterBtn, catFilter != null && seg.filterBtnActive]}
          onPress={() => setCatDropdownVisible(true)}
          activeOpacity={0.75}
        >
          <Ionicons
            name={catFilter ? (NOTE_CATS_META.find((c) => c.label === catFilter)?.icon ?? 'pricetag-outline') : 'pricetag-outline'}
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
            <TouchableOpacity
              onPress={() => { setDateFrom(null); setDateTo(null); }}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
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
            maximumDate={new Date()}
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
              maximumDate={dateTo ?? new Date()}
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
              maximumDate={new Date()}
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

      {/* Category bottom-sheet modal */}
      <Modal visible={catDropdownVisible} transparent animationType="slide" onRequestClose={() => setCatDropdownVisible(false)}>
        <TouchableOpacity style={seg.overlay} activeOpacity={1} onPress={() => setCatDropdownVisible(false)} />
        <View style={[seg.editSheet, { backgroundColor: c.surface }]}>
          <View style={[seg.handle, { backgroundColor: c.border }]} />
          <Text style={[seg.editTitle, { color: c.text }]}>Choose Category</Text>
          <View style={seg.catCardGrid}>
            {([{ label: 'All', icon: 'pricetag-outline' as const, color: COLORS.primary, iconBg: '#BAE6FD', bg: '#F0F9FF' }, ...NOTE_CATS_META]).map(({ label, icon, color, iconBg, bg }) => {
              const active = label === 'All' ? catFilter === null : catFilter === label;
              return (
                <TouchableOpacity
                  key={label}
                  style={[seg.catCard, active && { backgroundColor: bg, borderColor: color, borderWidth: 2 }]}
                  onPress={() => { setCatFilter(label === 'All' ? null : label); setCatDropdownVisible(false); }}
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

      {filtered.length === 0 ? (
        <EmptyState message={search || catFilter || dateFrom || dateTo ? 'No matching notes' : 'No notes yet'} variant="notes" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          numColumns={2}
          contentContainerStyle={seg.grid}
          columnWrapperStyle={seg.gridRow}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const rotation = ROTATIONS[index % ROTATIONS.length];
            const date = new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <View style={[seg.noteCard, { backgroundColor: item.color, transform: [{ rotate: rotation }] }]}>
                <NoteDecoration index={index} />
                <TouchableOpacity onPress={() => handleNoteTap(item)} activeOpacity={0.8} style={{ flex: 1 }}>
                  <Text style={seg.noteTitle} numberOfLines={2}>{item.title}</Text>
                  {extractText(item.content) ? <Text style={seg.noteContent} numberOfLines={4}>{extractText(item.content)}</Text> : null}
                </TouchableOpacity>
                {/* Lock overlay — shown on top of card content when note is locked */}
                {item.isLocked && (
                  <TouchableOpacity
                    style={seg.cardLockOverlay}
                    onPress={() => handleNoteTap(item)}
                    activeOpacity={0.8}
                  >
                    <View style={seg.cardLockBadge}>
                      <Ionicons name="lock-closed" size={20} color="#0284C7" />
                    </View>
                    <Text style={seg.cardLockLabel}>Locked</Text>
                  </TouchableOpacity>
                )}
                <View style={seg.noteFooter}>
                  <Text style={seg.noteDate}>{date}</Text>
                  <View style={seg.noteActions}>
                    <TouchableOpacity onPress={() => handleNoteTap(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="create-outline" size={18} color="#777" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Share.share({ message: [item.title, extractText(item.content)].filter(Boolean).join('\n\n') })}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="share-outline" size={18} color="#777" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      onPress={() => showAlert({ type: 'confirm', title: 'Delete Note', message: `Are you sure you want to delete "${item.title}"? This cannot be undone.`, buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteNote(item.id) }] })}
                    >
                      <Ionicons name="trash-outline" size={18} color="#aaa" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          refreshing={isLoading}
          onRefresh={fetchNotes}
        />
      )}
      {AlertModal}
      {pendingLockedNote && (
        <NoteLockOverlay
          visible={!!pendingLockedNote}
          noteTitle={pendingLockedNote.title}
          onSuccess={() => {
            unlockNote(pendingLockedNote.id);
            const id = pendingLockedNote.id;
            setPendingLockedNote(null);
            router.push(`/note-editor?id=${id}`);
          }}
          onCancel={() => setPendingLockedNote(null)}
        />
      )}
    </View>
  );
}

import { useState } from 'react';
import { useAppAlert } from '../../components/AppAlert';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Switch,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore, useThemeColors } from '../../store/themeStore';
import { useNotificationsStore } from '../../store/notificationsStore';
import { useNotesStore } from '../../store/notesStore';
import { useTodosStore } from '../../store/todosStore';
import { useEventsStore } from '../../store/eventsStore';
import { useExpenseStore } from '../../store/expenseStore';
import { requestAlarmPermission } from '../../utils/notifications';
import { checkAllAlarmPermissions, cancelAllLocalAlarms } from '../../utils/alarmManager';
import { AUTH_COLORS, COLORS } from '../../constants/colors';
import { GradientScreen } from '@/components/GradientScreen';

// ─── Settings Row ──────────────────────────────────────────────

function SettingRow({
  icon,
  iconBg,
  iconColor,
  label,
  sublabel,
  onPress,
  right,
  c,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  c: import('../../store/themeStore').ThemeColors;
}) {
  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[s.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={s.rowBody}>
        <Text style={[s.rowLabel, { color: c.text }]}>{label}</Text>
        {sublabel ? <Text style={[s.rowSublabel, { color: c.textMuted }]}>{sublabel}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={c.border} /> : null)}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, logout, deleteAccount } = useAuthStore();
  const { themeMode, setThemeMode } = useThemeStore();
  const {
    alarmsEnabled,
    setAlarmsEnabled,
    notificationsEnabled,
    settingsSyncEnabled,
    setSettingsSyncEnabled,
  } = useNotificationsStore();
  const c = useThemeColors();
  const { showAlert, AlertModal } = useAppAlert();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleToggleAlarms = async (v: boolean) => {
    if (!v) {
      setAlarmsEnabled(false);
      await cancelAllLocalAlarms();
      return;
    }
    setAlarmsEnabled(true);
    requestAlarmPermission();
    await checkAllAlarmPermissions();
  };

  const avatarLetter = (user?.name ?? user?.email ?? '?')[0].toUpperCase();

  const handleLogout = () => {
    showAlert({
      type: 'logout',
      title: 'Log Out',
      message: 'Are you sure you want to log out of your account?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
              router.replace('/(auth)/login');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
    });
  };

  const handleDeleteAccount = () => {
    showAlert({
      type: 'confirm',
      title: 'Delete Account',
      message:
        'Are you sure you want to delete your account? This action is permanent and cannot be undone. All your notes, tasks, events, and expenses will be permanently deleted.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              await cancelAllLocalAlarms();
              await deleteAccount();
              useNotesStore.getState().reset();
              useTodosStore.getState().reset();
              useEventsStore.getState().reset();
              useExpenseStore.getState().reset();
              router.replace('/(auth)/login');
            } catch (err: unknown) {
              const resData = (
                err as { response?: { data?: { message?: string; error?: string } } }
              )?.response?.data;
              const msg =
                resData?.message ||
                resData?.error ||
                (err instanceof Error
                  ? err.message
                  : 'Failed to delete account. Please try again.');
              showAlert({
                type: 'error',
                title: 'Delete Failed',
                message: msg,
              });
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ],
    });
  };

  return (
    <GradientScreen style={s.root}>
      <ScrollView style={s.scrollcontainer} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{avatarLetter}</Text>
          </View>
          {user?.name ? <Text style={[s.name, { color: c.text }]}>{user.name}</Text> : null}
          <Text style={[s.email, { color: c.textSub }]}>{user?.email ?? ''}</Text>
        </View>

        {/* ACCOUNT */}
        <Text style={[s.sectionHeader, { color: c.textMuted }]}>Account</Text>
        <View style={[s.section, { backgroundColor: c.surface }]}>
          <SettingRow
            icon="lock-closed-outline"
            iconBg="#EFF6FF"
            iconColor="#3B82F6"
            label="Change Password"
            sublabel="Update your account password"
            onPress={() => router.push('/(auth)/forgot-password?from=settings')}
            c={c}
          />
        </View>

        {/* PREFERENCES */}
        <Text style={[s.sectionHeader, { color: c.textMuted }]}>Preferences</Text>
        <View style={[s.section, { backgroundColor: c.surface }]}>
          <View style={s.appearanceBlock}>
            <View style={s.row}>
              <View
                style={[
                  s.rowIcon,
                  {
                    backgroundColor:
                      themeMode === 'dark'
                        ? '#334155'
                        : themeMode === 'light'
                          ? '#FFFBEB'
                          : '#EFF6FF',
                  },
                ]}
              >
                <Ionicons
                  name={
                    themeMode === 'dark'
                      ? 'moon'
                      : themeMode === 'light'
                        ? 'sunny-outline'
                        : 'phone-portrait-outline'
                  }
                  size={20}
                  color={
                    themeMode === 'dark' ? '#93C5FD' : themeMode === 'light' ? '#F59E0B' : '#3B82F6'
                  }
                />
              </View>
              <View style={s.rowBody}>
                <Text style={[s.rowLabel, { color: c.text }]}>Appearance</Text>
                <Text style={[s.rowSublabel, { color: c.textMuted }]}>
                  {themeMode === 'automatic'
                    ? 'Follows system setting'
                    : themeMode === 'dark'
                      ? 'Dark theme'
                      : 'Light theme'}
                </Text>
              </View>
            </View>
            <View style={s.themeSelector}>
              {(['automatic', 'light', 'dark'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    s.themePill,
                    { borderColor: c.border },
                    themeMode === mode && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
                  ]}
                  onPress={() => setThemeMode(mode)}
                >
                  <Text
                    style={[s.themePillText, { color: themeMode === mode ? '#fff' : c.textSub }]}
                  >
                    {mode === 'automatic' ? 'Auto' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={!notificationsEnabled ? { opacity: 0.5 } : undefined}>
            <SettingRow
              icon="notifications-outline"
              iconBg="#F0FDF4"
              iconColor="#10B981"
              label="Notifications"
              sublabel={
                notificationsEnabled
                  ? 'Configure task & event reminders'
                  : 'Permission denied — tap to open Settings'
              }
              onPress={
                notificationsEnabled
                  ? () => router.push('/notification-settings')
                  : () => Linking.openSettings()
              }
              c={c}
            />
          </View>
          <View style={!notificationsEnabled ? { opacity: 0.5 } : undefined}>
            <SettingRow
              icon="alarm-outline"
              iconBg="#FFF1F2"
              iconColor="#E11D48"
              label="Alarms"
              sublabel={
                notificationsEnabled ? 'Set reminders for tasks & events' : 'Notifications required'
              }
              c={c}
              right={
                <Switch
                  value={alarmsEnabled}
                  onValueChange={handleToggleAlarms}
                  disabled={!notificationsEnabled}
                  trackColor={{ false: c.border, true: '#E11D48' }}
                  thumbColor="#fff"
                />
              }
            />
          </View>
        </View>

        {/* SYNC */}
        <Text style={[s.sectionHeader, { color: c.textMuted }]}>Sync</Text>
        <View style={[s.section, { backgroundColor: c.surface }]}>
          <SettingRow
            icon="sync-outline"
            iconBg="#F0F9FF"
            iconColor="#0EA5E9"
            label="Sync Settings"
            sublabel={
              settingsSyncEnabled
                ? 'Settings are shared across all your devices'
                : 'Each device has its own independent settings'
            }
            c={c}
            right={
              <Switch
                value={settingsSyncEnabled}
                onValueChange={setSettingsSyncEnabled}
                trackColor={{ false: c.border, true: '#0EA5E9' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* LOG OUT */}
        <Text style={[s.sectionHeader, { color: c.textMuted }]}>Session</Text>
        <View style={[s.section, { backgroundColor: c.surface }]}>
          <TouchableOpacity
            style={[s.logoutRow, (isLoggingOut || isDeletingAccount) && { opacity: 0.6 }]}
            onPress={handleLogout}
            disabled={isLoggingOut || isDeletingAccount}
            activeOpacity={0.8}
          >
            {isLoggingOut ? (
              <ActivityIndicator color={COLORS.error} size="small" />
            ) : (
              <>
                <View style={[s.rowIcon, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
                </View>
                <Text style={s.logoutLabel}>Log Out</Text>
                <Ionicons name="chevron-forward" size={16} color="#FCA5A5" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* DANGER ZONE */}
        <Text style={[s.sectionHeader, { color: '#EF4444' }]}>Danger Zone</Text>
        <View style={[s.section, { backgroundColor: c.surface, marginBottom: 28 }]}>
          <TouchableOpacity
            style={[s.dangerRow, (isDeletingAccount || isLoggingOut) && { opacity: 0.6 }]}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount || isLoggingOut}
            activeOpacity={0.8}
          >
            {isDeletingAccount ? (
              <ActivityIndicator color={COLORS.error} size="small" />
            ) : (
              <>
                <View style={[s.rowIcon, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                </View>
                <View style={s.rowBody}>
                  <Text style={s.dangerLabel}>Delete Account</Text>
                  <Text style={[s.rowSublabel, { color: c.textMuted }]}>
                    Permanently delete account and all data
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#FCA5A5" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      {AlertModal}
    </GradientScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  scrollcontainer: { marginBottom: 4 },
  profileCard: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 32,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: AUTH_COLORS.skyMid,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: AUTH_COLORS.skyMid,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  email: { fontSize: 14, color: '#64748B' },

  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  section: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  rowSublabel: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  logoutLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.error,
    marginLeft: 14,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dangerLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.error,
  },

  appearanceBlock: { paddingBottom: 12 },
  themeSelector: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 4 },
  themePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  themePillText: { fontSize: 13, fontWeight: '600' },
});

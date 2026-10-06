import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import notifee from '@notifee/react-native';

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

/**
 * In-app styled modal for OEM battery optimization (Samsung, Xiaomi, Huawei, etc.).
 * Shown only when the standard battery-optimization system dialog was already granted
 * but the OEM power manager is still restricting the app.
 * After tapping "Allow", opens the OEM power manager settings page.
 */
export function BatteryOptimizationModal({ visible, onDismiss }: Props) {
  const insets = useSafeAreaInsets();

  async function openSettings() {
    onDismiss();
    notifee.openPowerManagerSettings().catch(() => {});
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={s.backdrop}>
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={s.topBar} />

          <View style={s.iconRow}>
            <View style={s.appIconWrap}>
              <Ionicons name="bookmark" size={28} color="#fff" />
            </View>
            <View style={s.arrow}>
              <Ionicons name="arrow-forward" size={16} color="#666" />
            </View>
            <View style={s.permIconWrap}>
              <Ionicons name="battery-charging-outline" size={28} color="#D97706" />
            </View>
          </View>

          <Text style={s.title}>
            Allow <Text style={s.appName}>Sticky Notes</Text> to run in the background?
          </Text>

          <Text style={s.desc}>
            Your device&apos;s power manager may delay or block alarms. Disabling this restriction ensures alarms fire on time.
          </Text>

          <Text style={s.steps}>
            After tapping Allow:{'\n'}
            {'1.'} Find <Text style={s.bold}>Sticky Notes</Text> in the list{'\n'}
            {'2.'} Select <Text style={s.bold}>Unrestricted</Text> or{' '}
            <Text style={s.bold}>Don&apos;t optimize</Text>
          </Text>

          <View style={s.divider} />

          <View style={s.btnRow}>
            <TouchableOpacity style={s.denyBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={s.denyText}>Later</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.allowBtn} onPress={openSettings} activeOpacity={0.85}>
              <Text style={s.allowText}>Allow</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  topBar: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#444', marginBottom: 24,
  },
  iconRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: 20,
  },
  appIconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#6366F1',
    alignItems: 'center', justifyContent: 'center',
  },
  arrow: { opacity: 0.5 },
  permIconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#FFFBEB',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 18, fontWeight: '600', color: '#F8F8F8',
    textAlign: 'center', lineHeight: 26, marginBottom: 12,
  },
  appName: { fontWeight: '800', color: '#818CF8' },
  desc: {
    fontSize: 14, color: '#999', textAlign: 'center',
    lineHeight: 21, marginBottom: 14,
  },
  steps: {
    fontSize: 13, color: '#BBB', lineHeight: 22,
    alignSelf: 'flex-start', marginBottom: 20,
    backgroundColor: '#252525', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    width: '100%',
  },
  bold: { fontWeight: '700', color: '#E2E8F0' },
  divider: {
    width: '100%', height: 1,
    backgroundColor: '#2E2E2E', marginBottom: 20,
  },
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  denyBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#333',
    alignItems: 'center', backgroundColor: '#252525',
  },
  denyText: { fontSize: 15, fontWeight: '600', color: '#AAA' },
  allowBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#6366F1', alignItems: 'center',
  },
  allowText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

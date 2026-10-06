import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useThemeColors } from '../store/themeStore';
import { authenticateWithBiometrics } from '../utils/biometrics';

interface NoteLockOverlayProps {
  visible: boolean;
  noteTitle: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function NoteLockOverlay({
  visible,
  noteTitle,
  onSuccess,
  onCancel,
}: NoteLockOverlayProps) {
  const c = useThemeColors();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-trigger biometrics when overlay becomes visible
  useEffect(() => {
    if (visible) {
      setErrorMsg(null);
      handleAuthenticate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function handleAuthenticate() {
    setLoading(true);
    setErrorMsg(null);
    const result = await authenticateWithBiometrics('Unlock note');
    setLoading(false);
    if (result.success) {
      onSuccess();
    } else if (result.error !== 'cancelled') {
      setErrorMsg(result.message);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: c.surface }]}>
          {/* Lock icon badge */}
          <View style={s.iconBadge}>
            <Ionicons name="lock-closed" size={40} color="#0284C7" />
          </View>

          <Text style={[s.title, { color: c.text }]}>Note Locked</Text>

          <Text style={[s.subtitle, { color: c.textSub }]} numberOfLines={2}>
            Authenticate to view "{noteTitle}"
          </Text>

          {errorMsg ? (
            <View style={s.errorRow}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={s.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.unlockBtn, loading && s.unlockBtnDisabled]}
            onPress={handleAuthenticate}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="lock-open-outline" size={18} color="#fff" />
                <Text style={s.unlockBtnText}>Unlock Note</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onCancel} activeOpacity={0.7} style={s.cancelBtn}>
            <Text style={[s.cancelText, { color: c.textSub }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 16,
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    flex: 1,
    lineHeight: 18,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 15,
    width: '100%',
    marginBottom: 12,
  },
  unlockBtnDisabled: { opacity: 0.6 },
  unlockBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

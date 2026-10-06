import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../services/api';
import { AUTH_COLORS, COLORS } from '../../constants/colors';
import { WaveHeader } from '../../components/WaveHeader';
import { useThemeColors, useIsDark } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { forgotPasswordSchema } from '../../utils/validation';

export default function ForgotPasswordScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromSettings = from === 'settings';
  const user = useAuthStore((s) => s.user);
  const [email, setEmail] = useState(fromSettings ? (user?.email ?? '') : '');
  const [emailError, setEmailError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const c = useThemeColors();
  const isDark = useIsDark();

  const handleSendOtp = async () => {
    setEmailError('');
    setServerError('');

    if (!fromSettings) {
      const result = forgotPasswordSchema.safeParse({ email: email.trim() });
      if (!result.success) {
        const errs = result.error.flatten().fieldErrors;
        setEmailError(errs.email?.[0] ?? '');
        return;
      }
    }

    setIsLoading(true);
    try {
      await authApi.forgotPassword({ email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Something went wrong. Please try again.';
      setServerError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: isDark ? '#020C1B' : AUTH_COLORS.sky }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <WaveHeader
        icon="lock-closed-outline"
        title="Forgot Password"
        subtitle={fromSettings ? "We'll send a reset link to your email" : "Enter your email to receive a reset link"}
      />

      <View style={[styles.card, { backgroundColor: c.surface }]}>
        <ScrollView
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.cardTitle, { color: c.text }]}>Reset Password</Text>

          {sent ? (
            <>
              <View style={[styles.successBox, { backgroundColor: isDark ? '#14301A' : '#F0FDF4' }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
                <Text style={styles.successText}>
                  Check your email! We&apos;ve sent a password reset link to {email.trim().toLowerCase()}.
                </Text>
              </View>
              <View style={styles.footer}>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={styles.link}>
                    {fromSettings ? '← Back to Settings' : '← Back to Sign In'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {serverError ? (
                <View style={[styles.errorBox, { backgroundColor: isDark ? '#3B1515' : '#FEF2F2' }]}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
                  <Text style={styles.errorBoxText}>{serverError}</Text>
                </View>
              ) : null}

              <Text style={[styles.hint, { color: c.textSub }]}>
                We&apos;ll send a password reset link to your email address.
              </Text>

              {/* Email — read-only display from settings, input otherwise */}
              {fromSettings ? (
                <View style={[styles.emailDisplay, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                  <Ionicons name="mail-outline" size={20} color={AUTH_COLORS.inputIcon} style={styles.inputIcon} />
                  <Text style={[styles.emailText, { color: c.text }]}>{user?.email}</Text>
                </View>
              ) : (
                <>
                  <View style={[styles.inputRow, { backgroundColor: c.inputBg, borderColor: c.border }, emailError ? [styles.inputRowError, { backgroundColor: isDark ? '#2D1515' : '#FFF8F8' }] : null]}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={emailError ? COLORS.error : AUTH_COLORS.inputIcon}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.textInput, { color: c.text }]}
                      value={email}
                      onChangeText={(v) => { setEmail(v); setEmailError(''); }}
                      placeholder="Email address"
                      placeholderTextColor={AUTH_COLORS.inputIcon}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                    />
                  </View>
                  {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
                </>
              )}

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>

              <View style={styles.footer}>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={styles.link}>
                    {fromSettings ? '← Back to Settings' : '← Back to Sign In'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AUTH_COLORS.sky },
  card: {
    flex: 1,
    backgroundColor: AUTH_COLORS.cardBg,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    marginTop: -2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  cardContent: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBoxText: { color: COLORS.error, fontSize: 13, flex: 1 },
  inputRow: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.inputBg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 4,
  },
  inputRowError: { borderColor: COLORS.error, backgroundColor: '#FFF8F8' },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, fontSize: 15, color: '#1E293B', paddingVertical: 0 },
  fieldError: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 10,
    marginLeft: 18,
  },
  button: {
    height: 56,
    backgroundColor: AUTH_COLORS.skyMid,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: AUTH_COLORS.skyMid,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },
  footer: { alignItems: 'center', marginTop: 28 },
  link: { color: AUTH_COLORS.skyMid, fontSize: 14, fontWeight: '600' },
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  successText: { color: '#16A34A', fontSize: 14, flex: 1, lineHeight: 20 },
  emailDisplay: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 18,
    marginBottom: 4,
  },
  emailText: { flex: 1, fontSize: 15 },
});

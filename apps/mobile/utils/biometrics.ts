import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricResult =
  | { success: true }
  | { success: false; error: 'cancelled' | 'lockout' | 'unknown'; message: string };

/**
 * Returns true when the device has biometric hardware AND enrolled credentials.
 * Used to decide whether to show the lock toggle in the note editor.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  return LocalAuthentication.isEnrolledAsync();
}

/**
 * Trigger the biometric / device-credential prompt.
 * Falls back to PIN/password if biometrics fail (disableDeviceFallback: false).
 */
export async function authenticateWithBiometrics(reason: string): Promise<BiometricResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use Passcode',
       disableDeviceFallback: false, //false → allow PIN/password fallback   true → only biometrics 
      cancelLabel: 'Cancel',
    });

    if (result.success) return { success: true };

    if (result.error === 'lockout' || (result.error as string) === 'lockout_permanent') {
      return { success: false, error: 'lockout', message: 'Too many failed attempts. Try again later.' };
    }
    if (result.error === 'user_cancel' || result.error === 'system_cancel') {
      return { success: false, error: 'cancelled', message: 'Cancelled.' };
    }
    return { success: false, error: 'unknown', message: result.error ?? 'Authentication failed.' };
  } catch (err) {
    return { success: false, error: 'unknown', message: (err as Error).message ?? 'Authentication error.' };
  }
}

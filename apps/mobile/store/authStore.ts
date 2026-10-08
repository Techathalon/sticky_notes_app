import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, LoginRequest, RegisterRequest } from '@repo/types';
import { authApi, pushApi, ACCESS_TOKEN_KEY, TOKEN_ID_KEY, USER_KEY } from '../services/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  tokenId: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;

  // Actions
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

// ── JWT expiry check (no library needed) ──────────────────────
function isTokenExpired(token: string): boolean {
  try {
    const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const base64 = raw.padEnd(Math.ceil(raw.length / 4) * 4, '=');
    const payload = JSON.parse(atob(base64)) as { exp: number };
    return payload.exp * 1000 < Date.now() + 30_000; // 30 s buffer
  } catch {
    return true; // treat unparseable token as expired
  }
}

// ── Module-level refresh timer ─────────────────────────────────
let refreshTimerId: ReturnType<typeof setTimeout> | null = null;

function scheduleRefresh(store: { refreshAccessToken: () => Promise<void> }) {
  if (refreshTimerId) clearTimeout(refreshTimerId);
  refreshTimerId = setTimeout(() => {
    store.refreshAccessToken().catch(() => {/* handled inside refreshAccessToken */});
  }, 55 * 60 * 1000); // 55 minutes
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  tokenId: null,
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,

  login: async (data) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login(data);
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, response.accessToken);
      await SecureStore.setItemAsync(TOKEN_ID_KEY, response.tokenId);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user));
      set({
        user: response.user,
        accessToken: response.accessToken,
        tokenId: response.tokenId,
        isAuthenticated: true,
      });
      scheduleRefresh(get());
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const response = await authApi.register(data);
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, response.accessToken);
      await SecureStore.setItemAsync(TOKEN_ID_KEY, response.tokenId);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user));
      set({
        user: response.user,
        accessToken: response.accessToken,
        tokenId: response.tokenId,
        isAuthenticated: true,
      });
      scheduleRefresh(get());
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    const { tokenId } = get();
    if (refreshTimerId) {
      clearTimeout(refreshTimerId);
      refreshTimerId = null;
    }
    if (tokenId) {
      try {
        await authApi.logout({ tokenId });
      } catch {
        // Ignore — clean up locally regardless
      }
    }
    try {
      const fcmToken = await AsyncStorage.getItem('fcm-device-token');
      if (fcmToken) {
        await pushApi.removeToken(fcmToken);
        await AsyncStorage.removeItem('fcm-device-token');
      }
    } catch {
      // Best-effort — don't block logout
    }
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(TOKEN_ID_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ user: null, accessToken: null, tokenId: null, isAuthenticated: false });
  },

  deleteAccount: async () => {
    if (refreshTimerId) {
      clearTimeout(refreshTimerId);
      refreshTimerId = null;
    }
    try {
      const fcmToken = await AsyncStorage.getItem('fcm-device-token');
      if (fcmToken) {
        await pushApi.removeToken(fcmToken);
        await AsyncStorage.removeItem('fcm-device-token');
      }
    } catch {
      // Best-effort — don't block account deletion
    }
    await authApi.deleteAccount();
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(TOKEN_ID_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ user: null, accessToken: null, tokenId: null, isAuthenticated: false });
  },

  loadToken: async () => {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const tokenId     = await SecureStore.getItemAsync(TOKEN_ID_KEY);
    const userJson    = await SecureStore.getItemAsync(USER_KEY);

    // ── Path 1: access token still valid → restore immediately ──
    if (accessToken && tokenId && !isTokenExpired(accessToken)) {
      const user = userJson ? (JSON.parse(userJson) as User) : null;
      set({ accessToken, tokenId, user, isAuthenticated: true, isInitialized: true });
      scheduleRefresh(get());
      return;
    }

    // ── Path 2: access token expired/missing but tokenId exists → refresh ──
    if (tokenId) {
      try {
        const { accessToken: newToken, user } = await authApi.refreshToken({ tokenId });
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, newToken);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
        set({ accessToken: newToken, tokenId, user, isAuthenticated: true, isInitialized: true });
        scheduleRefresh(get());
        return;
      } catch {
        // Refresh token expired or deleted — fall through to Path 3
      }
    }

    // ── Path 3: no valid session → clear storage and show login ──
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(TOKEN_ID_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ isInitialized: true });
  },

  changePassword: async (currentPassword, newPassword) => {
    await authApi.changePassword({ currentPassword, newPassword });
  },

  refreshAccessToken: async () => {
    const { tokenId } = get();
    if (!tokenId) return;
    try {
      const { accessToken, user } = await authApi.refreshToken({ tokenId });
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      set({ accessToken, user });
      scheduleRefresh(get());
    } catch {
      // Session expired — force logout
      await get().logout();
    }
  },
}));

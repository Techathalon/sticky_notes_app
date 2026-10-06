import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  LogoutRequest,
  Note,
  CreateNoteRequest,
  UpdateNoteRequest,
  Todo,
  CreateTodoRequest,
  UpdateTodoRequest,
  Event,
  CreateEventRequest,
  UpdateEventRequest,
  Expense,
  CreateExpenseRequest,
  AppSettings,
  ApiResponse,
} from '@repo/types';

// ─── Axios instance ───────────────────────────────────────────
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://192.168.0.122:3000';

export const ACCESS_TOKEN_KEY = 'access_token';
export const TOKEN_ID_KEY = 'token_id';
export const USER_KEY = 'user_data';

const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Auth API ────────────────────────────────────────────────
export const authApi = {
  login: (data: LoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data).then((r) => r.data.data),
  register: (data: RegisterRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', data).then((r) => r.data.data),
  forgotPassword: (data: ForgotPasswordRequest) =>
    api.post<{ message: string }>('/auth/forgot-password', data).then((r) => r.data),
  resetPassword: (data: ResetPasswordRequest) =>
    api.post<{ message: string }>('/auth/reset-password', data).then((r) => r.data),
  refreshToken: (data: RefreshTokenRequest) =>
    api.post<RefreshTokenResponse>('/auth/refresh-token', data).then((r) => r.data),
  logout: (data: LogoutRequest) =>
    api.post<{ message: string }>('/auth/logout', data).then((r) => r.data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<{ message: string }>('/auth/change-password', data).then((r) => r.data),
};

// ─── Notes API ───────────────────────────────────────────────
export const notesApi = {
  getAll: () =>
    api.get<ApiResponse<Note[]>>('/notes').then((r) => r.data.data),
  create: (data: CreateNoteRequest) =>
    api.post<ApiResponse<Note>>('/notes', data).then((r) => r.data.data),
  update: (id: string, data: UpdateNoteRequest) =>
    api.put<ApiResponse<Note>>(`/notes/${id}`, data).then((r) => r.data.data),
  remove: (id: string) =>
    api.delete(`/notes/${id}`),
  uploadImage: async (uri: string, mimeType: string, filename: string): Promise<string> => {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const formData = new FormData();
    formData.append('file', { uri, type: mimeType, name: filename } as unknown as Blob);
    // Use fetch (not axios) — axios's default Content-Type: application/json header
    // cannot be reliably removed on React Native, breaking multipart boundary parsing.
    // fetch auto-sets multipart/form-data; boundary=xxx when body is FormData.
    const res = await fetch(`${API_URL}/api/notes/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData as unknown as BodyInit_,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const json = await res.json() as ApiResponse<{ url: string }>;
    return json.data.url;
  },
  deleteImage: (url: string) =>
    api.delete('/notes/image', { data: { url } }),
  detectExpenses: (text: string) =>
    api.post<ApiResponse<{ amount: number; title: string; category: string; snippet: string , date: string}[]>>('/notes/detect-expenses', { text }).then((r) => r.data.data),
};

// ─── Todos API ───────────────────────────────────────────────
export const todosApi = {
  getAll: () =>
    api.get<ApiResponse<Todo[]>>('/todos').then((r) => r.data.data),
  create: (data: CreateTodoRequest) =>
    api.post<ApiResponse<Todo>>('/todos', data).then((r) => r.data.data),
  update: (id: string, data: UpdateTodoRequest) =>
    api.put<ApiResponse<Todo>>(`/todos/${id}`, data).then((r) => r.data.data),
  remove: (id: string) =>
    api.delete(`/todos/${id}`),
};

// ─── Events API ──────────────────────────────────────────────
export const eventsApi = {
  getAll: () =>
    api.get<ApiResponse<Event[]>>('/events').then((r) => r.data.data),
  create: (data: CreateEventRequest) =>
    api.post<ApiResponse<Event>>('/events', data).then((r) => r.data.data),
  update: (id: string, data: UpdateEventRequest) =>
    api.put<ApiResponse<Event>>(`/events/${id}`, data).then((r) => r.data.data),
  remove: (id: string) =>
    api.delete(`/events/${id}`),
};

// ─── Expenses API ────────────────────────────────────────────
export const expensesApi = {
  getAll: () =>
    api.get<ApiResponse<Expense[]>>('/expenses').then((r) => r.data.data),
  create: (data: CreateExpenseRequest) =>
    api.post<ApiResponse<Expense>>('/expenses', data).then((r) => r.data.data),
  remove: (id: string) =>
    api.delete(`/expenses/${id}`),
  update: (id: string, data: CreateExpenseRequest) =>
    api.put<ApiResponse<Expense>>(`/expenses/${id}`, data).then((r) => r.data.data),
  getBudget: (month: string) =>
    api.get<ApiResponse<{ amount: number }>>('/expenses/budget', { params: { month } }).then((r) => r.data.data.amount),
  setBudget: (month: string, amount: number) =>
    api.put<ApiResponse<{ amount: number }>>('/expenses/budget', { month, amount }).then((r) => r.data.data.amount),
};

// ─── Expense Settings API ────────────────────────────────────
export interface ExpenseSettings {
  summaryEnabled: boolean;
  summaryTime: string;        // "HH:MM" UTC
  budget80AlertEnabled: boolean;
  budget100AlertEnabled: boolean;
}

export const expenseSettingsApi = {
  get: () =>
    api.get<ApiResponse<ExpenseSettings>>('/expenses/settings').then((r) => r.data.data),
  update: (data: Partial<ExpenseSettings>) =>
    api.put<ApiResponse<ExpenseSettings>>('/expenses/settings', data).then((r) => r.data.data),
};

// ─── App Settings API (cross-device sync) ────────────────────
export const appSettingsApi = {
  get: () =>
    api.get<ApiResponse<AppSettings>>('/app-settings').then((r) => r.data.data),
  save: (data: AppSettings) =>
    api.put<ApiResponse<AppSettings>>('/app-settings', data).then((r) => r.data.data),
};

// ─── Push Notifications API ──────────────────────────────────
export const pushApi = {
  registerToken: (token: string, platform?: string) =>
    api.post<{ message: string }>('/push/token', { token, platform }).then((r) => r.data),
  removeToken: (token: string) =>
    api.delete<{ message: string }>('/push/token', { data: { token } }).then((r) => r.data),
};

export default api;

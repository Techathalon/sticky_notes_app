// ─────────────────────────────────────────
//  Shared types — consumed by apps/api and apps/mobile
// ─────────────────────────────────────────

// ── User ─────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Auth ─────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  tokenId: string;
  accessToken: string;
  user: User;
}

export interface RefreshTokenRequest {
  tokenId: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  user: User;
}

export interface LogoutRequest {
  tokenId: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}

// ── Notes ────────────────────────────────
export interface Note {
  id: string;
  title: string;
  content: string | null;
  color: string;
  category: string | null;
  isLocked: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  title: string;
  content?: string;
  color?: string;
  category?: string;
  isLocked?: boolean;
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  color?: string;
  category?: string;
  isLocked?: boolean;
}

// ── Todos ────────────────────────────────
export type TodoStatus   = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
export type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate: string | null;
  dueTime: string | null;
  startAt: string | null;
  reminderAt: string | null;
  alarmAt: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoRequest {
  title: string;
  description?: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  dueDate?: string;
  dueTime?: string;
  startAt?: string | null;
  reminderAt?: string | null;
  alarmAt?: string | null;
}

export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  completed?: boolean;
  status?: TodoStatus;
  priority?: TodoPriority;
  dueDate?: string | null;
  dueTime?: string | null;
  startAt?: string | null;
  reminderAt?: string | null;
  alarmAt?: string | null;
}

// ── Events ───────────────────────────────
export interface Event {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  color: string;
  category: string | null;
  location: string | null;
  reminderAt: string | null;
  alarmAt: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  color?: string;
  category?: string;
  location?: string | null;
  reminderAt?: string | null;
  alarmAt?: string | null;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  color?: string;
  category?: string | null;
  location?: string | null;
  reminderAt?: string | null;
  alarmAt?: string | null;
}

// ── Expenses ─────────────────────────────
export type ExpenseCategory = 'Food' | 'Transport' | 'Shopping' | 'Health' | 'Bills' | 'Other';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  noteId: string | null;
  source: 'manual' | 'note';
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequest {
  title: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  noteId?: string | null;
  source?: 'manual' | 'note';
}

export interface UpdateExpenseRequest {
  title?: string;
  amount?: number;
  category?: string;
  date?: string;
}

// ── App Settings (synced across devices) ──
export interface AppSettings {
  alarmsEnabled:         boolean;
  taskReminderEnabled:   boolean;
  taskReminderTime:      string;  // "HH:MM" offset before due
  eventReminderEnabled:  boolean;
  eventReminderTime:     string;  // "HH:MM" offset before start
  expenseSummaryEnabled: boolean;
  expenseSummaryTime:    string;  // "HH:MM" UTC clock time
  budget80AlertEnabled:  boolean;
  budget100AlertEnabled: boolean;
}

// ── API response wrappers ─────────────────
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

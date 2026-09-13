export type SessionType = 'study' | 'break';

export interface SessionItem {
  id: string;
  title: string;
  type: SessionType;
  startTime: string; // e.g., "08:00"
  endTime: string;   // e.g., "09:00"
  durationMinutes: number;
}

export interface DaySchedule {
  dayOfWeek: number; // 0 = الأحد, 1 = الاثنين, ..., 6 = السبت
  dayName: string;
  subject: string;
  isRest: boolean;
  sessions: SessionItem[];
}

export type WeekSchedule = Record<number, DaySchedule>;

export type DayStatus = 'completed' | 'in_progress' | 'not_completed' | 'not_started' | 'rest';

export interface DayLog {
  date: string; // "YYYY-MM-DD"
  dayOfWeek: number;
  subject: string;
  isRest: boolean;
  completedSessions: string[]; // list of session IDs
  totalSessions: number;
  status: DayStatus;
  notes: string;
  completedAt?: string;
  updatedAt: string;
}

export interface ActiveTimerState {
  sessionId: string | null;
  sessionTitle: string;
  sessionType: SessionType;
  durationSeconds: number;
  remainingSeconds: number;
  startedAtTimestamp: number | null; // epoch timestamp ms
  pausedRemainingSeconds: number | null;
  isRunning: boolean;
  isPaused: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
}

export interface UserSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  autoStartBreaks: boolean;
  theme: 'light' | 'dark';
}

export interface UserStats {
  completedDays: number;
  incompleteDays: number;
  totalDaysLogged: number;
  commitmentRate: number; // 0 - 100%
  completedSessionsCount: number;
  longestStreak: number;
  currentStreak: number;
  bestPeriod: string;
}

export interface VerificationMailInfo {
  email: string;
  code: string;
  expiresAt: number;
  type: 'verify' | 'reset';
  resetLink?: string;
}

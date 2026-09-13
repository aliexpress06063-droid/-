import { WeekSchedule, DayLog, UserSettings, UserProfile, UserStats } from '../types';

const TOKEN_KEY = 'study_tracker_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage issues
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'حدث خطأ غير متوقع');
  }

  return data;
}

export const api = {
  // Auth
  async register(email: string, password: string, confirmPassword: string) {
    return fetchWithAuth('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, confirmPassword }),
    });
  },

  async verifyEmail(email: string, code: string) {
    const data = await fetchWithAuth('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async resendVerificationCode(email: string) {
    return fetchWithAuth('/api/auth/resend-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async login(email: string, password: string) {
    const data = await fetchWithAuth('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async forgotPassword(email: string) {
    return fetchWithAuth('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, newPassword: string, confirmPassword: string) {
    return fetchWithAuth('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword, confirmPassword }),
    });
  },

  async getMe(): Promise<{ user: UserProfile; schedule: WeekSchedule; settings: UserSettings }> {
    return fetchWithAuth('/api/auth/me');
  },

  async logout() {
    try {
      await fetchWithAuth('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    } finally {
      setStoredToken(null);
    }
  },

  // Schedule
  async getSchedule(): Promise<{ schedule: WeekSchedule }> {
    return fetchWithAuth('/api/user/schedule');
  },

  async updateSchedule(schedule: WeekSchedule) {
    return fetchWithAuth('/api/user/schedule', {
      method: 'PUT',
      body: JSON.stringify({ schedule }),
    });
  },

  // Day logs
  async getDayLog(dateStr: string): Promise<{ log: DayLog | null }> {
    return fetchWithAuth(`/api/user/day/${dateStr}`);
  },

  async updateDayLog(dateStr: string, updates: Partial<DayLog>) {
    return fetchWithAuth(`/api/user/day/${dateStr}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async getAllDayLogs(): Promise<{ logs: Record<string, DayLog> }> {
    return fetchWithAuth('/api/user/days');
  },

  // Stats
  async getStats(): Promise<{ stats: UserStats }> {
    return fetchWithAuth('/api/user/stats');
  },

  // Settings
  async updateSettings(settings: Partial<UserSettings>) {
    return fetchWithAuth('/api/user/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
  },

  // Simulated email inbox for convenient code access
  async getSimulatedInbox(email?: string) {
    const url = email ? `/api/simulated-inbox?email=${encodeURIComponent(email)}` : '/api/simulated-inbox';
    const res = await fetch(url);
    return res.json();
  },
};

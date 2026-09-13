import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, WeekSchedule, UserSettings } from '../types';
import { getDefaultSchedule } from '../defaultSchedule';
import { api, getStoredToken } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  schedule: WeekSchedule;
  settings: UserSettings;
  isLoading: boolean;
  pendingVerificationEmail: string | null;
  devLastVerificationCode: string | null;
  devLastResetLink: string | null;
  setPendingVerificationEmail: (email: string | null) => void;
  setDevLastVerificationCode: (code: string | null) => void;
  setDevLastResetLink: (link: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, confirmPassword: string) => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendVerificationCode: () => Promise<string | undefined>;
  logout: () => Promise<void>;
  updateSchedule: (newSchedule: WeekSchedule) => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [schedule, setSchedule] = useState<WeekSchedule>(getDefaultSchedule());
  const [settings, setSettings] = useState<UserSettings>({
    notificationsEnabled: true,
    soundEnabled: true,
    autoStartBreaks: true,
    theme: 'dark',
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [devLastVerificationCode, setDevLastVerificationCode] = useState<string | null>(null);
  const [devLastResetLink, setDevLastResetLink] = useState<string | null>(null);

  const refreshUserData = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      setUser(data.user);
      if (data.schedule) setSchedule(data.schedule);
      if (data.settings) setSettings(data.settings);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUserData();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.requiresVerification) {
        setPendingVerificationEmail(res.email);
        if (res.devVerificationCode) {
          setDevLastVerificationCode(res.devVerificationCode);
        }
        throw new Error(res.error || 'يرجى تأكيد البريد الإلكتروني أولاً');
      }

      setUser(res.user);
      if (res.schedule) setSchedule(res.schedule);
      if (res.settings) setSettings(res.settings);
      setPendingVerificationEmail(null);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, confirmPassword: string) => {
    setIsLoading(true);
    try {
      const res = await api.register(email, password, confirmPassword);
      setPendingVerificationEmail(res.email);
      if (res.devVerificationCode) {
        setDevLastVerificationCode(res.devVerificationCode);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmail = async (code: string) => {
    if (!pendingVerificationEmail) {
      throw new Error('لم يتم تحديد البريد الإلكتروني للتحقق');
    }
    setIsLoading(true);
    try {
      const res = await api.verifyEmail(pendingVerificationEmail, code);
      setUser(res.user);
      if (res.schedule) setSchedule(res.schedule);
      if (res.settings) setSettings(res.settings);
      setPendingVerificationEmail(null);
      setDevLastVerificationCode(null);
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerificationCode = async () => {
    if (!pendingVerificationEmail) return;
    const res = await api.resendVerificationCode(pendingVerificationEmail);
    if (res.devVerificationCode) {
      setDevLastVerificationCode(res.devVerificationCode);
    }
    return res.devVerificationCode;
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
      setUser(null);
      setSchedule(getDefaultSchedule());
    } finally {
      setIsLoading(false);
    }
  };

  const updateSchedule = async (newSchedule: WeekSchedule) => {
    setSchedule(newSchedule);
    try {
      await api.updateSchedule(newSchedule);
    } catch (err) {
      console.error('Failed to sync schedule:', err);
      // Revert if needed or retry
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    try {
      await api.updateSettings(newSettings);
    } catch (err) {
      console.error('Failed to sync settings:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        schedule,
        settings,
        isLoading,
        pendingVerificationEmail,
        devLastVerificationCode,
        devLastResetLink,
        setPendingVerificationEmail,
        setDevLastVerificationCode,
        setDevLastResetLink,
        login,
        register,
        verifyEmail,
        resendVerificationCode,
        logout,
        updateSchedule,
        updateSettings,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

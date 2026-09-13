import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeToggle } from './components/common/ThemeToggle';
import { AuthView } from './components/auth/AuthView';
import { Navbar } from './components/layout/Navbar';
import { TodayDashboard } from './components/dashboard/TodayDashboard';
import { CalendarView } from './components/calendar/CalendarView';
import { StatsView } from './components/stats/StatsView';
import { SettingsView } from './components/settings/SettingsView';
import { SimulatedInboxModal } from './components/SimulatedInboxModal';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, isLoading, pendingVerificationEmail } = useAuth();
  const [currentTab, setCurrentTab] = useState<'today' | 'calendar' | 'stats' | 'settings'>('today');
  const [calendarTargetDate, setCalendarTargetDate] = useState<string | undefined>(undefined);
  const [isInboxOpen, setIsInboxOpen] = useState(false);

  // Check URL query for password reset token if any
  const [urlResetToken, setUrlResetToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      if (token) {
        setUrlResetToken(token);
      }
    } catch {
      // ignore
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">جاري تحميل متابع المذاكرة...</p>
        </div>
      </div>
    );
  }

  // Not logged in or needs verification
  if (!user || pendingVerificationEmail || urlResetToken) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <header className="p-4 flex items-center justify-between max-w-5xl mx-auto w-full gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-base">متابع المذاكرة</span>
            <span className="text-[11px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              نظام متعدد المستخدمين
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Top theme switcher for anyone who wants light or dark mode */}
            <ThemeToggle variant="segmented" />

            <button
              onClick={() => setIsInboxOpen(true)}
              className="text-xs text-slate-600 hover:text-emerald-700 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xs cursor-pointer font-medium"
            >
              <span>صندوق الأكواد ✉️</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center">
          <AuthView
            resetToken={urlResetToken || undefined}
            initialMode={urlResetToken ? 'reset' : pendingVerificationEmail ? 'verify' : 'login'}
            onSuccess={() => {
              setUrlResetToken(null);
            }}
          />
        </main>

        <footer className="text-center py-4 text-xs text-slate-400">
          نظام متابعة المذاكرة الشخصي • حفظ سحابي مشفر وحسابات مستقلة
        </footer>

        <SimulatedInboxModal
          isOpen={isInboxOpen}
          onClose={() => setIsInboxOpen(false)}
        />
      </div>
    );
  }

  // User is logged in
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        currentTab={currentTab}
        onSelectTab={tab => {
          setCurrentTab(tab);
          setCalendarTargetDate(undefined);
        }}
        onOpenInbox={() => setIsInboxOpen(true)}
      />

      <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
        {currentTab === 'today' && (
          <TodayDashboard
            onNavigateToCalendar={targetDate => {
              setCalendarTargetDate(targetDate);
              setCurrentTab('calendar');
            }}
            onNavigateToSettings={() => setCurrentTab('settings')}
          />
        )}

        {currentTab === 'calendar' && (
          <CalendarView
            initialDateStr={calendarTargetDate}
            onNavigateToToday={() => setCurrentTab('today')}
          />
        )}

        {currentTab === 'stats' && <StatsView />}

        {currentTab === 'settings' && <SettingsView />}
      </main>

      <footer className="bg-white border-t border-slate-200/80 py-4 text-center text-xs text-slate-400">
        متابع المذاكرة — نظامك اليومي المستمر عبر السنين
      </footer>

      <SimulatedInboxModal
        isOpen={isInboxOpen}
        onClose={() => setIsInboxOpen(false)}
        userEmail={user.email}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

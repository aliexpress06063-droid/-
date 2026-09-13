import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../common/ThemeToggle';
import {
  BookOpen,
  CalendarDays,
  BarChart3,
  Settings,
  LogOut,
  Mail,
  Home,
  User,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'today' | 'calendar' | 'stats' | 'settings';
  onSelectTab: (tab: 'today' | 'calendar' | 'stats' | 'settings') => void;
  onOpenInbox: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, onOpenInbox }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => onSelectTab('today')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-600 to-teal-700 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base sm:text-lg text-slate-800 tracking-tight block leading-tight">
                متابع المذاكرة
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold block leading-none">
                نظام الإنجاز المستمر
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
          <button
            onClick={() => onSelectTab('today')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'today'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>لوحة اليوم</span>
          </button>

          <button
            onClick={() => onSelectTab('calendar')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'calendar'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>التقويم السنوي</span>
          </button>

          <button
            onClick={() => onSelectTab('stats')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'stats'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>الإحصائيات</span>
          </button>

          <button
            onClick={() => onSelectTab('settings')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'settings'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>إعداداتي</span>
          </button>
        </nav>

        {/* User Badge & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Switcher (Dark/Light) */}
          <ThemeToggle variant="segmented" />

          {/* Simulated Inbox Quick Access */}
          <button
            onClick={onOpenInbox}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="صندوق رسائل وأكواد التحقق"
          >
            <Mail className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">أكواد البريد</span>
          </button>

          {/* User Email Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate max-w-[140px]">{user?.email}</span>
          </div>

          {/* Logout Button */}
          <button
            id="logout-btn"
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer"
            title="تسجيل الخروج من الحساب"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">تسجيل الخروج</span>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden flex items-center justify-around bg-white border-t border-slate-200 px-2 py-2">
        <button
          onClick={() => onSelectTab('today')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-bold ${
            currentTab === 'today' ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <Home className="w-4 h-4 mb-0.5" />
          <span>اليوم</span>
        </button>
        <button
          onClick={() => onSelectTab('calendar')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-bold ${
            currentTab === 'calendar' ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <CalendarDays className="w-4 h-4 mb-0.5" />
          <span>التقويم</span>
        </button>
        <button
          onClick={() => onSelectTab('stats')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-bold ${
            currentTab === 'stats' ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <BarChart3 className="w-4 h-4 mb-0.5" />
          <span>الإحصائيات</span>
        </button>
        <button
          onClick={() => onSelectTab('settings')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-bold ${
            currentTab === 'settings' ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <Settings className="w-4 h-4 mb-0.5" />
          <span>إعداداتي</span>
        </button>
      </div>
    </header>
  );
};

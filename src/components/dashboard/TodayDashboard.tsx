import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { DayLog, SessionItem } from '../../types';
import { ARABIC_DAYS, ARABIC_MONTHS } from '../../defaultSchedule';
import { playChime } from '../../utils/audio';
import confetti from 'canvas-confetti';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Clock,
  BookOpen,
  Coffee,
  Sparkles,
  Save,
  Check,
  AlertCircle,
  SkipForward,
  Flame,
  Calendar,
} from 'lucide-react';

interface TodayDashboardProps {
  onNavigateToCalendar?: (dateStr?: string) => void;
  onNavigateToSettings?: () => void;
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({
  onNavigateToCalendar,
  onNavigateToSettings,
}) => {
  const { user, schedule, settings } = useAuth();

  // Real clock & date tracking
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format date strings
  const year = currentDate.getFullYear();
  const monthIdx = currentDate.getMonth();
  const dayOfMonth = currentDate.getDate();
  const dayOfWeek = currentDate.getDay(); // 0 = Sunday
  const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;

  const arabicDayName = ARABIC_DAYS[dayOfWeek];
  const arabicMonthName = ARABIC_MONTHS[monthIdx];
  const formattedArabicDate = `${arabicDayName}، ${dayOfMonth} ${arabicMonthName} ${year}`;

  // Today's schedule config for this user
  const todaySchedule = schedule[dayOfWeek] || {
    dayOfWeek,
    dayName: arabicDayName,
    subject: 'مذاكرة حرة',
    isRest: false,
    sessions: [],
  };

  // Day log state
  const [dayLog, setDayLog] = useState<DayLog>({
    date: dateStr,
    dayOfWeek,
    subject: todaySchedule.subject,
    isRest: todaySchedule.isRest,
    completedSessions: [],
    totalSessions: todaySchedule.sessions.length,
    status: todaySchedule.isRest ? 'rest' : 'not_started',
    notes: '',
    updatedAt: new Date().toISOString(),
  });

  const [isLoadingLog, setIsLoadingLog] = useState(true);
  const [notesText, setNotesText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Timer State
  const [activeSessionIndex, setActiveSessionIndex] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [timerRemainingSeconds, setTimerRemainingSeconds] = useState<number>(0);
  const [timerTotalDuration, setTimerTotalDuration] = useState<number>(0);
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(null);

  const activeSession: SessionItem | undefined = todaySchedule.sessions[activeSessionIndex];

  // Fetch or sync day log from API
  useEffect(() => {
    let isMounted = true;
    const fetchLog = async () => {
      setIsLoadingLog(true);
      try {
        const res = await api.getDayLog(dateStr);
        if (isMounted) {
          if (res.log) {
            setDayLog(res.log);
            setNotesText(res.log.notes || '');
          } else {
            // Initial default
            const initialLog: DayLog = {
              date: dateStr,
              dayOfWeek,
              subject: todaySchedule.subject,
              isRest: todaySchedule.isRest,
              completedSessions: [],
              totalSessions: todaySchedule.sessions.length,
              status: todaySchedule.isRest ? 'rest' : 'not_started',
              notes: '',
              updatedAt: new Date().toISOString(),
            };
            setDayLog(initialLog);
            setNotesText('');
          }
        }
      } catch (err) {
        console.error('Error fetching today log:', err);
      } finally {
        if (isMounted) setIsLoadingLog(false);
      }
    };

    fetchLog();
    return () => {
      isMounted = false;
    };
  }, [dateStr, dayOfWeek, todaySchedule.subject, todaySchedule.isRest, todaySchedule.sessions.length]);

  // Load / initialize timer
  useEffect(() => {
    if (!activeSession) return;

    const timerStorageKey = `timer_${user?.id}_${dateStr}`;
    const saved = localStorage.getItem(timerStorageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.sessionIndex !== undefined && todaySchedule.sessions[parsed.sessionIndex]) {
          setActiveSessionIndex(parsed.sessionIndex);
          setTimerTotalDuration(parsed.totalDuration);

          if (parsed.isRunning && parsed.startTimestamp) {
            const elapsed = Math.floor((Date.now() - parsed.startTimestamp) / 1000);
            const remaining = Math.max(0, parsed.remainingAtStart - elapsed);
            setTimerRemainingSeconds(remaining);
            setTimerStartTimestamp(parsed.startTimestamp);
            setIsTimerRunning(remaining > 0);
          } else {
            setTimerRemainingSeconds(parsed.remainingSeconds);
            setIsTimerRunning(false);
            setTimerStartTimestamp(null);
          }
          return;
        }
      } catch (e) {
        console.warn('Failed to restore timer state:', e);
      }
    }

    // Default to active session duration
    const duration = (activeSession.durationMinutes || 30) * 60;
    setTimerTotalDuration(duration);
    setTimerRemainingSeconds(duration);
    setIsTimerRunning(false);
    setTimerStartTimestamp(null);
  }, [activeSessionIndex, activeSession?.id, dateStr, user?.id]);

  // Persist timer state to localStorage whenever running state changes
  useEffect(() => {
    if (!user) return;
    const timerStorageKey = `timer_${user.id}_${dateStr}`;
    const stateToSave = {
      sessionIndex: activeSessionIndex,
      isRunning: isTimerRunning,
      remainingSeconds: timerRemainingSeconds,
      remainingAtStart: timerRemainingSeconds,
      startTimestamp: timerStartTimestamp,
      totalDuration: timerTotalDuration,
    };
    try {
      localStorage.setItem(timerStorageKey, JSON.stringify(stateToSave));
    } catch {
      // ignore
    }
  }, [isTimerRunning, timerRemainingSeconds, activeSessionIndex, timerStartTimestamp, timerTotalDuration, user, dateStr]);

  // Main real-time timer countdown loop
  useEffect(() => {
    if (!isTimerRunning || !timerStartTimestamp) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStartTimestamp) / 1000);
      const remaining = Math.max(0, timerTotalDuration - elapsed);
      setTimerRemainingSeconds(remaining);

      if (remaining <= 0) {
        // Session ended
        handleSessionCompletedAutomatically();
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isTimerRunning, timerStartTimestamp, timerTotalDuration, activeSessionIndex]);

  // Handle session finish
  const handleSessionCompletedAutomatically = () => {
    setIsTimerRunning(false);
    setTimerStartTimestamp(null);

    if (!activeSession) return;

    // Play chime sound
    if (settings.soundEnabled) {
      playChime(activeSession.type === 'study' ? 'complete' : 'break');
    }

    // Mark current session as completed in log
    const updatedCompleted = Array.from(new Set([...dayLog.completedSessions, activeSession.id]));
    const isAllDone = updatedCompleted.length >= todaySchedule.sessions.length;

    const updatedLog: DayLog = {
      ...dayLog,
      completedSessions: updatedCompleted,
      status: isAllDone ? 'completed' : 'in_progress',
      updatedAt: new Date().toISOString(),
    };
    setDayLog(updatedLog);
    api.updateDayLog(dateStr, updatedLog);

    // Show appropriate user notice
    if (activeSession.type === 'study') {
      setNoticeMessage(`أحسنت! انتهيت من جلسة ${activeSession.title} ✅`);
    } else {
      setNoticeMessage('انتهت الراحة، حان وقت الجلسة التالية 💪');
    }

    // Move to next session if available
    if (activeSessionIndex + 1 < todaySchedule.sessions.length) {
      const nextIndex = activeSessionIndex + 1;
      const nextSession = todaySchedule.sessions[nextIndex];
      setActiveSessionIndex(nextIndex);
      const nextDuration = (nextSession.durationMinutes || 15) * 60;
      setTimerTotalDuration(nextDuration);
      setTimerRemainingSeconds(nextDuration);

      if (settings.autoStartBreaks && nextSession.type === 'break') {
        setTimeout(() => {
          setIsTimerRunning(true);
          setTimerStartTimestamp(Date.now());
          setNoticeMessage('وقت الراحة الآن 🌿');
        }, 1500);
      }
    } else {
      // Finished all sessions!
      triggerCelebration();
    }
  };

  const triggerCelebration = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  // Timer Controls
  const startTimer = () => {
    if (!activeSession) return;
    const now = Date.now();
    setTimerStartTimestamp(now - (timerTotalDuration - timerRemainingSeconds) * 1000);
    setIsTimerRunning(true);
    if (settings.soundEnabled) playChime('start');
  };

  const pauseTimer = () => {
    setIsTimerRunning(false);
    setTimerStartTimestamp(null);
  };

  const resetTimer = () => {
    if (!activeSession) return;
    setIsTimerRunning(false);
    setTimerStartTimestamp(null);
    const duration = (activeSession.durationMinutes || 30) * 60;
    setTimerTotalDuration(duration);
    setTimerRemainingSeconds(duration);
  };

  const finishSessionManually = () => {
    handleSessionCompletedAutomatically();
  };

  const skipToNextSession = () => {
    if (activeSessionIndex + 1 < todaySchedule.sessions.length) {
      const nextIndex = activeSessionIndex + 1;
      const nextSession = todaySchedule.sessions[nextIndex];
      setActiveSessionIndex(nextIndex);
      setIsTimerRunning(false);
      setTimerStartTimestamp(null);
      const nextDuration = (nextSession.durationMinutes || 30) * 60;
      setTimerTotalDuration(nextDuration);
      setTimerRemainingSeconds(nextDuration);
    }
  };

  // Toggle specific session item in checklist
  const toggleSessionCompleted = async (sessionId: string) => {
    const isCompleted = dayLog.completedSessions.includes(sessionId);
    const newCompleted = isCompleted
      ? dayLog.completedSessions.filter(id => id !== sessionId)
      : [...dayLog.completedSessions, sessionId];

    const isAllDone = newCompleted.length === todaySchedule.sessions.length && todaySchedule.sessions.length > 0;
    const newStatus = isAllDone ? 'completed' : newCompleted.length > 0 ? 'in_progress' : 'not_started';

    const updated = {
      ...dayLog,
      completedSessions: newCompleted,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    setDayLog(updated);
    try {
      await api.updateDayLog(dateStr, updated);
      if (isAllDone) triggerCelebration();
    } catch (err) {
      console.error(err);
    }
  };

  // Complete full day
  const handleCompleteDay = async () => {
    const allIds = todaySchedule.sessions.map(s => s.id);
    const updated = {
      ...dayLog,
      completedSessions: allIds,
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDayLog(updated);
    triggerCelebration();
    try {
      await api.updateDayLog(dateStr, updated);
      setNoticeMessage('🎉 مبارك! تم تسجيل اليوم كمكتمل بنجاح وحفظه في سجلك التاريخي.');
    } catch (err) {
      console.error(err);
    }
  };

  // Save notes
  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const updated = { ...dayLog, notes: notesText, updatedAt: new Date().toISOString() };
      await api.updateDayLog(dateStr, updated);
      setDayLog(updated);
      setNotesSavedSuccess(true);
      setTimeout(() => setNotesSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Calculations
  const totalSessionsCount = todaySchedule.sessions.length;
  const completedSessionsCount = dayLog.completedSessions.length;
  const progressPercent = totalSessionsCount > 0
    ? Math.round((completedSessionsCount / totalSessionsCount) * 100)
    : (todaySchedule.isRest ? 100 : 0);

  const formatTimerDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12" id="today-dashboard-view">
      {/* Header Greeting & Real Date Bar */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
              أهلاً بك 👋
            </h1>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              متصل سحابياً
            </span>
          </div>
          <p className="text-base text-slate-600 font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>{formattedArabicDate}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-center">
            <span className="text-[11px] font-semibold text-slate-400 block">الوقت الحالي</span>
            <span className="text-base font-bold text-slate-700 font-mono">
              {currentDate.toLocaleTimeString('ar-SA')}
            </span>
          </div>

          <button
            onClick={() => onNavigateToCalendar && onNavigateToCalendar(dateStr)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>سجل التقويم الكامل</span>
          </button>
        </div>
      </div>

      {/* Notice Banner if any */}
      {noticeMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-semibold">{noticeMessage}</span>
          </div>
          <button
            onClick={() => setNoticeMessage(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* 4 Instant Answers Cards ("وش علي اليوم؟ وش أسوي الآن؟ كم باقي؟ وش أنجزت؟") */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="instant-metrics-panel">
        {/* Card 1: مادة اليوم */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
              <span>وش علي اليوم؟</span>
              <BookOpen className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs text-slate-500 font-semibold block mb-0.5">مادة اليوم</span>
            <h2 className="text-xl font-bold text-slate-800">
              {todaySchedule.isRest ? 'اليوم راحة 🌿' : todaySchedule.subject}
            </h2>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-500">
            <span>{todaySchedule.isRest ? 'استمتع بيومك' : `${totalSessionsCount} جلسات مخصصة`}</span>
            <button
              onClick={onNavigateToSettings}
              className="text-emerald-700 hover:underline font-semibold cursor-pointer"
            >
              تعديل الجدول
            </button>
          </div>
        </div>

        {/* Card 2: مهمتك الآن */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
              <span>وش أسوي الآن؟</span>
              {activeSession?.type === 'break' ? (
                <Coffee className="w-4 h-4 text-amber-500" />
              ) : (
                <Flame className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <span className="text-xs text-slate-500 font-semibold block mb-0.5">مهمتك الآن</span>
            <h2 className="text-xl font-bold text-slate-800 truncate">
              {todaySchedule.isRest
                ? 'استرخاء وراحة'
                : activeSession
                ? activeSession.title
                : 'لا توجد جلسة محددة'}
            </h2>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                activeSession?.type === 'break'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {todaySchedule.isRest
                ? 'راحة'
                : activeSession?.type === 'break'
                ? 'فترة راحة 🌿'
                : 'جلسة مذاكرة 📚'}
            </span>
            {activeSession && (
              <span className="text-[11px] text-slate-400 font-mono">
                {activeSession.startTime}–{activeSession.endTime}
              </span>
            )}
          </div>
        </div>

        {/* Card 3: الوقت المتبقي */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
              <span>كم باقي؟</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-xs text-slate-500 font-semibold block mb-0.5">الوقت المتبقي للجلسة</span>
            <div className="text-2xl font-bold text-slate-800 font-mono tracking-tight">
              {todaySchedule.isRest ? '—' : formatTimerDisplay(timerRemainingSeconds)}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-500">
            <span>{isTimerRunning ? 'المؤقت قيد التشغيل' : 'المؤقت متوقف'}</span>
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isTimerRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
              }`}
            />
          </div>
        </div>

        {/* Card 4: نسبة إنجاز اليوم */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
              <span>وش أنجزت؟ وش باقي؟</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-xs text-slate-500 font-semibold">نسبة إنجاز اليوم</span>
              <span className="text-sm font-bold text-emerald-600">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              {completedSessionsCount} من {totalSessionsCount} جلسات مكتملة
            </span>
            {progressPercent === 100 && (
              <span className="text-emerald-700 font-bold">🎉 ممتاز!</span>
            )}
          </div>
        </div>
      </div>

      {/* 100% Milestone Banner */}
      {progressPercent === 100 && !todaySchedule.isRest && (
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <h3 className="font-bold text-base">تم إنجاز جميع مهام اليوم!</h3>
              <p className="text-xs text-emerald-100">
                أداء استثنائي اليوم، اضغط على زر "تم إنجاز اليوم" لتوثيقه في تقويمك وسجلك التاريخي.
              </p>
            </div>
          </div>
          <button
            onClick={handleCompleteDay}
            className="px-4 py-2 bg-white text-emerald-800 font-bold text-xs rounded-xl hover:bg-emerald-50 transition-colors shadow-xs cursor-pointer flex-shrink-0"
          >
            توثيق الإنجاز ✓
          </button>
        </div>
      )}

      {/* Real-time Interactive Timer (المؤقت الحقيقي والتفاعلي) */}
      {!todaySchedule.isRest && totalSessionsCount > 0 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 text-center" id="interactive-timer-section">
          {/* Status Mode Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-4 bg-slate-100 text-slate-700">
            {activeSession?.type === 'break' ? (
              <>
                <Coffee className="w-4 h-4 text-amber-500" />
                <span>وضع الاستراحة 🌿</span>
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>وضع المذاكرة والتركيز 📚</span>
              </>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">
            {activeSession ? activeSession.title : 'جلسة مذاكرة'}
          </h2>
          {activeSession && (
            <p className="text-xs text-slate-500 mb-6">
              الموعد المجدول: {activeSession.startTime} – {activeSession.endTime} ({activeSession.durationMinutes} دقيقة)
            </p>
          )}

          {/* Big Digital Countdown Clock */}
          <div className="inline-flex items-center justify-center p-8 rounded-3xl bg-slate-50/80 border border-slate-200/80 mb-6">
            <span className="text-5xl sm:text-7xl font-bold font-mono text-slate-800 tracking-wider select-none">
              {formatTimerDisplay(timerRemainingSeconds)}
            </span>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-md mx-auto">
            {!isTimerRunning ? (
              <button
                id="start-timer-btn"
                onClick={startTimer}
                className="flex-1 min-w-[140px] py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{timerRemainingSeconds < timerTotalDuration ? 'استئناف' : 'ابدأ الجلسة'}</span>
              </button>
            ) : (
              <button
                id="pause-timer-btn"
                onClick={pauseTimer}
                className="flex-1 min-w-[140px] py-3.5 px-6 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
              >
                <Pause className="w-4 h-4" />
                <span>إيقاف مؤقت</span>
              </button>
            )}

            <button
              id="finish-session-btn"
              onClick={finishSessionManually}
              className="py-3.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-sm"
              title="إنهاء الجلسة واحتسابها"
            >
              <Check className="w-4 h-4 text-emerald-600" />
              <span>إنهاء الجلسة</span>
            </button>

            <button
              id="reset-timer-btn"
              onClick={resetTimer}
              className="p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
              title="إعادة ضبط وقت الجلسة"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {activeSessionIndex + 1 < todaySchedule.sessions.length && (
              <button
                id="skip-next-session-btn"
                onClick={skipToNextSession}
                className="p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
                title="الانتقال للجلسة التالية"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-4">
            * يعتمد المؤقت على الوقت الحقيقي الفعلي؛ حتى لو أغلقت الصفحة أو أعدت تحميلها سيستمر احتساب الوقت بدقة.
          </p>
        </div>
      )}

      {/* Rest Day view if Friday / Rest */}
      {todaySchedule.isRest && (
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-8 text-center" id="rest-day-card">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center mb-3">
            <Coffee className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-900 mb-2">اليوم راحة 🌿</h2>
          <p className="text-sm text-emerald-700 max-w-md mx-auto mb-5">
            الراحة المنتظمة جزء لا يتجزأ من الاستمرارية والتفوق دون ضغط أو إرهاق. استعد ليوم غدٍ بحيوية!
          </p>
          <button
            onClick={handleCompleteDay}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            تسجيل يوم الراحة في السجل ✓
          </button>
        </div>
      )}

      {/* Grid: 1. متابعة اليوم (Today's Tasks) & 2. ملاحظات اليوم (Daily Notes) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* متابعة اليوم (Today's Tasks Checklist) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100" id="today-tasks-section">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">متابعة اليوم</h2>
              <p className="text-xs text-slate-400">
                مهام وجلسات اليوم مرتبة زمنياً
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                مكتملة
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                قيد التنفيذ
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                لم تبدأ
              </span>
            </div>
          </div>

          {todaySchedule.sessions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              لا توجد جلسات مجدولة لهذا اليوم.
            </div>
          ) : (
            <div className="space-y-3">
              {todaySchedule.sessions.map((sess, idx) => {
                const isCompleted = dayLog.completedSessions.includes(sess.id);
                const isCurrentActive = idx === activeSessionIndex && !isCompleted;

                return (
                  <div
                    key={sess.id}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                      isCompleted
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : isCurrentActive
                        ? 'bg-slate-50 border-emerald-500 ring-1 ring-emerald-500/30'
                        : 'bg-white border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <button
                        onClick={() => toggleSessionCompleted(sess.id)}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          isCompleted
                            ? 'bg-emerald-600 text-white'
                            : 'border-2 border-slate-300 hover:border-emerald-500 text-transparent'
                        }`}
                        title={isCompleted ? 'إلغاء التحديد' : 'تحديد كمكتمل'}
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold ${
                              isCompleted ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}
                          >
                            {sess.title}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                              sess.type === 'break'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {sess.type === 'break' ? 'راحة' : 'مذاكرة'}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          {sess.startTime} – {sess.endTime} ({sess.durationMinutes} دقيقة)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-lg">
                          ✅ مكتملة
                        </span>
                      ) : isCurrentActive ? (
                        <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-2.5 py-1 rounded-lg">
                          ⏳ قيد التنفيذ
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                          ○ لم تبدأ
                        </span>
                      )}

                      {!isCompleted && idx !== activeSessionIndex && (
                        <button
                          onClick={() => {
                            setActiveSessionIndex(idx);
                            setIsTimerRunning(false);
                            setTimerStartTimestamp(null);
                            const duration = (sess.durationMinutes || 30) * 60;
                            setTimerTotalDuration(duration);
                            setTimerRemainingSeconds(duration);
                          }}
                          className="text-xs text-slate-500 hover:text-emerald-700 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          تفعيل بالمؤقت
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* إنهاء اليوم (Day Completion Button) */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              حالة اليوم الحالية:{' '}
              <span className="font-bold text-slate-800">
                {dayLog.status === 'completed'
                  ? '✅ مكتمل ومسجل'
                  : dayLog.status === 'in_progress'
                  ? '⏳ قيد التنفيذ'
                  : 'لم يكتمل بعد'}
              </span>
            </div>

            <button
              id="mark-day-done-btn"
              onClick={handleCompleteDay}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تم إنجاز اليوم ✓</span>
            </button>
          </div>
        </div>

        {/* ملاحظات اليوم (Daily Notes Linked to Date) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between" id="today-notes-section">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-800">ملاحظات اليوم</h2>
              <span className="text-[11px] text-slate-400 font-mono">{dateStr}</span>
            </div>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              سجّل هنا أي صعوبات واجهتك، عدد الأسئلة المنجزة، أخطاء تود مراجعتها، أو نقاط للتحسين:
            </p>

            <textarea
              id="today-notes-textarea"
              rows={8}
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="اكتب ملاحظاتك هنا...&#10;• نقاط واجهت فيها صعوبة...&#10;• عدد الأسئلة التي تم حلها...&#10;• ملاحظات لمراجعتها لاحقاً..."
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-xs sm:text-sm leading-relaxed transition-all resize-none"
            />
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            {notesSavedSuccess ? (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                تم الحفظ بنجاح
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                يتم ربط الملاحظات بهذا اليوم تلقائياً
              </span>
            )}

            <button
              id="save-notes-btn"
              onClick={handleSaveNotes}
              disabled={isSavingNotes}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingNotes ? 'جاري الحفظ...' : 'حفظ الملاحظات'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { DayLog, DaySchedule, SessionItem } from '../../types';
import { ARABIC_DAYS, ARABIC_MONTHS } from '../../defaultSchedule';
import {
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  BookOpen,
  Coffee,
  X,
  Save,
  Check,
  CalendarDays,
  FileText,
} from 'lucide-react';

interface CalendarViewProps {
  initialDateStr?: string;
  onNavigateToToday?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ initialDateStr, onNavigateToToday }) => {
  const { schedule } = useAuth();

  // Selected date for viewing / navigating
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(() => {
    if (initialDateStr) {
      const parsed = new Date(initialDateStr);
      if (!isNaN(parsed.getFullYear())) return parsed.getFullYear();
    }
    return today.getFullYear();
  });

  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    if (initialDateStr) {
      const parsed = new Date(initialDateStr);
      if (!isNaN(parsed.getMonth())) return parsed.getMonth();
    }
    return today.getMonth();
  });

  // All logs fetched from cloud
  const [allLogs, setAllLogs] = useState<Record<string, DayLog>>({});
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // Day detail modal
  const [selectedDayDetail, setSelectedDayDetail] = useState<{
    dateStr: string;
    dayOfWeek: number;
    scheduleForDay: DaySchedule;
    log: DayLog | null;
  } | null>(null);

  const [detailNotes, setDetailNotes] = useState('');
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch all logs
  const loadAllLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await api.getAllDayLogs();
      setAllLogs(res.logs || {});
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadAllLogs();
  }, []);

  // Compute days in currentMonth and currentYear
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sunday

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleYearChange = (newYear: number) => {
    setCurrentYear(newYear);
  };

  // Open day detail
  const openDayModal = (dayNumber: number) => {
    const date = new Date(currentYear, currentMonth, dayNumber);
    const dayOfWeek = date.getDay();
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const scheduleForDay = schedule[dayOfWeek] || {
      dayOfWeek,
      dayName: ARABIC_DAYS[dayOfWeek],
      subject: 'مذاكرة',
      isRest: false,
      sessions: [],
    };

    const existingLog = allLogs[dateStr] || null;
    setSelectedDayDetail({
      dateStr,
      dayOfWeek,
      scheduleForDay,
      log: existingLog,
    });
    setDetailNotes(existingLog?.notes || '');
    setSaveSuccess(false);
  };

  // Save changes from modal
  const saveModalDayLog = async (statusOverride?: 'completed' | 'not_completed' | 'in_progress' | 'not_started') => {
    if (!selectedDayDetail) return;
    setIsSavingDetail(true);

    const { dateStr, dayOfWeek, scheduleForDay, log } = selectedDayDetail;
    const isRest = scheduleForDay.isRest;
    const totalSessions = scheduleForDay.sessions.length;

    const newStatus = statusOverride !== undefined ? statusOverride : (log?.status || (isRest ? 'rest' : 'not_started'));
    const completed = statusOverride === 'completed'
      ? scheduleForDay.sessions.map(s => s.id)
      : (log?.completedSessions || []);

    const updatedLog: DayLog = {
      date: dateStr,
      dayOfWeek,
      subject: scheduleForDay.subject,
      isRest,
      completedSessions: completed,
      totalSessions,
      status: newStatus,
      notes: detailNotes,
      completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    };

    try {
      await api.updateDayLog(dateStr, updatedLog);
      setAllLogs(prev => ({ ...prev, [dateStr]: updatedLog }));
      setSelectedDayDetail(prev => prev ? { ...prev, log: updatedLog } : null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingDetail(false);
    }
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Years array for infinite navigation (e.g. 5 years back to 10 years ahead, plus custom number input)
  const currentYearInt = today.getFullYear();
  const yearOptions = Array.from({ length: 21 }, (_, i) => currentYearInt - 5 + i);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12" id="calendar-view-container">
      {/* Calendar Top Navigation Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-800">
              التقويم الكامل وسجل المذاكرة
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            تصفح جميع السنوات السابقة والقادمة، وتتبع التزامك وجدولك المستمر على مر السنين
          </p>
        </div>

        {/* Year, Month & Today Quick Nav */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year selector */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <span className="text-xs text-slate-400 font-semibold pl-1">السنة:</span>
            <select
              value={currentYear}
              onChange={e => handleYearChange(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none cursor-pointer py-1"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Month Stepper */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="الشهر السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-bold text-slate-800 min-w-[90px] text-center">
              {ARABIC_MONTHS[currentMonth]}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="الشهر التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Quick jump to today */}
          <button
            onClick={() => {
              setCurrentYear(today.getFullYear());
              setCurrentMonth(today.getMonth());
            }}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition-colors cursor-pointer"
          >
            الشهر الحالي
          </button>
        </div>
      </div>

      {/* Month quick pills selector */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-[700px] justify-between">
          {ARABIC_MONTHS.map((monthName, idx) => (
            <button
              key={monthName}
              onClick={() => setCurrentMonth(idx)}
              className={`flex-1 py-2 px-1 text-xs font-bold rounded-xl transition-all text-center whitespace-nowrap cursor-pointer ${
                currentMonth === idx
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {monthName}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white rounded-2xl px-6 py-3 border border-slate-100">
        <span className="text-slate-400 font-semibold">دليل الحالات:</span>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            ✅ تم الإنجاز
          </span>
          <span className="flex items-center gap-1.5 text-amber-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            ⏳ قيد التنفيذ
          </span>
          <span className="flex items-center gap-1.5 text-rose-700">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            ❌ لم يكتمل
          </span>
          <span className="flex items-center gap-1.5 text-teal-700">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" />
            🌿 راحة
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
            — لم يبدأ
          </span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100" id="monthly-calendar-grid">
        {/* Day of Week Column Headers */}
        <div className="grid grid-cols-7 gap-2 mb-3 text-center">
          {ARABIC_DAYS.map((dayName, idx) => (
            <div
              key={dayName}
              className={`py-2 text-xs font-bold rounded-lg ${
                idx === 5 ? 'text-teal-700 bg-teal-50/50' : 'text-slate-500 bg-slate-50'
              }`}
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Days Cells */}
        <div className="grid grid-cols-7 gap-2">
          {/* Empty cells for leading offset */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] bg-slate-50/40 rounded-xl border border-transparent" />
          ))}

          {/* Days in Month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const cellDate = new Date(currentYear, currentMonth, dayNum);
            const dayOfWeek = cellDate.getDay();
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;

            // Auto apply schedule for this day
            const scheduledDay = schedule[dayOfWeek] || {
              dayOfWeek,
              dayName: ARABIC_DAYS[dayOfWeek],
              subject: 'مذاكرة',
              isRest: false,
              sessions: [],
            };

            const log = allLogs[dateStr];
            const isPast = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());

            // Determine status
            let statusBadge = {
              text: '— لم يبدأ',
              bg: 'bg-slate-50 text-slate-400 border-slate-200',
              badgeColor: 'text-slate-400',
            };

            if (scheduledDay.isRest) {
              statusBadge = {
                text: '🌿 راحة',
                bg: 'bg-teal-50/60 text-teal-800 border-teal-200',
                badgeColor: 'text-teal-600',
              };
            } else if (log?.status === 'completed') {
              statusBadge = {
                text: '✅ مكتمل',
                bg: 'bg-emerald-50/80 text-emerald-800 border-emerald-200',
                badgeColor: 'text-emerald-600',
              };
            } else if (log?.status === 'in_progress') {
              statusBadge = {
                text: '⏳ قيد التنفيذ',
                bg: 'bg-amber-50 text-amber-800 border-amber-200',
                badgeColor: 'text-amber-600',
              };
            } else if (log?.status === 'not_completed' || (isPast && (!log || log.status !== 'completed') && !scheduledDay.isRest)) {
              statusBadge = {
                text: '❌ لم يكتمل',
                bg: 'bg-rose-50/70 text-rose-800 border-rose-200',
                badgeColor: 'text-rose-600',
              };
            }

            const totalSessions = scheduledDay.sessions.length;
            const completedCount = log?.completedSessions?.length || 0;
            const hasNotes = Boolean(log?.notes && log.notes.trim().length > 0);

            return (
              <div
                key={dateStr}
                onClick={() => openDayModal(dayNum)}
                className={`min-h-[105px] p-2.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-emerald-400 group relative ${
                  isToday
                    ? 'ring-2 ring-emerald-500 bg-white shadow-xs border-emerald-500'
                    : 'bg-white border-slate-100 hover:bg-slate-50/50'
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center font-mono ${
                      isToday
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-700 group-hover:text-emerald-700'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {hasNotes && (
                    <span title="توجد ملاحظات لهذا اليوم" className="text-amber-500">
                      <FileText className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Subject name */}
                <div className="my-1 text-right">
                  <span className="text-[11px] font-bold text-slate-800 block truncate" title={scheduledDay.subject}>
                    {scheduledDay.isRest ? 'راحة 🌿' : scheduledDay.subject}
                  </span>
                  {!scheduledDay.isRest && totalSessions > 0 && (
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {completedCount}/{totalSessions} جلسات
                    </span>
                  )}
                </div>

                {/* Status Pill */}
                <div className="text-center">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border block truncate ${statusBadge.bg}`}
                  >
                    {statusBadge.text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-100 font-medium">سجل المذاكرة التاريخي</span>
                <h3 className="text-lg font-bold">
                  {ARABIC_DAYS[selectedDayDetail.dayOfWeek]}،{' '}
                  {new Date(selectedDayDetail.dateStr).getDate()}{' '}
                  {ARABIC_MONTHS[new Date(selectedDayDetail.dateStr).getMonth()]}{' '}
                  {new Date(selectedDayDetail.dateStr).getFullYear()}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDayDetail(null)}
                className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
              {/* Subject & Status */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-xs text-slate-400 font-semibold block">مادة اليوم المجدولة:</span>
                  <span className="text-base font-bold text-slate-800">
                    {selectedDayDetail.scheduleForDay.isRest
                      ? 'يوم راحة 🌿'
                      : selectedDayDetail.scheduleForDay.subject}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-semibold block">حالة اليوم:</span>
                  <span className="text-xs font-bold text-slate-700">
                    {selectedDayDetail.log?.status === 'completed'
                      ? '✅ مكتمل'
                      : selectedDayDetail.log?.status === 'in_progress'
                      ? '⏳ قيد التنفيذ'
                      : selectedDayDetail.log?.status === 'not_completed'
                      ? '❌ لم يكتمل'
                      : selectedDayDetail.scheduleForDay.isRest
                      ? '🌿 راحة'
                      : '— لم يبدأ'}
                  </span>
                </div>
              </div>

              {/* Sessions Checklist for this day */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                  جلسات هذا اليوم ({selectedDayDetail.scheduleForDay.sessions.length} جلسات)
                </h4>
                {selectedDayDetail.scheduleForDay.sessions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">لا توجد جلسات لهذا اليوم (يوم راحة)</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayDetail.scheduleForDay.sessions.map(sess => {
                      const isDone = selectedDayDetail.log?.completedSessions?.includes(sess.id);
                      return (
                        <div
                          key={sess.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50/80 rounded-lg border border-slate-200 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className={isDone ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                              {isDone ? '✓' : '○'}
                            </span>
                            <span className={isDone ? 'line-through text-slate-400' : 'text-slate-800 font-semibold'}>
                              {sess.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {sess.startTime} – {sess.endTime}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notes for this specific date */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                  ملاحظات هذا اليوم
                </h4>
                <textarea
                  rows={4}
                  value={detailNotes}
                  onChange={e => setDetailNotes(e.target.value)}
                  placeholder="سجّل ملاحظاتك لهذا التاريخ (الأسئلة المحلولة، الصعوبات، الأخطاء)..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs leading-relaxed transition-all resize-none"
                />
              </div>

              {/* Quick Status Action buttons */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold ml-2">تحديث حالة اليوم:</span>
                <button
                  type="button"
                  onClick={() => saveModalDayLog('completed')}
                  disabled={isSavingDetail}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  تسجيل كمكتمل ✓
                </button>
                <button
                  type="button"
                  onClick={() => saveModalDayLog('not_completed')}
                  disabled={isSavingDetail}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  تسجيل كغير مكتمل ✗
                </button>
              </div>

              {saveSuccess && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>تم حفظ التغييرات بنجاح في السجل التاريخي</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setSelectedDayDetail(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>

              <button
                onClick={() => saveModalDayLog()}
                disabled={isSavingDetail}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingDetail ? 'جاري الحفظ...' : 'حفظ الملاحظات'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { DayLog, UserStats } from '../../types';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Flame,
  Calendar,
  Layers,
  Filter,
  BarChart3,
  Award,
} from 'lucide-react';

export const StatsView: React.FC = () => {
  const { schedule } = useAuth();
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('all');
  const [logs, setLogs] = useState<Record<string, DayLog>>({});
  const [serverStats, setServerStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [logsRes, statsRes] = await Promise.all([
          api.getAllDayLogs(),
          api.getStats(),
        ]);
        setLogs(logsRes.logs || {});
        setServerStats(statsRes.stats || null);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter logs based on selected period
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const filteredLogs: DayLog[] = (Object.values(logs) as DayLog[]).filter((log: DayLog) => {
    if (filterPeriod === 'all') return true;
    if (filterPeriod === 'today') return log.date === todayStr;

    const logDate = new Date(log.date);
    if (filterPeriod === 'year') {
      return logDate.getFullYear() === now.getFullYear();
    }
    if (filterPeriod === 'month') {
      return (
        logDate.getFullYear() === now.getFullYear() &&
        logDate.getMonth() === now.getMonth()
      );
    }
    if (filterPeriod === 'week') {
      const diffTime = Math.abs(now.getTime() - logDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }
    return true;
  });

  // Calculate filtered stats
  const completedDaysCount = filteredLogs.filter(l => l.status === 'completed').length;
  const incompleteDaysCount = filteredLogs.filter(l => l.status === 'not_completed').length;
  const totalLogged = completedDaysCount + incompleteDaysCount;
  const commitmentRate = totalLogged > 0 ? Math.round((completedDaysCount / totalLogged) * 100) : 100;

  let completedSessionsTotal = 0;
  filteredLogs.forEach(l => {
    completedSessionsTotal += l.completedSessions?.length || 0;
  });

  const longestStreak = serverStats?.longestStreak || 0;
  const currentStreak = serverStats?.currentStreak || 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12" id="stats-view-container">
      {/* Header & Filter Bar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold text-slate-800">
              الإحصائيات وسجل الإنجاز
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            تحليل دقيق ومباشر لمدى التزامك، وسلاسل الإنجاز المتتالية على مدار الوقت
          </p>
        </div>

        {/* Filter Period Tabs */}
        <div className="flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          {(
            [
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'الأسبوع' },
              { id: 'month', label: 'الشهر' },
              { id: 'year', label: 'السنة' },
              { id: 'all', label: 'جميع السنوات' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterPeriod(tab.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                filterPeriod === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="kpi-cards-grid">
        {/* Card 1: نسبة الالتزام */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">نسبة الالتزام</span>
            <div className="text-3xl font-bold text-slate-800 font-mono">
              {commitmentRate}%
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
              {commitmentRate >= 80 ? 'معدل التزام استثنائي' : 'واصل السعي للأفضل'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: أيام مكتملة */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">أيام مكتملة</span>
            <div className="text-3xl font-bold text-slate-800 font-mono">
              {completedDaysCount}
            </div>
            <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">
              من إجمالي {totalLogged} أيام موثقة
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: أيام غير مكتملة */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">أيام غير مكتملة</span>
            <div className="text-3xl font-bold text-slate-800 font-mono">
              {incompleteDaysCount}
            </div>
            <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">
              يمكنك تعويضها دائماً
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: جلسات مكتملة */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">جلسات مكتملة</span>
            <div className="text-3xl font-bold text-slate-800 font-mono">
              {completedSessionsTotal}
            </div>
            <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">
              جلسة مذاكرة وتطبيق
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Card 5: أطول سلسلة إنجاز */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">أطول سلسلة إنجاز</span>
            <div className="text-3xl font-bold text-slate-800 font-mono">
              {longestStreak} <span className="text-sm font-sans font-normal text-slate-500">أيام</span>
            </div>
            <span className="text-[11px] text-amber-600 font-semibold mt-1 inline-block">
              سلسلة مستمرة دون انقطاع
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        {/* Card 6: السلسلة الحالية */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">السلسلة الحالية</span>
            <div className="text-3xl font-bold text-slate-800 font-mono">
              {currentStreak} <span className="text-sm font-sans font-normal text-slate-500">أيام</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
              حافظ على زخمك اليومي!
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Detailed Historical Log Table */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">سجل الإنجاز التفصيلي</h2>
            <p className="text-xs text-slate-400">
              قائمة بجميع الأيام والتواريخ الموثقة مع نسب الإنجاز والملاحظات
            </p>
          </div>
          <span className="text-xs bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-600">
            {filteredLogs.length} سجل
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            لا توجد سجلات بعد في هذه الفترة المحددة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold">
                  <th className="pb-3 pr-2">التاريخ</th>
                  <th className="pb-3">المادة</th>
                  <th className="pb-3">الحالة</th>
                  <th className="pb-3">الجلسات المنجزة</th>
                  <th className="pb-3">الملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(log => {
                    const completedCount = log.completedSessions?.length || 0;
                    const totalCount = log.totalSessions || 0;
                    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                    return (
                      <tr key={log.date} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 pr-2 font-mono font-semibold text-slate-800">
                          {log.date}
                        </td>
                        <td className="py-3 font-semibold text-slate-700">
                          {log.isRest ? 'راحة 🌿' : log.subject}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              log.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800'
                                : log.status === 'not_completed'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {log.status === 'completed'
                              ? '✅ مكتمل'
                              : log.status === 'in_progress'
                              ? '⏳ قيد التنفيذ'
                              : log.status === 'not_completed'
                              ? '❌ غير مكتمل'
                              : '🌿 راحة'}
                          </span>
                        </td>
                        <td className="py-3 font-mono">
                          {completedCount} / {totalCount} ({pct}%)
                        </td>
                        <td className="py-3 text-slate-500 truncate max-w-xs" title={log.notes}>
                          {log.notes ? log.notes : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

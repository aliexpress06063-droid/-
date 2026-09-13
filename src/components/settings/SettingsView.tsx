import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../common/ThemeToggle';
import { ARABIC_DAYS, getDefaultSchedule, DEFAULT_SESSIONS } from '../../defaultSchedule';
import { WeekSchedule, DaySchedule, SessionItem } from '../../types';
import {
  Settings,
  Calendar,
  Layers,
  Save,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  BookOpen,
  ShieldCheck,
  Lock,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { schedule, updateSchedule, settings, updateSettings, user, token } = useAuth();

  // Local draft of schedule for editing
  const [draftSchedule, setDraftSchedule] = useState<WeekSchedule>(JSON.parse(JSON.stringify(schedule)));
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(0); // 0 = الأحد

  // Security audit state
  const [securityLogs, setSecurityLogs] = useState<Array<{ id: string; timestamp: string; eventType: string; status: string; ip: string; details?: string }>>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // Study Method Templates
  const [methodPreset, setMethodPreset] = useState<string>('default');

  // Saving states
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleSavedSuccess, setScheduleSavedSuccess] = useState(false);

  // Sound & Timer settings
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [autoStartBreaks, setAutoStartBreaks] = useState(settings.autoStartBreaks);
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false);

  const currentDayConfig: DaySchedule = draftSchedule[selectedDayOfWeek] || {
    dayOfWeek: selectedDayOfWeek,
    dayName: ARABIC_DAYS[selectedDayOfWeek],
    subject: 'مذاكرة',
    isRest: false,
    sessions: [],
  };

  const handleUpdateSubject = (newSubject: string) => {
    setDraftSchedule(prev => ({
      ...prev,
      [selectedDayOfWeek]: {
        ...prev[selectedDayOfWeek],
        subject: newSubject,
      },
    }));
  };

  const handleToggleRestDay = (isRest: boolean) => {
    setDraftSchedule(prev => ({
      ...prev,
      [selectedDayOfWeek]: {
        ...prev[selectedDayOfWeek],
        isRest,
        subject: isRest ? 'راحة' : (prev[selectedDayOfWeek].subject === 'راحة' ? 'مذاكرة' : prev[selectedDayOfWeek].subject),
      },
    }));
  };

  const handleUpdateSession = (sessionId: string, field: keyof SessionItem, value: any) => {
    setDraftSchedule(prev => {
      const day = prev[selectedDayOfWeek];
      const updatedSessions = day.sessions.map(s => {
        if (s.id === sessionId) {
          return { ...s, [field]: value };
        }
        return s;
      });
      return {
        ...prev,
        [selectedDayOfWeek]: {
          ...day,
          sessions: updatedSessions,
        },
      };
    });
  };

  const handleAddSession = () => {
    const newSession: SessionItem = {
      id: `custom_${Date.now()}`,
      title: 'جلسة جديدة',
      type: 'study',
      startTime: '11:00',
      endTime: '11:45',
      durationMinutes: 45,
    };

    setDraftSchedule(prev => ({
      ...prev,
      [selectedDayOfWeek]: {
        ...prev[selectedDayOfWeek],
        sessions: [...prev[selectedDayOfWeek].sessions, newSession],
      },
    }));
  };

  const handleRemoveSession = (sessionId: string) => {
    setDraftSchedule(prev => ({
      ...prev,
      [selectedDayOfWeek]: {
        ...prev[selectedDayOfWeek],
        sessions: prev[selectedDayOfWeek].sessions.filter(s => s.id !== sessionId),
      },
    }));
  };

  // Apply Study Method Preset
  const applyStudyMethod = (preset: string, applyToAllDays: boolean = false) => {
    let newSessions: SessionItem[] = [];

    if (preset === 'standard') {
      // فهم → حل أسئلة → مراجعة أخطاء
      newSessions = [
        { id: `s1_${Date.now()}`, title: 'فهم وشرح', type: 'study', startTime: '08:00', endTime: '09:00', durationMinutes: 60 },
        { id: `s2_${Date.now()}`, title: 'راحة', type: 'break', startTime: '09:00', endTime: '09:15', durationMinutes: 15 },
        { id: `s3_${Date.now()}`, title: 'حل أسئلة', type: 'study', startTime: '09:15', endTime: '10:15', durationMinutes: 60 },
        { id: `s4_${Date.now()}`, title: 'راحة', type: 'break', startTime: '10:15', endTime: '10:30', durationMinutes: 15 },
        { id: `s5_${Date.now()}`, title: 'مراجعة الأخطاء', type: 'study', startTime: '10:30', endTime: '11:00', durationMinutes: 30 },
      ];
    } else if (preset === 'four_stages') {
      // شرح → تطبيق → اختبار → مراجعة
      newSessions = [
        { id: `fs1_${Date.now()}`, title: 'شرح المفهوم', type: 'study', startTime: '08:00', endTime: '08:45', durationMinutes: 45 },
        { id: `fs2_${Date.now()}`, title: 'راحة', type: 'break', startTime: '08:45', endTime: '09:00', durationMinutes: 15 },
        { id: `fs3_${Date.now()}`, title: 'تطبيق عملي', type: 'study', startTime: '09:00', endTime: '09:45', durationMinutes: 45 },
        { id: `fs4_${Date.now()}`, title: 'راحة', type: 'break', startTime: '09:45', endTime: '10:00', durationMinutes: 15 },
        { id: `fs5_${Date.now()}`, title: 'اختبار تجريبي', type: 'study', startTime: '10:00', endTime: '10:45', durationMinutes: 45 },
        { id: `fs6_${Date.now()}`, title: 'مراجعة شاملة', type: 'study', startTime: '10:45', endTime: '11:15', durationMinutes: 30 },
      ];
    } else if (preset === 'pomodoro') {
      // بومودورو 25د + 5د
      newSessions = [
        { id: `p1_${Date.now()}`, title: 'جلسة تركيز 1', type: 'study', startTime: '08:00', endTime: '08:25', durationMinutes: 25 },
        { id: `p2_${Date.now()}`, title: 'استراحة قصيرة', type: 'break', startTime: '08:25', endTime: '08:30', durationMinutes: 5 },
        { id: `p3_${Date.now()}`, title: 'جلسة تركيز 2', type: 'study', startTime: '08:30', endTime: '08:55', durationMinutes: 25 },
        { id: `p4_${Date.now()}`, title: 'استراحة قصيرة', type: 'break', startTime: '08:55', endTime: '09:00', durationMinutes: 5 },
        { id: `p5_${Date.now()}`, title: 'جلسة تركيز 3', type: 'study', startTime: '09:00', endTime: '09:25', durationMinutes: 25 },
        { id: `p6_${Date.now()}`, title: 'استراحة طويلة', type: 'break', startTime: '09:25', endTime: '09:45', durationMinutes: 20 },
      ];
    }

    if (newSessions.length === 0) return;

    setDraftSchedule(prev => {
      const updated = { ...prev };
      if (applyToAllDays) {
        Object.keys(updated).forEach(k => {
          const dayKey = Number(k);
          if (!updated[dayKey].isRest) {
            updated[dayKey] = {
              ...updated[dayKey],
              sessions: JSON.parse(JSON.stringify(newSessions)),
            };
          }
        });
      } else {
        updated[selectedDayOfWeek] = {
          ...updated[selectedDayOfWeek],
          sessions: newSessions,
        };
      }
      return updated;
    });
  };

  const handleResetToDefault = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في استعادة الجدول الافتراضي؟')) {
      setDraftSchedule(getDefaultSchedule());
    }
  };

  const handleSaveSchedule = async () => {
    setIsSavingSchedule(true);
    try {
      await updateSchedule(draftSchedule);
      setScheduleSavedSuccess(true);
      setTimeout(() => setScheduleSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleSavePreferences = async () => {
    await updateSettings({
      soundEnabled,
      autoStartBreaks,
    });
    setSettingsSavedSuccess(true);
    setTimeout(() => setSettingsSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12" id="settings-view-container">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-800">إعداداتي وتخصيص الجدول</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            خصص جدولك، موادك، وطريقة مذاكرتك المفضلة؛ جميع التغييرات تحفظ بحسابك وتستمر على مر السنين
          </p>
        </div>

        <div className="text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
          الحساب: <span className="font-bold text-slate-800 font-mono">{user?.email}</span>
        </div>
      </div>

      {/* SECTION 1: تخصيص طريقة المذاكرة (Study Method Customizer) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-800">تخصيص طريقة المذاكرة</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          اختر نمط المذاكرة والمراحل التي تناسبك وطبقها على اليوم الحالي أو جميع أيام الأسبوع:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <button
            type="button"
            onClick={() => applyStudyMethod('standard', false)}
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-right cursor-pointer group"
          >
            <span className="text-xs font-bold text-emerald-700 block mb-1">
              فهم → حل أسئلة → مراجعة أخطاء
            </span>
            <p className="text-[11px] text-slate-500">
              النموذج الافتراضي المتوازن: ساعة فهم وشرح، راحة، ساعة حل أسئلة، ونصف ساعة مراجعة الأخطاء.
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyStudyMethod('four_stages', false)}
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-right cursor-pointer group"
          >
            <span className="text-xs font-bold text-emerald-700 block mb-1">
              شرح → تطبيق → اختبار → مراجعة
            </span>
            <p className="text-[11px] text-slate-500">
              نمط المراحل الأربع الأكاديمي لجلسات معمقة واختبار الذات قبل المراجعة.
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyStudyMethod('pomodoro', false)}
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-right cursor-pointer group"
          >
            <span className="text-xs font-bold text-emerald-700 block mb-1">
              بومودورو متقطع (25د + 5د)
            </span>
            <p className="text-[11px] text-slate-500">
              فترات تركيز حادة تليها استراحات منتظمة للحفاظ على التركيز العالي.
            </p>
          </button>
        </div>

        <div className="flex items-center justify-between text-xs pt-2">
          <span className="text-slate-400">
            * النقر على أي نمط يطبق جلساته على اليوم المختار أدناه.
          </span>
          <button
            type="button"
            onClick={() => applyStudyMethod('standard', true)}
            className="text-emerald-700 hover:underline font-bold cursor-pointer"
          >
            تطبيق النمط القياسي على جميع أيام الأسبوع
          </button>
        </div>
      </div>

      {/* SECTION 2: تخصيص الجدول الأسبوعي (Weekly Schedule Editor) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-800">تخصيص جدول الأيام والمواد</h2>
          </div>

          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الجدول الافتراضي</span>
          </button>
        </div>

        {/* Days Pills Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
          {ARABIC_DAYS.map((dayName, idx) => {
            const dayConfig = draftSchedule[idx];
            return (
              <button
                key={dayName}
                onClick={() => setSelectedDayOfWeek(idx)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer flex flex-col items-center gap-0.5 min-w-[95px] ${
                  selectedDayOfWeek === idx
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                }`}
              >
                <span>{dayName}</span>
                <span className={`text-[10px] font-normal truncate max-w-[80px] ${
                  selectedDayOfWeek === idx ? 'text-emerald-100' : 'text-slate-400'
                }`}>
                  {dayConfig?.isRest ? 'راحة 🌿' : dayConfig?.subject || 'مذاكرة'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Day Configuration Form */}
        <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                مادة يوم ({ARABIC_DAYS[selectedDayOfWeek]}):
              </label>
              <input
                type="text"
                disabled={currentDayConfig.isRest}
                value={currentDayConfig.subject}
                onChange={e => handleUpdateSubject(e.target.value)}
                placeholder="مثلاً: قدرات كمي، فيزياء، رياضيات، STEP..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2.5 bg-white px-4 py-2.5 rounded-xl border border-slate-200 w-full cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentDayConfig.isRest}
                  onChange={e => handleToggleRestDay(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-700">
                  تحديد هذا اليوم كيوم راحة 🌿
                </span>
              </label>
            </div>
          </div>

          {/* Sessions List for this day */}
          {!currentDayConfig.isRest && (
            <div className="pt-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-700">
                  جلسات ومراحل يوم {ARABIC_DAYS[selectedDayOfWeek]} ({currentDayConfig.sessions.length} جلسة):
                </span>
                <button
                  type="button"
                  onClick={handleAddSession}
                  className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة جلسة أو مرحلة</span>
                </button>
              </div>

              {currentDayConfig.sessions.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                  لا توجد جلسات مجدولة، اضغط "إضافة جلسة أو مرحلة" لإضافة مهمة جديدة.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {currentDayConfig.sessions.map((sess, sIdx) => (
                    <div
                      key={sess.id}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                        <span className="text-xs font-bold text-slate-400 font-mono w-5">
                          #{sIdx + 1}
                        </span>

                        <input
                          type="text"
                          value={sess.title}
                          onChange={e => handleUpdateSession(sess.id, 'title', e.target.value)}
                          placeholder="اسم المهمة أو المرحلة"
                          className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />

                        <select
                          value={sess.type}
                          onChange={e => handleUpdateSession(sess.id, 'type', e.target.value as any)}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none cursor-pointer"
                        >
                          <option value="study">مذاكرة 📚</option>
                          <option value="break">راحة 🌿</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-slate-400">من</span>
                          <input
                            type="time"
                            value={sess.startTime}
                            onChange={e => handleUpdateSession(sess.id, 'startTime', e.target.value)}
                            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono"
                          />
                          <span className="text-slate-400">إلى</span>
                          <input
                            type="time"
                            value={sess.endTime}
                            onChange={e => handleUpdateSession(sess.id, 'endTime', e.target.value)}
                            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono"
                          />
                        </div>

                        <div className="flex items-center gap-1 text-xs">
                          <input
                            type="number"
                            min={5}
                            max={180}
                            value={sess.durationMinutes}
                            onChange={e => handleUpdateSession(sess.id, 'durationMinutes', Number(e.target.value))}
                            className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono text-center"
                          />
                          <span className="text-slate-400">د</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSession(sess.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="حذف الجلسة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save Schedule Button */}
        <div className="flex items-center justify-between pt-2">
          {scheduleSavedSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <Check className="w-4 h-4" />
              تم حفظ الجدول وتطبيقه على كافة السنوات بنجاح ✓
            </span>
          )}
          <div className="mr-auto">
            <button
              type="button"
              id="save-schedule-btn"
              onClick={handleSaveSchedule}
              disabled={isSavingSchedule}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingSchedule ? 'جاري الحفظ...' : 'حفظ ومزامنة الجدول'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: تفضيلات المؤقت والصوت (Preferences & Audio) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-800">إعدادات المؤقت والتنبيهات</h2>
        </div>

        <div className="space-y-4 max-w-xl">
          {/* Theme Mode Option */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-800 block">نمط المظهر العام (أسود / أبيض)</span>
              <span className="text-[11px] text-slate-400">
                التبديل بين الوضع الأسود الداكن المريح للعين والوضع الأبيض الفاتح
              </span>
            </div>
            <ThemeToggle variant="segmented" />
          </div>

          <label className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
            <div>
              <span className="text-xs font-bold text-slate-800 block">نغمات التنبيه الهادئة</span>
              <span className="text-[11px] text-slate-400">
                تشغيل صوت هادئ ومريح عند انتهاء الجلسة وبدء الراحة
              </span>
            </div>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={e => setSoundEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
            <div>
              <span className="text-xs font-bold text-slate-800 block">الانتقال التلقائي للراحة</span>
              <span className="text-[11px] text-slate-400">
                بدء مؤقت الاستراحة تلقائياً بمجرد انتهاء جلسة المذاكرة
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoStartBreaks}
              onChange={e => setAutoStartBreaks(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
          </label>

          <div className="pt-2 flex items-center justify-between">
            {settingsSavedSuccess && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <Check className="w-4 h-4" />
                تم حفظ التفضيلات بنجاح
              </span>
            )}
            <button
              type="button"
              onClick={handleSavePreferences}
              className="mr-auto px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              حفظ التفضيلات
            </button>
          </div>
        </div>
      </div>

      {/* Security & Privacy Audit Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">الأمان وخصوصية البيانات (Security & Privacy)</h2>
              <p className="text-xs text-slate-500">
                حسابك محمي بتشفير متقدم، وعزل كامل للبيانات، ومصادقة بالرموز المشفرة من جانب الخادم
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              if (showLogs) {
                setShowLogs(false);
                return;
              }
              setLoadingLogs(true);
              try {
                const res = await fetch('/api/user/security-audit', {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                });
                const data = await res.json();
                if (data.logs) {
                  setSecurityLogs(data.logs);
                  setShowLogs(true);
                }
              } catch (err) {
                console.error(err);
              } finally {
                setLoadingLogs(false);
              }
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-2"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{showLogs ? 'إخفاء سجل الأمان' : 'عرض سجل الأمان المباشر'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-emerald-700 block mb-1">عزل تام للبيانات (IDOR Defense)</span>
            <p className="text-[11px] text-slate-500">
              لا يمكن لأي مستخدم الوصول لجداولك أو مذكراتك؛ التحقق يتم بحزم عبر جلسة الخادم المعتمدة.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-indigo-700 block mb-1">تجزئة كلمات المرور والرموز</span>
            <p className="text-[11px] text-slate-500">
              تشفير PBKDF2-SHA512 ومقارنات Constant-Time لمنع هجمات التوقيت والتخمين الآلي.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-amber-700 block mb-1">حماية ضد الهجمات المتكررة (Rate Limit)</span>
            <p className="text-[11px] text-slate-500">
              تحديد عدد محاولات الدخول والتحقق لمنع هجمات القوة الغاشمة وحظر الرموز بعد 5 محاولات خاطئة.
            </p>
          </div>
        </div>

        {showLogs && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 mb-2">أحدث الأحداث الأمنية الخاصة بحسابك:</h3>
            {loadingLogs ? (
              <div className="text-xs text-slate-400 py-3 text-center">جاري تحميل سجل الأمان...</div>
            ) : securityLogs.length === 0 ? (
              <div className="text-xs text-slate-400 py-3 text-center">لا توجد أحداث أمنية مسجلة بعد.</div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {securityLogs.map(log => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs border border-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="font-bold text-slate-700">{log.eventType}</span>
                      {log.details && <span className="text-slate-500 text-[11px]">- {log.details}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
                      <span>IP: {log.ip}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString('ar-EG')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

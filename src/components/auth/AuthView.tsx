import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { BookOpen, CheckCircle2, AlertCircle, ArrowRight, KeyRound, Mail, Lock, RefreshCw, Copy, Check } from 'lucide-react';

interface AuthViewProps {
  initialMode?: 'login' | 'register' | 'verify' | 'forgot' | 'reset';
  resetToken?: string;
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ initialMode = 'login', resetToken: propResetToken, onSuccess }) => {
  const {
    login,
    register,
    verifyEmail,
    resendVerificationCode,
    pendingVerificationEmail,
    setPendingVerificationEmail,
    devLastVerificationCode,
    devLastResetLink,
    setDevLastResetLink,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'verify' | 'forgot' | 'reset'>(
    pendingVerificationEmail ? 'verify' : propResetToken ? 'reset' : initialMode
  );

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resetToken, setResetToken] = useState(propResetToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // UI feedback
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  // Update mode if pending email changes
  useEffect(() => {
    if (pendingVerificationEmail && mode !== 'verify') {
      setMode('verify');
      setError(null);
    }
  }, [pendingVerificationEmail]);

  // Handle countdown for resend code
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !email.includes('@')) {
      setError('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }
    if (password.length < 6) {
      setError('كلمة المرور يجب ألا تقل عن 6 أحرف');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, confirmPassword);
      setMode('verify');
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'فشل إنشاء الحساب، يرجى المحاولة مرة أخرى');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!verificationCode.trim()) {
      setError('يرجى إدخال رمز التحقق');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyEmail(verificationCode.trim());
      setSuccessMessage('تم تأكيد بريدك الإلكتروني بنجاح ✓');
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'رمز التحقق غير صحيح');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      await resendVerificationCode();
      setResendCooldown(60);
      setSuccessMessage('تم إرسال رمز تحقق جديد بنجاح');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'تعذر إعادة إرسال الرمز');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      if (pendingVerificationEmail) {
        setMode('verify');
      } else {
        setError(err.message || 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !email.includes('@')) {
      setError('يرجى إدخال بريدك الإلكتروني المسجل');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.forgotPassword(email);
      setSuccessMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
      if (res.devResetLink) {
        setDevLastResetLink(res.devResetLink);
        setResetToken(res.devResetToken || '');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إرسال الرابط');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!resetToken) {
      setError('رمز أو رابط إعادة التعيين غير متوفر');
      return;
    }
    if (newPassword.length < 6) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.resetPassword(resetToken, newPassword, confirmNewPassword);
      setSuccessMessage(res.message || 'تم حفظ كلمة المرور بنجاح');
      setTimeout(() => {
        setMode('login');
        setSuccessMessage('يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'فشل إعادة تعيين كلمة المرور');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillTestCode = () => {
    if (devLastVerificationCode) {
      setVerificationCode(devLastVerificationCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6" id="auth-container">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-8 text-white text-center relative">
          <div className="w-14 h-14 bg-white/15 backdrop-blur rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-inner">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">نظام متابعة المذاكرة</h1>
          <p className="text-emerald-100 text-sm mt-1">
            {mode === 'login' && 'سجّل دخولك للوصول إلى جدولك وإحصائياتك'}
            {mode === 'register' && 'أنشئ حسابك المستقل وابدأ رحلة الالتزام'}
            {mode === 'verify' && 'تأكيد البريد الإلكتروني'}
            {mode === 'forgot' && 'استعادة كلمة المرور'}
            {mode === 'reset' && 'تعيين كلمة مرور جديدة'}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          {/* Messages */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {/* MODE: VERIFY (Step 2 & 3) */}
          {mode === 'verify' && (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-2">
                  <Mail className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">
                  تم إرسال رمز تحقق إلى بريدك الإلكتروني
                </h2>
                <p className="text-sm text-slate-500 mt-1 font-mono dir-ltr select-all">
                  {pendingVerificationEmail || email}
                </p>
              </div>

              {/* Dev helper code banner for instant seamless testing */}
              {devLastVerificationCode && (
                <div className="mb-5 p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">رمز التحقق المُرسل:</span>
                    <span className="font-mono text-base font-bold tracking-widest text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-200">
                      {devLastVerificationCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={fillTestCode}
                    className="inline-flex items-center gap-1 text-xs text-amber-800 hover:text-amber-950 font-medium underline cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>تعبئة الرمز</span>
                  </button>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-5">
                <div>
                  <label htmlFor="verify-code" className="block text-sm font-semibold text-slate-700 mb-2 text-center">
                    أدخل رمز التحقق (6 أرقام)
                  </label>
                  <input
                    id="verify-code"
                    type="text"
                    maxLength={6}
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="مثلاً: 483921"
                    className="w-full text-center text-2xl font-bold tracking-[0.3em] py-3.5 px-4 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-mono"
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 text-center mt-2">
                    رمز التحقق مؤقت وينتهي بعد 15 دقيقة
                  </p>
                </div>

                <button
                  id="confirm-email-btn"
                  type="submit"
                  disabled={isSubmitting || verificationCode.length < 6}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {isSubmitting ? 'جاري التحقق...' : 'تأكيد البريد الإلكتروني'}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-semibold disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resendCooldown > 0 ? 'animate-spin text-slate-400' : ''}`} />
                  <span>
                    {resendCooldown > 0
                      ? `إعادة إرسال الرمز (${resendCooldown} ثانية)`
                      : 'إعادة إرسال الرمز'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPendingVerificationEmail(null);
                    setMode('login');
                    setError(null);
                  }}
                  className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  العودة لتسجيل الدخول
                </button>
              </div>
            </div>
          )}

          {/* MODE: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  البريد الإلكتروني <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition-all"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  كلمة المرور <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition-all"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  id="forgot-password-btn"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer text-sm"
              >
                {isSubmitting ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </button>

              <div className="text-center pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  ليس لديك حساب بعد؟{' '}
                  <button
                    type="button"
                    id="switch-to-register-btn"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                  >
                    إنشاء حساب جديد
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* MODE: REGISTER (Step 1) */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  البريد الإلكتروني <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="register-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition-all"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  إجباري ولا يمكن إنشاء حساب بدونه
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  كلمة المرور <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="register-password"
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="6 أحرف أو أكثر"
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition-all"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  تأكيد كلمة المرور <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="register-confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition-all"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <button
                id="register-submit-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer text-sm"
              >
                {isSubmitting ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
              </button>

              <div className="text-center pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  لديك حساب بالفعل؟{' '}
                  <button
                    type="button"
                    id="switch-to-login-btn"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                  >
                    تسجيل الدخول
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* MODE: FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-slate-100 text-slate-600 mb-2">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800">نسيت كلمة المرور؟</h3>
                <p className="text-xs text-slate-500 mt-1">
                  أدخل بريدك الإلكتروني وسنرسل لك رابطاً آمناً ومؤقتاً لإعادة تعيين كلمة المرور
                </p>
              </div>

              {devLastResetLink && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                  <p className="font-semibold mb-1">رابط إعادة التعيين (لتجربتك المباشرة):</p>
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    className="w-full text-center py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    فتح شاشة إعادة تعيين كلمة المرور مباشرة
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  أدخل بريدك الإلكتروني
                </label>
                <div className="relative">
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition-all"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <button
                id="send-reset-link-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer text-sm"
              >
                {isSubmitting ? 'جاري الإرسال...' : 'إرسال رابط إعادة تعيين كلمة المرور'}
              </button>

              <div className="text-center pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  العودة لتسجيل الدخول
                </button>
              </div>
            </form>
          )}

          {/* MODE: RESET PASSWORD */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-base font-bold text-slate-800">إعادة تعيين كلمة المرور</h3>
                <p className="text-xs text-slate-500 mt-1">
                  أدخل كلمة المرور الجديدة لحسابك
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  كلمة المرور الجديدة <span className="text-rose-500">*</span>
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="6 أحرف أو أكثر"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  تأكيد كلمة المرور الجديدة <span className="text-rose-500">*</span>
                </label>
                <input
                  id="reset-confirm-new-password"
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition-all"
                />
              </div>

              <button
                id="save-new-password-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer text-sm"
              >
                {isSubmitting ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
              </button>

              <div className="text-center pt-3">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  العودة لتسجيل الدخول
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

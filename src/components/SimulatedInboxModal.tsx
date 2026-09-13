import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Mail, RefreshCw, X, Copy, Check, ExternalLink } from 'lucide-react';

interface SimulatedInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  onSelectCode?: (code: string) => void;
  onSelectResetToken?: (token: string) => void;
}

export const SimulatedInboxModal: React.FC<SimulatedInboxModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  onSelectCode,
  onSelectResetToken,
}) => {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const data = await api.getSimulatedInbox(userEmail);
      setEmails(data.emails || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmails();
    }
  }, [isOpen, userEmail]);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">صندوق بريد التحقق (تجربة حية)</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchEmails}
              disabled={loading}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="تحديث"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3">
          <p className="text-xs text-slate-500 mb-2">
            جميع رسائل التحقق وأكواد الـ 6 أرقام وروابط إعادة التعيين تُسجل هنا لحظياً لتسهيل تجربتك:
          </p>

          {emails.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              لم يتم إرسال أي رسائل بريد بعد. عند التسجيل أو طلب استعادة كلمة المرور ستظهر الرسالة هنا مباشرة.
            </div>
          ) : (
            emails.map(emailItem => (
              <div
                key={emailItem.id}
                className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700">{emailItem.subject}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(emailItem.sentAt).toLocaleTimeString('ar-SA')}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mb-2 font-mono">
                  إلى: <span className="text-slate-800 font-medium">{emailItem.email}</span>
                </div>

                {emailItem.code && (
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">رمز التحقق:</span>
                      <span className="text-base font-bold font-mono tracking-widest text-emerald-700">
                        {emailItem.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(emailItem.code, emailItem.id)}
                        className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                      >
                        {copiedId === emailItem.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>نسخ</span>
                      </button>
                      {onSelectCode && (
                        <button
                          onClick={() => {
                            onSelectCode(emailItem.code);
                            onClose();
                          }}
                          className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold transition-colors cursor-pointer"
                        >
                          تعبئة
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {emailItem.resetLink && (
                  <div className="mt-2 bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-600 mb-1.5 font-medium">
                      رابط إعادة التعيين المؤقت:
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-500 truncate max-w-[200px]">
                        {emailItem.resetLink}
                      </span>
                      {onSelectResetToken && (
                        <button
                          onClick={() => {
                            const token = emailItem.resetLink.split('token=')[1];
                            if (token) onSelectResetToken(token);
                            onClose();
                          }}
                          className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>فتح</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

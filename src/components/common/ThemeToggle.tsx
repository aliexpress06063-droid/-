import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'pill' | 'compact' | 'segmented';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'segmented', className = '' }) => {
  const { theme, setTheme, toggleTheme } = useTheme();

  if (variant === 'compact') {
    return (
      <button
        id="theme-toggle-compact-btn"
        type="button"
        onClick={toggleTheme}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
          theme === 'dark'
            ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700 shadow-xs'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 shadow-xs'
        } ${className}`}
        title={theme === 'dark' ? 'التبديل إلى الوضع الأبيض (فاتح)' : 'التبديل إلى الوضع الأسود (داكن)'}
      >
        {theme === 'dark' ? (
          <>
            <Moon className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">الوضع الأسود</span>
          </>
        ) : (
          <>
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">الوضع الأبيض</span>
          </>
        )}
      </button>
    );
  }

  // Segmented control: The user specifically asked:
  // "حط فوق خانة للي يبي يحطه ابيض او يرجعه اسود"
  // This provides two distinct, clear clickable options!
  return (
    <div
      id="theme-segmented-switch"
      className={`inline-flex items-center p-1 rounded-xl border transition-all ${
        theme === 'dark'
          ? 'bg-slate-900/90 border-slate-700/80 shadow-inner'
          : 'bg-slate-100 border-slate-200 shadow-inner'
      } ${className}`}
      role="group"
      aria-label="اختيار نمط العرض (أسود أو أبيض)"
    >
      {/* Dark / Black Option */}
      <button
        id="theme-btn-dark"
        type="button"
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          theme === 'dark'
            ? 'bg-slate-800 text-white shadow-xs border border-slate-600/50'
            : 'text-slate-500 hover:text-slate-800'
        }`}
        title="الوضع الداكن (الأسود)"
      >
        <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-amber-400' : 'text-slate-400'}`} />
        <span>أسود</span>
      </button>

      {/* Light / White Option */}
      <button
        id="theme-btn-light"
        type="button"
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          theme === 'light'
            ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        title="الوضع الفاتح (الأبيض)"
      >
        <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-500' : 'text-slate-500'}`} />
        <span>أبيض</span>
      </button>
    </div>
  );
};

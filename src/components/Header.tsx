import React from 'react';
import { BookOpen, Moon, Sun, Settings, Sparkles, Flame, Volume2, VolumeX } from 'lucide-react';
import { StreakData } from '../services/streak';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenSettings: () => void;
  dueTodayCount: number;
  totalCount: number;
  masteredCount: number;
  streak: StreakData;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  setDarkMode,
  onOpenSettings,
  dueTodayCount,
  totalCount,
  masteredCount,
  streak,
  soundEnabled,
  onToggleSound,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors pt-[env(safe-area-inset-top)]">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
              <span>Sổ Từ Vựng</span>
              <span className="hidden sm:inline-flex text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
                Spaced Repetition
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
              Ôn đúng thời điểm • Thuộc sâu 4 kỹ năng
            </p>
          </div>
        </div>

        {/* Stats chips & actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Streak Flame Badge */}
          <div
            title={`Chuỗi ngày học liên tục: ${streak.currentStreak} ngày (Kỷ lục: ${streak.longestStreak} ngày)`}
            className={`px-2 sm:px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1 sm:gap-1.5 transition shrink-0 ${
              streak.currentStreak > 0
                ? 'bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
            }`}
          >
            <Flame
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                streak.currentStreak > 0
                  ? 'text-orange-500 fill-orange-500/20'
                  : 'text-slate-400'
              }`}
            />
            <span>
              {streak.currentStreak > 0 ? (
                <>
                  <span>{streak.currentStreak}</span>
                  <span className="hidden sm:inline"> ngày</span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">0</span>
                  <span className="hidden sm:inline">Chưa có streak</span>
                </>
              )}
            </span>
          </div>

          {/* Desktop Stats Chips */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-medium">
            <div className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Cần ôn: <strong className="font-bold">{dueTodayCount}</strong>
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              Đã thuộc: <strong className="font-bold">{masteredCount}</strong>/{totalCount}
            </div>
          </div>

          {/* Sound Mute/Unmute Toggle */}
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Tắt âm thanh hiệu ứng' : 'Bật âm thanh hiệu ứng'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition shrink-0"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            )}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition shrink-0"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Cài đặt AI & Sao lưu"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition shrink-0"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

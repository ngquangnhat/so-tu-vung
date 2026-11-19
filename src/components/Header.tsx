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
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Sổ Từ Vựng
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                Spaced Repetition
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Ôn đúng thời điểm • Thuộc sâu 4 kỹ năng
            </p>
          </div>
        </div>

        {/* Stats chips & actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Streak Flame Badge */}
          <div
            title={`Chuỗi ngày học liên tục: ${streak.currentStreak} ngày (Kỷ lục: ${streak.longestStreak} ngày)`}
            className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition ${
              streak.currentStreak > 0
                ? 'bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
            }`}
          >
            <Flame
              className={`w-4 h-4 ${
                streak.currentStreak > 0
                  ? 'text-orange-500 fill-orange-500/20'
                  : 'text-slate-400'
              }`}
            />
            <span>
              {streak.currentStreak > 0 ? `${streak.currentStreak} ngày` : 'Chưa có streak'}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-medium">
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
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <VolumeX className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Cài đặt AI & Sao lưu"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

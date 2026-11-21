import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, PlusCircle, Library } from 'lucide-react';
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { ReviewTab } from './components/ReviewTab';
import { AddCardTab } from './components/AddCardTab';
import { LibraryTab } from './components/LibraryTab';
import { ReviewSession } from './components/ReviewSession';
import { db, seedInitialCardsIfEmpty } from './services/db';
import { isDueToday } from './services/srs';
import { Card, ReviewMode, MASTERED_BOX_THRESHOLD } from './types/card';
import { getStreakInfo, StreakData } from './services/streak';
import { isSoundEnabled, setSoundEnabled } from './services/sound';

type ActiveTab = 'review' | 'add' | 'library';

export const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem('vocab_theme') === 'dark' ||
      (!('vocab_theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('review');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sound effects state
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(isSoundEnabled);

  // Streak state
  const [streak, setStreak] = useState<StreakData>(getStreakInfo);

  // Active review session state
  const [activeReviewSession, setActiveReviewSession] = useState<{
    mode: ReviewMode;
    cards: Card[];
    isFreePractice?: boolean;
  } | null>(null);

  // Apply dark mode class to html document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('vocab_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('vocab_theme', 'light');
    }
  }, [darkMode]);

  // Safely initialize database and ensure sample cards are removed
  useEffect(() => {
    seedInitialCardsIfEmpty().catch((err: unknown) => {
      console.error('Failed to initialize database', err);
    });
  }, []);

  // Refresh streak on mount and tab switch
  useEffect(() => {
    setStreak(getStreakInfo());
  }, [activeTab, activeReviewSession]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setSoundEnabled(next);
  };

  // Reactive live query from Dexie IndexedDB
  const cards = useLiveQuery(() => db.cards.toArray(), []) || [];

  // Metrics
  const dueTodayCount = cards.filter((card) => isDueToday(card.due)).length;
  const totalCount = cards.length;
  const masteredCount = cards.filter((card) => card.box >= MASTERED_BOX_THRESHOLD).length;

  const handleStartReview = (mode: ReviewMode, reviewCards: Card[], isFreePractice = false) => {
    setActiveReviewSession({ mode, cards: reviewCards, isFreePractice });
  };

  const handleFinishReview = () => {
    setActiveReviewSession(null);
    setStreak(getStreakInfo());
    setActiveTab('review');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Header
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
        dueTodayCount={dueTodayCount}
        totalCount={totalCount}
        masteredCount={masteredCount}
        streak={streak}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {activeReviewSession ? (
          <ReviewSession
            initialCards={activeReviewSession.cards}
            selectedMode={activeReviewSession.mode}
            isFreePractice={activeReviewSession.isFreePractice}
            onFinishSession={handleFinishReview}
            onCancel={() => {
              setActiveReviewSession(null);
              setStreak(getStreakInfo());
            }}
          />
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Primary Tab Navigation */}
            <div className="flex justify-center">
              <nav className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex p-1 sm:p-1.5 rounded-2xl bg-slate-200/80 dark:bg-slate-900 border border-slate-300/50 dark:border-slate-800 shadow-inner">
                <button
                  onClick={() => setActiveTab('review')}
                  className={`px-2 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
                    activeTab === 'review'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Ôn Tập</span>
                  {dueTodayCount > 0 && (
                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-500 text-white font-bold text-[9px] sm:text-[10px] flex items-center justify-center shrink-0">
                      {dueTodayCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('add')}
                  className={`px-2 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
                    activeTab === 'add'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">
                    Thêm <span className="hidden sm:inline">Từ </span>Mới
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('library')}
                  className={`px-2 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
                    activeTab === 'library'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Library className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">
                    Thư Viện<span className="hidden sm:inline"> Từ</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-700 font-semibold shrink-0">
                    {totalCount}
                  </span>
                </button>
              </nav>
            </div>

            {/* Tab Views */}
            {activeTab === 'review' && (
              <ReviewTab cards={cards} onStartSession={handleStartReview} />
            )}

            {activeTab === 'add' && (
              <AddCardTab
                onCardAdded={() => setActiveTab('review')}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            )}

            {activeTab === 'library' && (
              <LibraryTab cards={cards} onCardDeleted={() => {}} />
            )}
          </div>
        )}
      </main>

      {/* Global Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDataChanged={() => {}}
      />
    </div>
  );
};

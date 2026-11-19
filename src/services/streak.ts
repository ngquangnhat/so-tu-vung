const STREAK_KEY = 'vocab_study_streak';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string; // Format: YYYY-MM-DD
  studiedToday: boolean;
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayDateString(date = new Date()): string {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday);
}

export function getStreakInfo(): StreakData {
  const defaultData: StreakData = {
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: '',
    studiedToday: false,
  };

  if (typeof window === 'undefined') return defaultData;

  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return defaultData;

    const parsed = JSON.parse(raw) as Partial<StreakData>;
    const today = getLocalDateString();
    const yesterday = getYesterdayDateString();

    const lastDate = parsed.lastStudyDate || '';
    const studiedToday = lastDate === today;

    let currentStreak = typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0;
    const longestStreak = typeof parsed.longestStreak === 'number' ? parsed.longestStreak : currentStreak;

    // If last study date was before yesterday and user hasn't studied today, streak has lapsed to 0
    if (lastDate && lastDate !== today && lastDate !== yesterday) {
      currentStreak = 0;
    }

    return {
      currentStreak,
      longestStreak,
      lastStudyDate: lastDate,
      studiedToday,
    };
  } catch (_) {
    return defaultData;
  }
}

export function recordStudyActivity(): StreakData {
  const current = getStreakInfo();
  const today = getLocalDateString();
  const yesterday = getYesterdayDateString();

  if (current.lastStudyDate === today) {
    return { ...current, studiedToday: true };
  }

  let nextStreak = current.currentStreak;
  if (current.lastStudyDate === yesterday) {
    nextStreak += 1;
  } else {
    // Started fresh
    nextStreak = 1;
  }

  const nextLongest = Math.max(current.longestStreak, nextStreak);

  const updated: StreakData = {
    currentStreak: nextStreak,
    longestStreak: nextLongest,
    lastStudyDate: today,
    studiedToday: true,
  };

  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(updated));
  } catch (_) {}

  return updated;
}

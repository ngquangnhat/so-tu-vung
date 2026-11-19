import { Card, ReviewGrade, MAX_BOX_LEVEL } from '../types/card';

// Intervals mapped to box index (0 to 5) in milliseconds
export const BOX_INTERVALS_MS: Record<number, number> = {
  0: 10 * 60 * 1000,           // 10 minutes (khi bị Quên)
  1: 1 * 24 * 60 * 60 * 1000,  // 1 day
  2: 3 * 24 * 60 * 60 * 1000,  // 3 days
  3: 7 * 24 * 60 * 60 * 1000,  // 7 days
  4: 14 * 24 * 60 * 60 * 1000, // 14 days
  5: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export const BOX_INTERVALS_TEXT: Record<number, string> = {
  0: '10 phút',
  1: '1 ngày',
  2: '3 ngày',
  3: '7 ngày',
  4: '14 ngày',
  5: '30 ngày',
};

/**
 * Calculates next box and due date based on rating grade
 */
export function calculateNextReview(
  currentBox: number,
  grade: ReviewGrade,
  baseDate = new Date()
): { nextBox: number; nextDueDate: Date } {
  let nextBox = currentBox;
  let intervalMs = 0;

  switch (grade) {
    case 'forgot':
      nextBox = 0;
      intervalMs = BOX_INTERVALS_MS[0]; // 10 minutes
      break;

    case 'hard':
      nextBox = currentBox;
      // Theo khoảng cách của cấp đó, tối thiểu 1 ngày
      intervalMs = Math.max(BOX_INTERVALS_MS[currentBox], BOX_INTERVALS_MS[1]);
      break;

    case 'good':
      nextBox = Math.min(currentBox + 1, MAX_BOX_LEVEL);
      intervalMs = BOX_INTERVALS_MS[nextBox];
      break;

    case 'easy':
      nextBox = Math.min(currentBox + 2, MAX_BOX_LEVEL);
      intervalMs = BOX_INTERVALS_MS[nextBox];
      break;
  }

  const nextDueDate = new Date(baseDate.getTime() + intervalMs);
  return { nextBox, nextDueDate };
}

/**
 * Returns human-readable upcoming interval preview for a given grade
 */
export function getPreviewIntervalText(grade: ReviewGrade, currentBox: number): string {
  switch (grade) {
    case 'forgot':
      return '10 phút';
    case 'hard':
      return currentBox === 0 ? '1 ngày' : BOX_INTERVALS_TEXT[currentBox];
    case 'good': {
      const target = Math.min(currentBox + 1, MAX_BOX_LEVEL);
      return BOX_INTERVALS_TEXT[target];
    }
    case 'easy': {
      const target = Math.min(currentBox + 2, MAX_BOX_LEVEL);
      return BOX_INTERVALS_TEXT[target];
    }
  }
}

/**
 * Checks if a card is due on or before today's 23:59:59.999
 */
export function isDueToday(dueIsoString: string, referenceDate = new Date()): boolean {
  if (!dueIsoString) return false;
  const cardDueDate = new Date(dueIsoString);
  const endOfToday = new Date(referenceDate);
  endOfToday.setHours(23, 59, 59, 999);
  return cardDueDate.getTime() <= endOfToday.getTime();
}

/**
 * Group cards into categories:
 * - 'Hôm nay' (due <= today)
 * - 'Ngày mai' (due tomorrow)
 * - 'Sắp tới' (later dates)
 */
export function groupCardsBySchedule(cards: Card[], referenceDate = new Date()) {
  const endOfToday = new Date(referenceDate);
  endOfToday.setHours(23, 59, 59, 999);

  const endOfTomorrow = new Date(endOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  const groups = {
    today: [] as Card[],
    tomorrow: [] as Card[],
    upcoming: [] as Card[],
  };

  cards.forEach((card) => {
    const cardDueDate = new Date(card.due);
    if (cardDueDate.getTime() <= endOfToday.getTime()) {
      groups.today.push(card);
    } else if (cardDueDate.getTime() <= endOfTomorrow.getTime()) {
      groups.tomorrow.push(card);
    } else {
      groups.upcoming.push(card);
    }
  });

  return groups;
}

/**
 * Normalizes user answer for cloze and dictation tests:
 * - Null/undefined safe
 * - Replaces hyphens and underscores with whitespace to avoid 'ice-cream' vs 'ice cream' mismatch
 * - Strips other punctuation
 * - Collapses repeated whitespace
 */
export function normalizeAnswer(str?: string | null): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[.,/#!$%^&*;:{}=\`~()?"']/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Helper to strip placeholder wildcards (sb/sth/somebody/something) for pronunciation and speech recognition
 */
export function stripPatternPlaceholders(term: string): string {
  if (!term) return '';
  return term.replace(/\b(sb|sth|somebody|something)\b/gi, '').trim();
}

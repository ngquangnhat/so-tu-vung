export type CardCategory =
  | 'Từ đơn'
  | 'Cụm động từ'
  | 'Cấu trúc'
  | 'Thành ngữ'
  | 'Collocation'
  | 'Cụm từ khác';

export const CARD_CATEGORIES: readonly CardCategory[] = [
  'Từ đơn',
  'Cụm động từ',
  'Cấu trúc',
  'Thành ngữ',
  'Collocation',
  'Cụm từ khác',
] as const;

export const MASTERED_BOX_THRESHOLD = 4;
export const MAX_SPEECH_ATTEMPTS = 2;
export const MAX_BOX_LEVEL = 5;

export interface Card {
  id: string;
  term: string;
  cat: CardCategory;
  pos?: string;
  vi: string;
  ipa?: string;
  en?: string;
  ex?: string;
  cloze?: string;
  ans?: string;
  fam?: string;
  box: number; // 0 to 5
  due: string; // ISO string
  reviewCount: number; // Total times reviewed (formerly 'n')
  createdAt: string;
}

export type ReviewMode = 'mix' | 'flip' | 'cloze' | 'pronounce' | 'write' | 'listen';
export type ReviewGrade = 'forgot' | 'hard' | 'good' | 'easy';

export interface AISettings {
  provider: 'gemini' | 'claude';
  apiKey: string;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Đã xảy ra lỗi không xác định';
}

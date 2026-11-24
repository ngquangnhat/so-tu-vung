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
  synonyms?: string;
  antonyms?: string;
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

/**
 * Deterministic client-side validation to reject pure numbers, non-Latin spam, or malformed strings
 */
export function isValidEnglishTermPattern(rawTerm: string): { isValid: boolean; reason?: string } {
  const trimmed = rawTerm.trim();
  if (!trimmed) {
    return { isValid: false, reason: 'Từ vựng không được để trống.' };
  }
  // Reject pure numbers or terms containing mostly digits
  if (/^\d+$/.test(trimmed) || (trimmed.replace(/\D/g, '').length > trimmed.length / 2)) {
    return { isValid: false, reason: 'Từ vựng không thể là dãy số hoặc chứa quá nhiều chữ số.' };
  }
  // Reject special characters spam (e.g. !@#$%^&*()_+)
  if (/^[!@#$%^&*()_+=\-[\]{};':"\\|,.<>/?`~]+$/.test(trimmed)) {
    return { isValid: false, reason: 'Từ vựng không thể chỉ gồm các ký tự đặc biệt.' };
  }
  // Must contain at least one valid Latin letter
  if (!/[a-zA-Z]/.test(trimmed)) {
    return { isValid: false, reason: 'Từ vựng tiếng Anh phải chứa ít nhất một chữ cái Latin.' };
  }
  // Word length sanity guard
  const words = trimmed.split(/\s+/);
  for (const w of words) {
    if (w.length > 35) {
      return { isValid: false, reason: 'Từ quá dài bất thường, vui lòng kiểm tra lại.' };
    }
  }
  return { isValid: true };
}

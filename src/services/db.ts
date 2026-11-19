import Dexie, { Table } from 'dexie';
import { Card, CardCategory, CARD_CATEGORIES } from '../types/card';

export class VocabDatabase extends Dexie {
  cards!: Table<Card, string>;

  constructor() {
    super('VocabNotebookDB');
    this.version(1).stores({
      cards: 'id, term, cat, box, due, reviewCount, createdAt',
    });
  }
}

export const db = new VocabDatabase();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeCategory(catValue: unknown): CardCategory {
  if (typeof catValue === 'string' && (CARD_CATEGORIES as readonly string[]).includes(catValue)) {
    return catValue as CardCategory;
  }
  return 'Từ đơn';
}

function sanitizeCardRecord(record: unknown): Card | null {
  if (!isRecord(record)) return null;

  const term = typeof record.term === 'string' ? record.term.trim() : '';
  const vi = typeof record.vi === 'string' ? record.vi.trim() : '';
  if (!term || !vi) return null;

  const boxNumber = typeof record.box === 'number' && record.box >= 0 && record.box <= 5 ? record.box : 0;
  const reviewCount =
    typeof record.reviewCount === 'number'
      ? record.reviewCount
      : typeof record.n === 'number'
      ? record.n
      : 0;

  return {
    id: typeof record.id === 'string' && record.id ? record.id : crypto.randomUUID(),
    term,
    cat: sanitizeCategory(record.cat),
    pos: typeof record.pos === 'string' ? record.pos.trim() : '',
    vi,
    ipa: typeof record.ipa === 'string' ? record.ipa.trim() : '',
    en: typeof record.en === 'string' ? record.en.trim() : '',
    ex: typeof record.ex === 'string' ? record.ex.trim() : '',
    cloze: typeof record.cloze === 'string' ? record.cloze.trim() : '',
    ans: typeof record.ans === 'string' ? record.ans.trim() : '',
    fam: typeof record.fam === 'string' ? record.fam.trim() : '',
    box: boxNumber,
    due: typeof record.due === 'string' ? record.due : new Date().toISOString(),
    reviewCount,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
  };
}

// Seed initial cards if database is empty
export async function seedInitialCardsIfEmpty(): Promise<void> {
  const count = await db.cards.count();
  if (count > 0) return;

  // Check legacy localStorage 'vocab2' or 'vocab1'
  try {
    const legacy2 = localStorage.getItem('vocab2');
    if (legacy2) {
      const parsed: unknown = JSON.parse(legacy2);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validatedCards: Card[] = parsed
          .map(sanitizeCardRecord)
          .filter((card): card is Card => card !== null);
        if (validatedCards.length > 0) {
          await db.cards.bulkPut(validatedCards);
          return;
        }
      }
    }

    const legacy1 = localStorage.getItem('vocab1');
    if (legacy1) {
      const parsed1: unknown = JSON.parse(legacy1);
      if (Array.isArray(parsed1) && parsed1.length > 0) {
        const validatedCards: Card[] = parsed1
          .map(sanitizeCardRecord)
          .filter((card): card is Card => card !== null);
        if (validatedCards.length > 0) {
          await db.cards.bulkPut(validatedCards);
          return;
        }
      }
    }
  } catch (error: unknown) {
    console.warn('Failed to migrate legacy localStorage data', error);
  }

  // Provide initial high-quality sample cards matching specification
  const sampleCards: Card[] = [
    {
      id: 'sample-1',
      term: 'act',
      cat: 'Từ đơn',
      pos: 'v',
      vi: 'hành động, cư xử',
      ipa: '/ækt/',
      en: 'to do something for a particular purpose or in a particular situation',
      ex: 'We must act before it is too late.',
      cloze: 'We must ____ before it is too late.',
      ans: 'act',
      fam: 'activity (n), active (adj), actively (adv)',
      box: 0,
      due: new Date().toISOString(),
      reviewCount: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-2',
      term: 'give up',
      cat: 'Cụm động từ',
      pos: 'phrasal verb',
      vi: 'từ bỏ, buông xuôi',
      ipa: '/ɡɪv ʌp/',
      en: 'to stop doing something before you have finished it',
      ex: 'Never give up on your dreams.',
      cloze: 'Never ____ on your dreams.',
      ans: 'give up',
      fam: '',
      box: 0,
      due: new Date().toISOString(),
      reviewCount: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-3',
      term: 'make sb do sth',
      cat: 'Cấu trúc',
      pos: 'pattern',
      vi: 'bắt/khiến ai đó làm việc gì',
      ipa: '/meɪk/',
      en: 'to force or cause someone to perform an action',
      ex: 'The movie made me cry.',
      cloze: 'The movie made me ____.',
      ans: 'cry',
      fam: '',
      box: 0,
      due: new Date().toISOString(),
      reviewCount: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-4',
      term: 'break the ice',
      cat: 'Thành ngữ',
      pos: 'idiom',
      vi: 'phá vỡ sự ngại ngùng ban đầu',
      ipa: '/breɪk ðiː aɪs/',
      en: 'to say or do something that makes people feel more relaxed',
      ex: 'He told a joke to break the ice.',
      cloze: 'He told a joke to ____.',
      ans: 'break the ice',
      fam: '',
      box: 1,
      due: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      reviewCount: 1,
      createdAt: new Date().toISOString(),
    },
  ];

  await db.cards.bulkPut(sampleCards);
}

// Backup & Restore
export async function exportCardsToJson(): Promise<string> {
  const allCards = await db.cards.toArray();
  return JSON.stringify(allCards, null, 2);
}

export async function importCardsFromJson(jsonString: string): Promise<number> {
  const parsed: unknown = JSON.parse(jsonString);
  if (!Array.isArray(parsed)) {
    throw new Error('Dữ liệu tải lên không phải là một danh sách thẻ hợp lệ (JSON Array).');
  }

  const validCards: Card[] = parsed
    .map(sanitizeCardRecord)
    .filter((card): card is Card => card !== null);

  if (validCards.length === 0) {
    throw new Error('Không tìm thấy thẻ từ vựng hợp lệ nào trong file tải lên.');
  }

  await db.cards.bulkPut(validCards);
  return validCards.length;
}

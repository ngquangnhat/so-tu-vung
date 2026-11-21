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

// Purge initial sample cards from IndexedDB if they exist
export async function removeSampleCards(): Promise<void> {
  const sampleIds = ['sample-1', 'sample-2', 'sample-3', 'sample-4'];
  try {
    await db.cards.bulkDelete(sampleIds);
    const all = await db.cards.toArray();
    const otherSampleIds = all.filter((c) => c.id.startsWith('sample-')).map((c) => c.id);
    if (otherSampleIds.length > 0) {
      await db.cards.bulkDelete(otherSampleIds);
    }
  } catch (error) {
    console.warn('Could not purge sample cards', error);
  }
}

// Seed initial cards if database is empty (migrates legacy localStorage if present, no dummy cards)
export async function seedInitialCardsIfEmpty(): Promise<void> {
  // Purge sample cards immediately
  await removeSampleCards();

  try {
    const count = await db.cards.count();
    if (count > 0) return;

    // Check legacy localStorage 'vocab2' or 'vocab1'
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
    console.warn('Failed to access database or migrate legacy localStorage data', error);
  }
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

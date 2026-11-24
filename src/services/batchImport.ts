import { AnalysisResult, analyzeAndAutoFill } from './ai';
import { getErrorMessage } from '../types/card';

export interface BatchItem {
  id: string;
  rawTerm: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  result?: AnalysisResult;
  error?: string;
  selected: boolean;
}

/**
 * Parses raw input text into a deduplicated list of clean terms.
 * Handles newlines, commas, semicolons, bullet points, numbers, and quotation marks.
 */
export function parseBatchTerms(rawInput: string): string[] {
  if (!rawInput || !rawInput.trim()) return [];

  // Split by newlines, commas, or semicolons
  const lines = rawInput.split(/[\r\n,;]+/);
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const line of lines) {
    // Strip leading numbers (e.g., "1. ", "1) ", "1/ ") and bullet points ("- ", "* ", "• ")
    let cleaned = line.replace(/^\s*(?:\d+[\.\)\/]|[-*•+])\s*/, '').trim();

    // Strip wrapping quotes and brackets
    cleaned = cleaned.replace(/^["'“”‘’\(\[]+|["'“”‘’\)\]]+$/g, '').trim();

    if (!cleaned) continue;

    const lower = cleaned.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      terms.push(cleaned);
    }
  }

  return terms;
}

export const DEFAULT_BATCH_CONCURRENCY = 2;

/**
 * Processes a list of batch items using a concurrency-controlled queue.
 * Supports live progress updates and cancellation via isCancelledRef.
 */
export async function processBatchQueue(
  items: BatchItem[],
  onItemUpdate: (updatedItem: BatchItem, progress: { completed: number; total: number }) => void,
  isCancelledRef: { current: boolean },
  concurrency = DEFAULT_BATCH_CONCURRENCY
): Promise<BatchItem[]> {
  const total = items.length;
  let completed = 0;
  let nextIndex = 0;

  const currentItems = [...items];

  async function worker(): Promise<void> {
    while (nextIndex < total) {
      if (isCancelledRef.current) break;

      const currentIndex = nextIndex++;
      const item = currentItems[currentIndex];

      // Mark analyzing
      item.status = 'analyzing';
      onItemUpdate(item, { completed, total });

      try {
        const result = await analyzeAndAutoFill(item.rawTerm);

        if (isCancelledRef.current) {
          // Gracefully finalize in-flight item on cancellation so no zombie analyzing state remains [CLUSTER-02]
          item.status = 'done';
          item.result = result;
          item.selected = Boolean(result.isValid && result.vi && result.vi.trim());
          onItemUpdate(item, { completed, total });
          break;
        }

        item.status = 'done';
        item.result = result;
        // Auto-select valid items that have a non-empty meaning [CLUSTER-01]
        const isValidMeaning = Boolean(result.vi && result.vi.trim());
        item.selected = Boolean(result.isValid && isValidMeaning);
        if (!result.isValid) {
          item.error = result.warningMessage || 'Từ vựng không hợp lệ trong từ điển.';
        } else if (!isValidMeaning) {
          item.error = 'Chưa có nghĩa tiếng Việt. Vui lòng nhập nghĩa trước khi lưu.';
        }
      } catch (queueError: unknown) {
        if (isCancelledRef.current) {
          item.status = 'error';
          item.error = 'Đã dừng phân tích';
          item.selected = false;
          onItemUpdate(item, { completed, total });
          break;
        }

        item.status = 'error';
        item.error = getErrorMessage(queueError);
        item.selected = false;
      }

      completed++;
      onItemUpdate(item, { completed, total });
    }
  }

  const workerCount = Math.min(concurrency, total);
  const workers: Promise<void>[] = [];
  for (let workerIndex = 0; workerIndex < workerCount; workerIndex++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return currentItems;
}

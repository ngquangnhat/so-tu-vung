import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  Check,
  AlertCircle,
  HelpCircle,
  Volume2,
  Trash2,
  StopCircle,
  CheckSquare,
  Square,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardCategory, CARD_CATEGORIES, PRESET_TOPICS, getErrorMessage, isValidEnglishTermPattern } from '../types/card';
import { db } from '../services/db';
import { speakText } from '../services/speech';
import { BatchItem, parseBatchTerms, processBatchQueue, DEFAULT_BATCH_CONCURRENCY } from '../services/batchImport';

interface BatchImportSectionProps {
  onCardsSaved: (count: number) => void;
  onOpenSettings: () => void;
}

function isItemSaveable(item: BatchItem): boolean {
  return (
    item.status === 'done' &&
    Boolean(item.result?.isValid) &&
    Boolean(item.result?.vi && item.result.vi.trim().length > 0) &&
    Boolean(isValidEnglishTermPattern(item.result?.term || item.rawTerm).isValid)
  );
}

const SAMPLE_TERMS = `collaborate
resilient
take into account
artificial intelligence
break the ice`;

export const BatchImportSection: React.FC<BatchImportSectionProps> = ({ onCardsSaved, onOpenSettings }) => {
  const [rawText, setRawText] = useState('');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(
    null
  );

  const isCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
    };
  }, []);

  const parsedTerms = parseBatchTerms(rawText);

  const handleStartAnalysis = async () => {
    if (parsedTerms.length === 0) {
      setNotification({
        type: 'error',
        message: 'Vui lòng nhập hoặc dán ít nhất 1 từ vựng hợp lệ vào khung bên dưới.',
      });
      return;
    }

    setNotification(null);
    setIsProcessing(true);
    isCancelledRef.current = false;
    setProgress({ completed: 0, total: parsedTerms.length });

    const initialItems: BatchItem[] = parsedTerms.map((termText) => ({
      id: crypto.randomUUID(),
      rawTerm: termText,
      status: 'pending',
      selected: true,
    }));
    setItems(initialItems);

    try {
      await processBatchQueue(
        initialItems,
        (updatedItem, prog) => {
          setItems((prevItems) => prevItems.map((item) => (item.id === updatedItem.id ? { ...updatedItem } : item)));
          setProgress(prog);
        },
        isCancelledRef,
        DEFAULT_BATCH_CONCURRENCY
      );

      if (isCancelledRef.current) {
        setNotification({ type: 'warning', message: 'Đã tạm dừng quá trình phân tích hàng loạt.' });
      } else {
        setNotification({
          type: 'success',
          message: `Đã hoàn tất phân tích ${parsedTerms.length} từ. Vui lòng kiểm tra và bấm "Lưu vào sổ".`,
        });
      }
    } catch (analysisError: unknown) {
      setNotification({ type: 'error', message: 'Lỗi phân tích hàng loạt: ' + getErrorMessage(analysisError) });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopAnalysis = () => {
    isCancelledRef.current = true;
  };

  const handleToggleSelectAll = () => {
    const saveableItems = items.filter(isItemSaveable);
    const allSaveableSelected = saveableItems.length > 0 && saveableItems.every((saveableItem) => saveableItem.selected);
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (isItemSaveable(item)) {
          return { ...item, selected: !allSaveableSelected };
        }
        return { ...item, selected: false };
      })
    );
  };

  const handleToggleItem = (targetId: string) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === targetId && isItemSaveable(item)) {
          return { ...item, selected: !item.selected };
        }
        return item;
      })
    );
  };

  const handleUpdateItemMeaning = (targetId: string, newVi: string) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === targetId && item.result) {
          const updatedResult = { ...item.result, vi: newVi };
          const saveable = Boolean(updatedResult.isValid && newVi.trim().length > 0);
          return { ...item, result: updatedResult, selected: saveable };
        }
        return item;
      })
    );
  };

  const handleUpdateItemTopic = (targetId: string, newTopic: string) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === targetId && item.result) {
          return { ...item, result: { ...item.result, topic: newTopic } };
        }
        return item;
      })
    );
  };

  const selectedItems = items.filter((item) => item.selected && isItemSaveable(item));

  const handleSaveSelected = async () => {
    if (isProcessing) return;

    if (selectedItems.length === 0) {
      setNotification({ type: 'error', message: 'Chưa có từ hợp lệ nào được chọn để lưu.' });
      return;
    }

    // Strict validation against database invariants
    for (const item of selectedItems) {
      const res = item.result;
      if (!res || !res.vi || !res.vi.trim()) {
        setNotification({
          type: 'error',
          message: `Từ "${item.rawTerm}" thiếu nghĩa tiếng Việt. Bắt buộc phải có nghĩa tiếng Việt mới được lưu.`,
        });
        return;
      }
      if (!res.isValid || !isValidEnglishTermPattern(res.term || item.rawTerm).isValid) {
        setNotification({
          type: 'error',
          message: `Từ "${item.rawTerm}" không hợp lệ. Vui lòng bỏ chọn hoặc sửa lại.`,
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const cardsToSave: Card[] = selectedItems.map((item) => {
        const res = item.result!;
        return {
          id: crypto.randomUUID(),
          term: res.term || item.rawTerm,
          cat: res.cat || 'Từ đơn',
          pos: res.pos || '',
          vi: res.vi.trim(),
          ipa: res.ipa || '',
          en: res.en || '',
          ex: res.ex || '',
          cloze: res.cloze || '',
          ans: res.ans || res.term,
          synonyms: res.synonyms || '',
          antonyms: res.antonyms || '',
          fam: res.fam || '',
          topic: res.topic || 'Chung',
          box: 0,
          due: now,
          reviewCount: 0,
          createdAt: now,
        };
      });

      await db.cards.bulkAdd(cardsToSave);

      setNotification({
        type: 'success',
        message: `Đã lưu thành công ${cardsToSave.length} từ vựng mới vào sổ ở Cấp 0 (Đến hạn ngay)!`,
      });

      // Clear input and items
      setRawText('');
      setItems([]);
      onCardsSaved(cardsToSave.length);
    } catch (saveError: unknown) {
      setNotification({ type: 'error', message: 'Lỗi lưu hàng loạt: ' + getErrorMessage(saveError) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Input Box */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              Nhập Hàng Loạt Từ Vựng (Batch Import)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Dán danh sách từ (mỗi từ một dòng hoặc cách nhau bằng dấu phẩy). AI sẽ tự động phân tích và bóc tách nghĩa hàng loạt.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
          >
            <HelpCircle className="w-3.5 h-3.5" /> Cài đặt AI
          </button>
        </div>

        {/* Textarea */}
        <div className="space-y-2">
          <textarea
            rows={5}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={isProcessing}
            placeholder={`Dán danh sách từ vào đây, ví dụ:\ncollaborate\nresilient\ntake into account\nartificial intelligence\nbreak the ice`}
            className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white font-mono text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Phát hiện: <strong className="text-indigo-600 dark:text-indigo-400">{parsedTerms.length}</strong> từ hợp lệ
              </span>
              {rawText && (
                <button
                  type="button"
                  onClick={() => setRawText('')}
                  disabled={isProcessing}
                  className="text-rose-500 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Xóa trắng
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setRawText(SAMPLE_TERMS)}
              disabled={isProcessing}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              + Dán mẫu 5 từ thông dụng
            </button>
          </div>
        </div>

        {/* Action Button & Progress */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          {isProcessing ? (
            <div className="flex-1 w-full space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Đang phân tích hàng loạt: {progress.completed} / {progress.total} từ...
                </span>
                <span className="text-slate-500">
                  {progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 hidden sm:block">
              Hệ thống xử lý song song 2 từ/lượt để tối ưu tốc độ và không chạm giới hạn quota API.
            </p>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            {isProcessing ? (
              <button
                type="button"
                onClick={handleStopAnalysis}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <StopCircle className="w-4 h-4" /> Dừng phân tích
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={parsedTerms.length === 0}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-medium text-xs shadow-md shadow-indigo-500/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Phân tích {parsedTerms.length > 0 ? `(${parsedTerms.length})` : ''} từ với AI
              </button>
            )}
          </div>
        </div>

        {notification && (
          <div
            className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium animate-fadeIn ${
              notification.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : notification.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {notification.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}
      </div>

      {/* Results Table / Preview List */}
      {items.length > 0 && (
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1.5 hover:underline"
              >
                {items.filter(isItemSaveable).length > 0 && items.filter(isItemSaveable).every((item) => item.selected) ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                Chọn tất cả từ hợp lệ ({items.filter(isItemSaveable).length})
              </button>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Đã chọn: <strong className="text-indigo-600 dark:text-indigo-400">{selectedItems.length}</strong> từ
              </span>
            </div>

            <button
              type="button"
              onClick={handleSaveSelected}
              disabled={isSaving || isProcessing || selectedItems.length === 0}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {isSaving ? 'Đang lưu...' : `Lưu ${selectedItems.length} thẻ vào sổ (Cấp 0)`}
            </button>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {items.map((item, index) => {
              const res = item.result;
              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    item.status === 'analyzing'
                      ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/20 dark:bg-indigo-950/20 animate-pulse'
                      : item.status === 'error'
                      ? 'border-rose-300 dark:border-rose-900 bg-rose-50/20 dark:bg-rose-950/20'
                      : item.selected
                      ? 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                      : 'border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleItem(item.id)}
                      disabled={!isItemSaveable(item)}
                      title={!isItemSaveable(item) ? 'Từ này chưa hợp lệ hoặc thiếu nghĩa' : 'Chọn để lưu'}
                      className="mt-0.5 text-indigo-600 dark:text-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {item.selected ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                        <strong className="text-sm font-bold text-slate-900 dark:text-white">
                          {res?.term || item.rawTerm}
                        </strong>
                        {res?.pos && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-mono">
                            {res.pos}
                          </span>
                        )}
                        {res?.ipa && (
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            {res.ipa}
                          </span>
                        )}
                        {item.rawTerm && (
                          <button
                            type="button"
                            onClick={() => speakText(res?.term || item.rawTerm)}
                            aria-label="Nghe phát âm chuẩn (US)"
                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Meaning & Details */}
                      {item.status === 'done' && res && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                          <div>
                            <input
                              type="text"
                              value={res.vi}
                              onChange={(e) => handleUpdateItemMeaning(item.id, e.target.value)}
                              placeholder="Nghĩa tiếng Việt..."
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={res.topic || 'Chung'}
                              onChange={(e) => handleUpdateItemTopic(item.id, e.target.value)}
                              className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] text-slate-900 dark:text-white font-medium"
                            >
                              {PRESET_TOPICS.map((top) => (
                                <option key={top} value={top}>
                                  {top}
                                </option>
                              ))}
                            </select>
                            {res.cat && (
                              <span className="text-[11px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                                {res.cat}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Linguistic validation warning if any */}
                      {res && !res.isValid && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {res.warningMessage || 'Từ vựng không hợp lệ trong từ điển.'}
                        </p>
                      )}

                      {item.status === 'error' && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400">Lỗi: {item.error}</p>
                      )}
                    </div>
                  </div>

                  {/* Status indicator badge */}
                  <div className="shrink-0 self-end sm:self-center">
                    {item.status === 'analyzing' && (
                      <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" /> Đang tra cứu...
                      </span>
                    )}
                    {item.status === 'pending' && (
                      <span className="text-[11px] text-slate-400 font-medium">Chờ phân tích</span>
                    )}
                    {item.status === 'done' && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Đã sẵn sàng
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

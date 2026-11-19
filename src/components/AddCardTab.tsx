import React, { useState } from 'react';
import { Sparkles, PlusCircle, Check, AlertCircle, HelpCircle, Volume2 } from 'lucide-react';
import { CardCategory, CARD_CATEGORIES, Card, getErrorMessage } from '../types/card';
import { analyzeAndAutoFill } from '../services/ai';
import { db } from '../services/db';
import { speakText } from '../services/speech';

interface AddCardTabProps {
  onCardAdded: () => void;
  onOpenSettings: () => void;
}

export const AddCardTab: React.FC<AddCardTabProps> = ({ onCardAdded, onOpenSettings }) => {
  const [term, setTerm] = useState('');
  const [cat, setCat] = useState<CardCategory>('Từ đơn');
  const [pos, setPos] = useState('');
  const [vi, setVi] = useState('');
  const [ipa, setIpa] = useState('');
  const [en, setEn] = useState('');
  const [ex, setEx] = useState('');
  const [cloze, setCloze] = useState('');
  const [ans, setAns] = useState('');
  const [fam, setFam] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleAutoFill = async () => {
    if (!term.trim()) {
      setNotification({ type: 'error', message: 'Vui lòng nhập từ hoặc cụm từ trước khi phân tích.' });
      return;
    }

    setIsAnalyzing(true);
    setNotification(null);

    try {
      const res = await analyzeAndAutoFill(term.trim());
      setTerm(res.term);
      setCat(res.cat);
      setPos(res.pos);
      setVi(res.vi);
      setIpa(res.ipa);
      setEn(res.en);
      setEx(res.ex);
      setCloze(res.cloze);
      setAns(res.ans);
      setFam(res.fam);

      if (!res.vi) {
        setNotification({
          type: 'error',
          message: 'AI chưa cấu hình API Key. Bạn có thể tự điền các ô bên dưới hoặc vào Cài đặt để thêm API Key.',
        });
      } else {
        setNotification({ type: 'success', message: 'AI đã tự điền thông tin đầy đủ. Hãy kiểm tra lại trước khi lưu!' });
      }
    } catch (error: unknown) {
      setNotification({
        type: 'error',
        message: 'Lỗi gọi AI: ' + getErrorMessage(error),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTerm = term.trim();
    const trimmedVi = vi.trim();

    if (!trimmedTerm || !trimmedVi) {
      setNotification({
        type: 'error',
        message: 'Bắt buộc phải có "Từ vựng" và "Nghĩa tiếng Việt" mới được lưu vào sổ.',
      });
      return;
    }

    // Tự sinh cloze test nếu có ex chứa term
    let finalCloze = cloze.trim();
    let finalAns = ans.trim();

    if (!finalCloze && ex.trim()) {
      const patternRegex = new RegExp(trimmedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (patternRegex.test(ex.trim())) {
        finalCloze = ex.trim().replace(patternRegex, '____');
        finalAns = trimmedTerm;
      }
    }

    const newCard: Card = {
      id: crypto.randomUUID(),
      term: trimmedTerm,
      cat,
      pos: pos.trim(),
      vi: trimmedVi,
      ipa: ipa.trim(),
      en: en.trim(),
      ex: ex.trim(),
      cloze: finalCloze,
      ans: finalAns,
      fam: fam.trim(),
      box: 0, // Cấp 0 ban đầu
      due: new Date().toISOString(), // Đến hạn ngay
      reviewCount: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      await db.cards.add(newCard);
      setNotification({ type: 'success', message: `Đã lưu thẻ "${trimmedTerm}" vào sổ ở Cấp 0 (Đến hạn hôm nay)!` });

      // Reset form
      setTerm('');
      setCat('Từ đơn');
      setPos('');
      setVi('');
      setIpa('');
      setEn('');
      setEx('');
      setCloze('');
      setAns('');
      setFam('');

      onCardAdded();
    } catch (error: unknown) {
      setNotification({ type: 'error', message: 'Không thể lưu thẻ: ' + getErrorMessage(error) });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Card: Quick Input & AI Analysis */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-500" />
              Thêm Thẻ Từ Vựng Mới
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Nhập từ, cụm từ, thành ngữ hoặc cấu trúc, sau đó bấm AI tự điền để tiết kiệm thời gian.
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

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Nhập từ, cụm từ hoặc cấu trúc (vd: act, give up, make sb do sth)..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAutoFill();
                }
              }}
              className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white font-medium text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {term.trim() && (
              <button
                type="button"
                onClick={() => speakText(term)}
                title="Nghe phát âm thử"
                className="absolute right-3 top-3 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={isAnalyzing || !term.trim()}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-medium text-sm shadow-md shadow-indigo-500/20 disabled:opacity-50 transition flex items-center justify-center gap-2 shrink-0"
          >
            <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Đang phân tích...' : 'Phân tích & Tự điền'}
          </button>
        </div>

        {notification && (
          <div
            className={`mt-4 p-3 rounded-xl flex items-center gap-2 text-xs font-medium animate-fadeIn ${
              notification.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
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

      {/* Main Details Form */}
      <form
        onSubmit={handleSave}
        className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 transition-colors"
      >
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
          Thông tin chi tiết thẻ
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Phân loại */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Phân loại <span className="text-rose-500">*</span>
            </label>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value as CardCategory)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CARD_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Từ loại */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Từ loại (Part of speech)
            </label>
            <input
              type="text"
              placeholder="v, n, adj, adv, phrasal verb, pattern..."
              value={pos}
              onChange={(e) => setPos(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nghĩa tiếng Việt */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nghĩa tiếng Việt <span className="text-rose-500">* (Bắt buộc)</span>
            </label>
            <input
              type="text"
              placeholder="Nghĩa ngắn gọn, súc tích..."
              value={vi}
              onChange={(e) => setVi(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Phiên âm IPA */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Phát âm (IPA)
            </label>
            <input
              type="text"
              placeholder="vd: /ˈæk.tɪv/"
              value={ipa}
              onChange={(e) => setIpa(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
            />
          </div>
        </div>

        {/* Nghĩa tiếng Anh */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Định nghĩa tiếng Anh (Cambridge style)
          </label>
          <input
            type="text"
            placeholder="Simple English definition..."
            value={en}
            onChange={(e) => setEn(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Câu ví dụ */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Câu ví dụ (Dưới 10 từ)
          </label>
          <input
            type="text"
            placeholder="Ví dụ: We must act before it is too late."
            value={ex}
            onChange={(e) => setEx(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Điền chỗ trống */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Câu điền chỗ trống (Tự tạo từ câu ví dụ nếu để trống)
            </label>
            <input
              type="text"
              placeholder="Ví dụ: We must ____ before it is too late."
              value={cloze}
              onChange={(e) => setCloze(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Đáp án chỗ trống
            </label>
            <input
              type="text"
              placeholder="Từ điền vào ____"
              value={ans}
              onChange={(e) => setAns(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Họ từ */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Họ từ (Word Family)
          </label>
          <input
            type="text"
            placeholder="Ví dụ: activity (n), active (adj), actively (adv)"
            value={fam}
            onChange={(e) => setFam(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Save button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Lưu vào sổ (Cấp 0 - Đến hạn ngay)
          </button>
        </div>
      </form>
    </div>
  );
};

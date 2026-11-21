import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Volume2, Trash2, Calendar, Sparkles, Filter, Edit3, X, Check } from 'lucide-react';
import { Card, CardCategory, CARD_CATEGORIES, getErrorMessage } from '../types/card';
import { db } from '../services/db';
import { speakText } from '../services/speech';

interface LibraryTabProps {
  cards: Card[];
  onCardDeleted: () => void;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({ cards, onCardDeleted }) => {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
        deleteTimerRef.current = null;
      }
    };
  }, []);

  // Edit Card Modal state
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editTerm, setEditTerm] = useState('');
  const [editCat, setEditCat] = useState<CardCategory>('Từ đơn');
  const [editPos, setEditPos] = useState('');
  const [editVi, setEditVi] = useState('');
  const [editIpa, setEditIpa] = useState('');
  const [editEn, setEditEn] = useState('');
  const [editEx, setEditEx] = useState('');
  const [editCloze, setEditCloze] = useState('');
  const [editAns, setEditAns] = useState('');
  const [editFam, setEditFam] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Filter & sort (newest first)
  const filteredCards = useMemo(() => {
    return [...cards]
      .filter((card) => {
        const matchCat = selectedCat === 'all' || card.cat === selectedCat;
        const query = search.trim().toLowerCase();
        if (!query) return matchCat;

        const matchSearch =
          card.term.toLowerCase().includes(query) ||
          card.vi.toLowerCase().includes(query) ||
          (card.fam && card.fam.toLowerCase().includes(query)) ||
          (card.en && card.en.toLowerCase().includes(query));

        return matchCat && matchSearch;
      })
      .sort((cardA, cardB) => new Date(cardB.createdAt || 0).getTime() - new Date(cardA.createdAt || 0).getTime());
  }, [cards, selectedCat, search]);

  // Count by category
  const countsByCat = useMemo(() => {
    const counts: Record<string, number> = { all: cards.length };
    CARD_CATEGORIES.forEach((category) => {
      counts[category] = cards.filter((card) => card.cat === category).length;
    });
    return counts;
  }, [cards]);

  const handleDelete = async (id: string) => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }

    if (confirmDeleteId === id) {
      await db.cards.delete(id);
      setConfirmDeleteId(null);
      onCardDeleted();
    } else {
      setConfirmDeleteId(id);
      deleteTimerRef.current = setTimeout(() => {
        setConfirmDeleteId(null);
        deleteTimerRef.current = null;
      }, 4000);
    }
  };

  const handleOpenEdit = (card: Card) => {
    setEditingCard(card);
    setEditTerm(card.term);
    setEditCat(card.cat);
    setEditPos(card.pos || '');
    setEditVi(card.vi);
    setEditIpa(card.ipa || '');
    setEditEn(card.en || '');
    setEditEx(card.ex || '');
    setEditCloze(card.cloze || '');
    setEditAns(card.ans || '');
    setEditFam(card.fam || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;

    if (!editTerm.trim() || !editVi.trim()) {
      setEditError('Bắt buộc phải có Từ vựng và Nghĩa tiếng Việt.');
      return;
    }

    try {
      await db.cards.update(editingCard.id, {
        term: editTerm.trim(),
        cat: editCat,
        pos: editPos.trim(),
        vi: editVi.trim(),
        ipa: editIpa.trim(),
        en: editEn.trim(),
        ex: editEx.trim(),
        cloze: editCloze.trim(),
        ans: editAns.trim(),
        fam: editFam.trim(),
      });
      setEditingCard(null);
    } catch (error: unknown) {
      setEditError('Lỗi cập nhật thẻ: ' + getErrorMessage(error));
    }
  };

  const getBoxBadgeClass = (box: number) => {
    switch (box) {
      case 0:
        return 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900';
      case 1:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900';
      case 2:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900';
      case 3:
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900';
      case 4:
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900';
      case 5:
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Tìm theo từ tiếng Anh, nghĩa tiếng Việt, hoặc họ từ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition flex items-center gap-1.5 ${
              selectedCat === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tất cả <span className="opacity-75 font-bold">({countsByCat.all})</span>
          </button>
          {CARD_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCat(category)}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition flex items-center gap-1.5 ${
                selectedCat === category
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {category} <span className="opacity-75 font-bold">({countsByCat[category] || 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cards List */}
      {filteredCards.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <Sparkles className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">Không tìm thấy thẻ từ nào</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Hãy thử tìm bằng từ khoá khác hoặc thêm từ mới vào sổ.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCards.map((card) => (
            <div
              key={card.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800/80 transition-all space-y-3"
            >
              {/* Header row of card */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      {card.term}
                    </span>
                    {card.pos && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {card.pos}
                      </span>
                    )}
                    {card.ipa && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {card.ipa}
                      </span>
                    )}
                    <button
                      onClick={() => speakText(card.term)}
                      title="Nghe phát âm"
                      className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                    {card.vi}
                  </p>
                </div>

                {/* Box Badge, Edit and Delete buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getBoxBadgeClass(
                      card.box
                    )}`}
                  >
                    Cấp {card.box}
                  </span>

                  <button
                    onClick={() => handleOpenEdit(card)}
                    title="Chỉnh sửa thẻ"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(card.id)}
                    title={confirmDeleteId === card.id ? 'Xác nhận xoá thẻ này?' : 'Xoá thẻ'}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                      confirmDeleteId === card.id
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmDeleteId === card.id ? 'Chắc chứ?' : ''}
                  </button>
                </div>
              </div>

              {/* Extra details */}
              {(card.en || card.ex || card.fam) && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {card.en && (
                    <p>
                      <strong className="text-slate-700 dark:text-slate-200">Định nghĩa:</strong> {card.en}
                    </p>
                  )}
                  {card.ex && (
                    <p className="italic text-slate-500 dark:text-slate-400">
                      <strong className="not-italic text-slate-700 dark:text-slate-200">Ví dụ:</strong> "{card.ex}"
                    </p>
                  )}
                  {card.fam && (
                    <p>
                      <strong className="text-slate-700 dark:text-slate-200">Họ từ:</strong> {card.fam}
                    </p>
                  )}
                </div>
              )}

              {/* Footer: Due date info & Category */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/60 font-medium">
                  {card.cat}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Ôn tiếp: {new Date(card.due).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Card Modal */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-500" />
                Chỉnh Sửa Thẻ Từ Vựng
              </h3>
              <button
                onClick={() => setEditingCard(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {editError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-medium">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Từ / Cụm từ *
                  </label>
                  <input
                    type="text"
                    value={editTerm}
                    onChange={(e) => setEditTerm(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Từ loại (v, n, adj, adv...)
                  </label>
                  <input
                    type="text"
                    placeholder="v, n, adj, adv, pattern..."
                    value={editPos}
                    onChange={(e) => setEditPos(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phân loại
                  </label>
                  <select
                    value={editCat}
                    onChange={(e) => setEditCat(e.target.value as CardCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    {CARD_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phát âm (IPA)
                  </label>
                  <input
                    type="text"
                    value={editIpa}
                    onChange={(e) => setEditIpa(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nghĩa tiếng Việt *
                </label>
                <input
                  type="text"
                  value={editVi}
                  onChange={(e) => setEditVi(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Định nghĩa tiếng Anh
                </label>
                <input
                  type="text"
                  value={editEn}
                  onChange={(e) => setEditEn(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Câu ví dụ
                </label>
                <input
                  type="text"
                  value={editEx}
                  onChange={(e) => setEditEx(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Câu điền chỗ trống
                  </label>
                  <input
                    type="text"
                    value={editCloze}
                    onChange={(e) => setEditCloze(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Đáp án
                  </label>
                  <input
                    type="text"
                    value={editAns}
                    onChange={(e) => setEditAns(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Họ từ (Word family)
                </label>
                <input
                  type="text"
                  value={editFam}
                  onChange={(e) => setEditFam(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                >
                  <Check className="w-3.5 h-3.5" /> Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

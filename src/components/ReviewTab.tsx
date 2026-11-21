import React, { useState } from 'react';
import { Play, Sparkles, CheckCircle, Clock, Shuffle, Layers, PenTool, Mic, Headphones } from 'lucide-react';
import { Card, ReviewMode, MASTERED_BOX_THRESHOLD } from '../types/card';
import { groupCardsBySchedule, isDueToday } from '../services/srs';

interface ReviewTabProps {
  cards: Card[];
  onStartSession: (mode: ReviewMode, reviewCards: Card[], isFreePractice?: boolean) => void;
}

export const ReviewTab: React.FC<ReviewTabProps> = ({ cards, onStartSession }) => {
  const [selectedMode, setSelectedMode] = useState<ReviewMode>('mix');

  // Stats
  const dueCardsToday = cards.filter((card) => isDueToday(card.due));
  const totalCards = cards.length;
  const masteredCards = cards.filter((card) => card.box >= MASTERED_BOX_THRESHOLD);

  // Grouped cards for schedule view
  const scheduleGroups = groupCardsBySchedule(cards);

  const modeOptions: { id: ReviewMode; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'mix',
      label: 'Trộn các dạng',
      icon: <Shuffle className="w-4 h-4" />,
      desc: 'Ngẫu nhiên kết hợp 5 dạng bài tập phù hợp với từng từ',
    },
    {
      id: 'flip',
      label: 'Lật thẻ',
      icon: <Layers className="w-4 h-4" />,
      desc: 'Flashcard truyền thống: Xem từ, lật nghĩa và tự chấm',
    },
    {
      id: 'cloze',
      label: 'Điền chỗ trống',
      icon: <PenTool className="w-4 h-4" />,
      desc: 'Đọc câu ví dụ và điền dạng từ chính xác vào chỗ trống',
    },
    {
      id: 'pronounce',
      label: 'Luyện phát âm',
      icon: <Mic className="w-4 h-4" />,
      desc: 'Nói từ vựng vào micro và AI nhận diện độ chính xác',
    },
    {
      id: 'write',
      label: 'Viết câu ứng dụng',
      icon: <Sparkles className="w-4 h-4" />,
      desc: 'Đặt 1 câu hoàn chỉnh có chứa từ vựng và AI chấm điểm',
    },
    {
      id: 'listen',
      label: 'Nghe và gõ lại',
      icon: <Headphones className="w-4 h-4" />,
      desc: 'Nghe phát âm chuẩn tiếng Anh Mỹ và gõ lại từ vựng',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-200/60 dark:border-amber-900/40 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Cần ôn hôm nay</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
            {dueCardsToday.length}
          </p>
          <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1 block">
            {dueCardsToday.length === 0 ? 'Tuyệt vời, không có thẻ tồn!' : 'Đã đến hạn cần củng cố'}
          </span>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-200/60 dark:border-indigo-900/40 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Tổng số thẻ</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">
            {totalCards}
          </p>
          <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-1 block">
            Vốn từ đang tích lũy
          </span>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-200/60 dark:border-emerald-900/40 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Đã thuộc kỹ</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            {masteredCards.length}
          </p>
          <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 block">
            Thẻ ở Cấp {MASTERED_BOX_THRESHOLD} & Cấp 5
          </span>
        </div>
      </div>

      {/* Mode Selector & Start Action */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Lựa Chọn Dạng Bài Ôn Tập</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chọn dạng bài bạn muốn luyện tập hoặc Trộn lẫn để AI kết hợp linh hoạt.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onStartSession(selectedMode, dueCardsToday, false)}
              disabled={dueCardsToday.length === 0}
              title={dueCardsToday.length === 0 ? 'Hôm nay chưa có thẻ nào đến hạn ôn' : 'Bắt đầu phiên ôn thẻ đến hạn'}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/25 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Ôn thẻ đến hạn ({dueCardsToday.length})
            </button>

            {totalCards > 0 && (
              <button
                onClick={() => onStartSession(selectedMode, cards, true)}
                title="Luyện tập tự do tất cả thẻ trong sổ theo dạng bài đã chọn mà không làm xáo trộn tiến độ SRS"
                className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm border border-slate-300/60 dark:border-slate-700 transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Luyện tự do ({totalCards} từ)
              </button>
            )}
          </div>
        </div>

        {/* Mode Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {modeOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedMode(opt.id)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                selectedMode === opt.id
                  ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-900 dark:text-white">
                <span className={`p-1.5 rounded-lg ${selectedMode === opt.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                  {opt.icon}
                </span>
                {opt.label}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                {opt.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Group Breakdown */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
          Lịch trình ôn tập chi tiết
        </h3>

        {/* Group: Hôm nay */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Hôm nay
            </span>
            <span className="text-xs font-semibold text-slate-500">{scheduleGroups.today.length} thẻ</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-60 overflow-y-auto">
            {scheduleGroups.today.length === 0 ? (
              <p className="p-4 text-xs text-slate-400 text-center">Không có thẻ nào cần ôn hôm nay.</p>
            ) : (
              scheduleGroups.today.map((card) => (
                <div key={card.id} className="px-5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-900 dark:text-white font-semibold">{card.term}</strong>
                    {card.pos && <span className="text-slate-400">({card.pos})</span>}
                    <span className="text-slate-600 dark:text-slate-300">— {card.vi}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Cấp {card.box}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Group: Ngày mai */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Ngày mai
            </span>
            <span className="text-xs font-semibold text-slate-500">{scheduleGroups.tomorrow.length} thẻ</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-48 overflow-y-auto">
            {scheduleGroups.tomorrow.length === 0 ? (
              <p className="p-4 text-xs text-slate-400 text-center">Không có thẻ nào hẹn ôn ngày mai.</p>
            ) : (
              scheduleGroups.tomorrow.map((card) => (
                <div key={card.id} className="px-5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-900 dark:text-white font-semibold">{card.term}</strong>
                    {card.pos && <span className="text-slate-400">({card.pos})</span>}
                    <span className="text-slate-600 dark:text-slate-300">— {card.vi}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Cấp {card.box}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Group: Các ngày tiếp theo */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span> Các ngày tiếp theo
            </span>
            <span className="text-xs font-semibold text-slate-500">{scheduleGroups.upcoming.length} thẻ</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-48 overflow-y-auto">
            {scheduleGroups.upcoming.length === 0 ? (
              <p className="p-4 text-xs text-slate-400 text-center">Không có thẻ nào trong danh sách tiếp theo.</p>
            ) : (
              scheduleGroups.upcoming.map((card) => (
                <div key={card.id} className="px-5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-900 dark:text-white font-semibold">{card.term}</strong>
                    {card.pos && <span className="text-slate-400">({card.pos})</span>}
                    <span className="text-slate-600 dark:text-slate-300">— {card.vi}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400">
                      {new Date(card.due).toLocaleDateString('vi-VN')}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Cấp {card.box}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Volume2,
  Mic,
  MicOff,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Card, ReviewMode, ReviewGrade, MAX_SPEECH_ATTEMPTS, getErrorMessage } from '../types/card';
import {
  calculateNextReview,
  getPreviewIntervalText,
  normalizeAnswer,
  stripPatternPlaceholders,
} from '../services/srs';
import { db } from '../services/db';
import { speakText, isSpeechRecognitionSupported, createSpeechRecognizer } from '../services/speech';
import { evaluateSentence, SentenceEvaluation } from '../services/ai';
import { playCorrectSound, playWrongSound, playRewardSound } from '../services/sound';
import { recordStudyActivity } from '../services/streak';
import type { ISpeechRecognition } from '../types/speech';

interface ReviewSessionProps {
  initialCards: Card[];
  selectedMode: ReviewMode;
  onFinishSession: () => void;
  onCancel: () => void;
}

export const ReviewSession: React.FC<ReviewSessionProps> = ({
  initialCards,
  selectedMode,
  onFinishSession,
  onCancel,
}) => {
  // Queue: cards to review in this session. Forgot cards get re-queued at the end!
  const [queue, setQueue] = useState<Card[]>([...initialCards]);
  const [totalInitialCount] = useState(initialCards.length);
  const [completedCount, setCompletedCount] = useState(0);

  // Re-entrancy guard for grading
  const [isGrading, setIsGrading] = useState(false);
  const isGradingRef = useRef(false);

  // In-session error notification
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Current active exercise
  const currentCard = queue[0];
  const [effectiveMode, setEffectiveMode] = useState<ReviewMode>('flip');

  // FlipCard state
  const [isFlipped, setIsFlipped] = useState(false);

  // Cloze state
  const [clozeInput, setClozeInput] = useState('');

  // Dictation state
  const [dictationInput, setDictationInput] = useState('');

  // Pronunciation state
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [speechAttempts, setSpeechAttempts] = useState(0);
  const speechRecognizerRef = useRef<ISpeechRecognition | null>(null);

  // Writing state
  const [userSentence, setUserSentence] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [, setSentenceResult] = useState<SentenceEvaluation | null>(null);

  // Auto-graded result preview state
  const [autoGradedResult, setAutoGradedResult] = useState<{
    grade: ReviewGrade;
    isCorrect: boolean;
    userAnswer: string;
    correctAnswer: string;
    feedback?: string;
  } | null>(null);

  // Determine effective mode for the current card
  useEffect(() => {
    if (!currentCard) return;

    // Reset card-level interactions
    setIsFlipped(false);
    setClozeInput('');
    setDictationInput('');
    setSpeechTranscript('');
    setSpeechAttempts(0);
    setUserSentence('');
    setSentenceResult(null);
    setAutoGradedResult(null);
    setSessionError(null);

    // Rule: Thẻ chưa ôn lần nào luôn ôn bằng Lật thẻ
    if (currentCard.reviewCount === 0) {
      setEffectiveMode('flip');
      return;
    }

    const hasSbSth = /\b(sb|sth)\b/i.test(currentCard.term);
    const hasCloze = Boolean(currentCard.cloze && currentCard.ans);
    const speechSupported = isSpeechRecognitionSupported();

    // Determine available modes for this specific card
    const availableModes: ReviewMode[] = ['flip'];
    if (hasCloze) availableModes.push('cloze');
    if (!hasSbSth) {
      availableModes.push('listen');
      if (speechSupported) {
        availableModes.push('pronounce');
      }
    }
    availableModes.push('write');

    if (selectedMode === 'mix') {
      const chosen = availableModes[Math.floor(Math.random() * availableModes.length)];
      setEffectiveMode(chosen);
    } else {
      if (availableModes.includes(selectedMode)) {
        setEffectiveMode(selectedMode);
      } else {
        setEffectiveMode('flip');
      }
    }
  }, [currentCard, selectedMode]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (speechRecognizerRef.current) {
        try {
          speechRecognizerRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  // Handle grade submission with concurrency lock & audio effects
  const handleGradeCard = async (grade: ReviewGrade) => {
    if (!currentCard || isGradingRef.current) return;

    isGradingRef.current = true;
    setIsGrading(true);

    // Sound effect on manual rating only (auto-graded modes already play audio upon answer evaluation)
    if (effectiveMode === 'flip') {
      if (grade === 'forgot') {
        playWrongSound();
      } else if (grade === 'good' || grade === 'easy') {
        playCorrectSound();
      }
    }

    try {
      const { nextBox, nextDueDate } = calculateNextReview(currentCard.box, grade);
      const updatedReviewCount = currentCard.reviewCount + 1;

      // Update in database
      await db.cards.update(currentCard.id, {
        box: nextBox,
        due: nextDueDate.toISOString(),
        reviewCount: updatedReviewCount,
      });

      // Record daily streak
      recordStudyActivity();

      // Queue update
      setQueue((prevQueue) => {
        const nextQueue = prevQueue.slice(1);
        if (grade === 'forgot') {
          // Re-queue at the end of the session
          nextQueue.push({
            ...currentCard,
            box: 0,
            due: nextDueDate.toISOString(),
            reviewCount: updatedReviewCount,
          });
        }
        return nextQueue;
      });

      if (grade !== 'forgot') {
        setCompletedCount((prev) => prev + 1);
      }

      // Check if finished
      if (queue.length <= 1 && grade !== 'forgot') {
        playRewardSound();
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    } catch (error: unknown) {
      setSessionError('Lỗi cập nhật tiến độ: ' + getErrorMessage(error));
    } finally {
      isGradingRef.current = false;
      setIsGrading(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGradingRef.current) return;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (autoGradedResult) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleGradeCard(autoGradedResult.grade);
        }
        return;
      }

      if (effectiveMode === 'flip') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setIsFlipped((prev) => !prev);
        } else if (isFlipped) {
          if (e.key === '1') handleGradeCard('forgot');
          if (e.key === '2') handleGradeCard('hard');
          if (e.key === '3') handleGradeCard('good');
          if (e.key === '4') handleGradeCard('easy');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [effectiveMode, isFlipped, autoGradedResult, queue]);

  // Cloze submit
  const handleClozeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!clozeInput.trim() || !currentCard.ans) return;

    const isMatch = normalizeAnswer(clozeInput) === normalizeAnswer(currentCard.ans);
    if (isMatch) {
      playCorrectSound();
    } else {
      playWrongSound();
    }

    setAutoGradedResult({
      grade: isMatch ? 'good' : 'forgot',
      isCorrect: isMatch,
      userAnswer: clozeInput.trim(),
      correctAnswer: currentCard.ans,
    });
  };

  // Dictation submit
  const handleDictationSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dictationInput.trim()) return;

    const isMatch = normalizeAnswer(dictationInput) === normalizeAnswer(currentCard.term);
    if (isMatch) {
      playCorrectSound();
    } else {
      playWrongSound();
    }

    setAutoGradedResult({
      grade: isMatch ? 'good' : 'forgot',
      isCorrect: isMatch,
      userAnswer: dictationInput.trim(),
      correctAnswer: currentCard.term,
    });
  };

  // Pronunciation mic handler
  const handleToggleListening = () => {
    if (isListening) {
      if (speechRecognizerRef.current) speechRecognizerRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognizer = createSpeechRecognizer(
      (transcript) => {
        setSpeechTranscript(transcript);
        setIsListening(false);

        const normalizedSpoken = normalizeAnswer(transcript);
        const normalizedTarget = normalizeAnswer(stripPatternPlaceholders(currentCard.term));
        const isMatch = normalizedSpoken.includes(normalizedTarget);

        if (isMatch) {
          playCorrectSound();
          setAutoGradedResult({
            grade: 'good',
            isCorrect: true,
            userAnswer: transcript,
            correctAnswer: currentCard.term,
          });
        } else {
          const nextAttempts = speechAttempts + 1;
          setSpeechAttempts(nextAttempts);
          if (nextAttempts >= MAX_SPEECH_ATTEMPTS) {
            playWrongSound();
            setAutoGradedResult({
              grade: 'forgot',
              isCorrect: false,
              userAnswer: transcript,
              correctAnswer: currentCard.term,
              feedback: `Đã thử ${MAX_SPEECH_ATTEMPTS} lần chưa chuẩn. Thẻ được tính là Quên.`,
            });
          }
        }
      },
      (err) => {
        setIsListening(false);
        setSessionError('Lỗi micro: ' + err);
      },
      () => setIsListening(false)
    );

    if (recognizer) {
      speechRecognizerRef.current = recognizer;
      setIsListening(true);
      recognizer.start();
    }
  };

  // Writing evaluation submit
  const handleWritingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSentence.trim()) return;

    setIsEvaluating(true);
    setSessionError(null);
    try {
      const evaluation = await evaluateSentence(currentCard.term, currentCard.vi, userSentence.trim());
      setSentenceResult(evaluation);

      if (evaluation.isCorrect) {
        playCorrectSound();
      } else {
        playWrongSound();
      }

      setAutoGradedResult({
        grade: evaluation.isCorrect ? 'good' : 'forgot',
        isCorrect: evaluation.isCorrect,
        userAnswer: userSentence.trim(),
        correctAnswer: evaluation.suggestedSentence,
        feedback: evaluation.feedbackVi,
      });
    } catch (error: unknown) {
      setSessionError('Lỗi chấm câu: ' + getErrorMessage(error));
    } finally {
      setIsEvaluating(false);
    }
  };

  // Render Finished Session Screen
  if (queue.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-12 px-6 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6 animate-scaleUp">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
          <Sparkles className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Tuyệt Vời! Đã Hoàn Thành Lượt Ôn!</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Bạn đã xuất sắc hoàn tất toàn bộ {totalInitialCount} lượt thẻ đến hạn hôm nay.
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex justify-around text-center">
          <div>
            <span className="block text-xl font-bold text-indigo-600 dark:text-indigo-400">{completedCount}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Thẻ đã củng cố</span>
          </div>
          <div className="border-r border-slate-200 dark:border-slate-700"></div>
          <div>
            <span className="block text-xl font-bold text-emerald-600 dark:text-emerald-400">100%</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Mục tiêu hôm nay</span>
          </div>
        </div>
        <button
          onClick={onFinishSession}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition"
        >
          Quay lại Màn hình Chính
        </button>
      </div>
    );
  }

  // Current mode label
  const getModeLabel = () => {
    switch (effectiveMode) {
      case 'flip':
        return 'Lật Thẻ (Flashcard)';
      case 'cloze':
        return 'Điền Chỗ Trống';
      case 'pronounce':
        return 'Luyện Phát Âm';
      case 'write':
        return 'Viết Câu Ứng Dụng';
      case 'listen':
        return 'Nghe & Gõ Lại';
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Top Session Progress Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <button onClick={onCancel} className="hover:text-slate-800 dark:hover:text-slate-200 font-medium">
          ← Tạm dừng
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
            {getModeLabel()}
          </span>
          <span>
            Còn lại: <strong>{queue.length}</strong> thẻ
          </span>
        </div>
      </div>

      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{
            width: `${Math.min(100, (completedCount / Math.max(1, totalInitialCount)) * 100)}%`,
          }}
        />
      </div>

      {sessionError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{sessionError}</span>
        </div>
      )}

      {/* Exercise Card Body */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl transition-all">
        {/* 1. FLIP CARD MODE */}
        {effectiveMode === 'flip' && (
          <div className="space-y-6 text-center">
            <div className="min-h-[160px] flex flex-col justify-center items-center space-y-3">
              <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                {currentCard.cat} • {currentCard.pos || 'từ vựng'}
              </span>

              <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {currentCard.term}
              </h3>

              <div className="flex items-center gap-2">
                {currentCard.ipa && (
                  <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{currentCard.ipa}</span>
                )}
                <button
                  onClick={() => speakText(currentCard.term)}
                  className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>

              {/* Flipped side content */}
              {isFlipped && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 w-full space-y-2 animate-fadeIn">
                  <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{currentCard.vi}</p>
                  {currentCard.en && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">"{currentCard.en}"</p>
                  )}
                  {currentCard.ex && (
                    <p className="text-xs italic text-slate-500 dark:text-slate-400">Ví dụ: {currentCard.ex}</p>
                  )}
                  {currentCard.fam && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Họ từ: {currentCard.fam}</p>
                  )}
                </div>
              )}
            </div>

            {/* Flip / Rating Controls */}
            {!isFlipped ? (
              <button
                onClick={() => setIsFlipped(true)}
                disabled={isGrading}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" /> Lật Thẻ Xem Nghĩa (Nhấn Phím Cách hoặc Enter)
              </button>
            ) : (
              <div className="space-y-2 pt-2 animate-fadeIn">
                <span className="text-[11px] text-slate-400 font-medium">
                  Đánh giá độ nhớ của bạn (hoặc bấm số 1, 2, 3, 4 trên bàn phím):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Quên */}
                  <button
                    onClick={() => handleGradeCard('forgot')}
                    disabled={isGrading}
                    className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 text-center transition disabled:opacity-50"
                  >
                    <span className="block text-xs font-bold text-rose-700 dark:text-rose-300">[1] Quên</span>
                    <span className="block text-[11px] text-rose-500 dark:text-rose-400 mt-0.5">
                      {getPreviewIntervalText('forgot', currentCard.box)}
                    </span>
                  </button>

                  {/* Khó */}
                  <button
                    onClick={() => handleGradeCard('hard')}
                    disabled={isGrading}
                    className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-900/60 text-center transition disabled:opacity-50"
                  >
                    <span className="block text-xs font-bold text-amber-700 dark:text-amber-300">[2] Khó</span>
                    <span className="block text-[11px] text-amber-500 dark:text-amber-400 mt-0.5">
                      {getPreviewIntervalText('hard', currentCard.box)}
                    </span>
                  </button>

                  {/* Tốt */}
                  <button
                    onClick={() => handleGradeCard('good')}
                    disabled={isGrading}
                    className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-900/60 text-center transition disabled:opacity-50"
                  >
                    <span className="block text-xs font-bold text-blue-700 dark:text-blue-300">[3] Tốt</span>
                    <span className="block text-[11px] text-blue-500 dark:text-blue-400 mt-0.5">
                      {getPreviewIntervalText('good', currentCard.box)}
                    </span>
                  </button>

                  {/* Dễ */}
                  <button
                    onClick={() => handleGradeCard('easy')}
                    disabled={isGrading}
                    className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-900/60 text-center transition disabled:opacity-50"
                  >
                    <span className="block text-xs font-bold text-emerald-700 dark:text-emerald-300">[4] Dễ</span>
                    <span className="block text-[11px] text-emerald-500 dark:text-emerald-400 mt-0.5">
                      {getPreviewIntervalText('easy', currentCard.box)}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. CLOZE TEST MODE */}
        {effectiveMode === 'cloze' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Đọc nghĩa & điền từ thích hợp vào chỗ trống
              </span>
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{currentCard.vi}</p>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-base font-medium text-slate-900 dark:text-white leading-relaxed">
                {currentCard.cloze}
              </div>
            </div>

            {!autoGradedResult && (
              <form onSubmit={handleClozeSubmit} className="space-y-3">
                <input
                  type="text"
                  autoFocus
                  placeholder="Gõ từ còn thiếu..."
                  value={clozeInput}
                  onChange={(e) => setClozeInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <button
                  type="submit"
                  disabled={!clozeInput.trim()}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md transition disabled:opacity-50"
                >
                  Kiểm tra đáp án (Nhấn Enter)
                </button>
              </form>
            )}
          </div>
        )}

        {/* 3. PRONUNCIATION MODE */}
        {effectiveMode === 'pronounce' && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Đọc to từ vựng vào micro
              </span>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{currentCard.term}</h3>
              {currentCard.ipa && (
                <p className="text-sm font-mono text-slate-500 dark:text-slate-400">{currentCard.ipa}</p>
              )}
            </div>

            {!autoGradedResult && (
              <div className="space-y-4">
                <button
                  onClick={handleToggleListening}
                  className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center transition shadow-lg ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/30'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                  }`}
                >
                  {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isListening ? 'Đang lắng nghe... Hãy đọc to từ trên.' : 'Bấm vào micro để bắt đầu nói'}
                </p>

                {speechTranscript && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Máy nghe thấy: <strong>"{speechTranscript}"</strong> (Thử lần: {speechAttempts}/{MAX_SPEECH_ATTEMPTS})
                  </p>
                )}

                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => {
                      playWrongSound();
                      setAutoGradedResult({
                        grade: 'forgot',
                        isCorrect: false,
                        userAnswer: 'Đã bỏ qua',
                        correctAnswer: currentCard.term,
                      });
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                  >
                    Bỏ qua bài này (Tính là Quên)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. WRITING MODE */}
        {effectiveMode === 'write' && (
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Viết một câu có dùng từ dưới đây
              </span>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{currentCard.term}</h3>
                <span className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">({currentCard.vi})</span>
              </div>
            </div>

            {!autoGradedResult && (
              <form onSubmit={handleWritingSubmit} className="space-y-3">
                <textarea
                  rows={3}
                  autoFocus
                  placeholder="Viết câu tiếng Anh của bạn tại đây..."
                  value={userSentence}
                  onChange={(e) => setUserSentence(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isEvaluating || !userSentence.trim()}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Sparkles className={`w-4 h-4 ${isEvaluating ? 'animate-spin' : ''}`} />
                  {isEvaluating ? 'AI đang chấm câu...' : 'Chấm câu với AI'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* 5. DICTATION (LISTEN & TYPE) MODE */}
        {effectiveMode === 'listen' && (
          <div className="space-y-6 text-center">
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Nghe phát âm và gõ lại chính xác từ đó
              </span>
              <button
                onClick={() => speakText(currentCard.term)}
                className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 mx-auto flex items-center justify-center shadow-md transition"
              >
                <Volume2 className="w-8 h-8" />
              </button>
              <p className="text-xs text-slate-400">Bấm loa để nghe lại phát âm</p>
            </div>

            {!autoGradedResult && (
              <form onSubmit={handleDictationSubmit} className="space-y-3 text-left">
                <input
                  type="text"
                  autoFocus
                  placeholder="Gõ từ bạn vừa nghe..."
                  value={dictationInput}
                  onChange={(e) => setDictationInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <button
                  type="submit"
                  disabled={!dictationInput.trim()}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md transition disabled:opacity-50"
                >
                  Kiểm tra đáp án (Nhấn Enter)
                </button>
              </form>
            )}
          </div>
        )}

        {/* AUTO-GRADED RESULT BANNER & NEXT ACTION */}
        {autoGradedResult && (
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4 animate-fadeIn">
            <div
              className={`p-4 rounded-2xl flex items-start gap-3 border ${
                autoGradedResult.isCorrect
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              {autoGradedResult.isCorrect ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 text-xs">
                <h4 className="text-sm font-bold">
                  {autoGradedResult.isCorrect ? 'Chính xác! (+1 Cấp)' : 'Chưa chính xác (Về Cấp 0 & Ôn lại sau 10p)'}
                </h4>
                <p>
                  Đáp án chuẩn: <strong className="font-semibold">{autoGradedResult.correctAnswer}</strong>
                </p>
                {autoGradedResult.feedback && <p className="mt-1 opacity-90">{autoGradedResult.feedback}</p>}
              </div>
            </div>

            {/* Quick full info summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <p>
                <strong>{currentCard.term}</strong> ({currentCard.pos}): {currentCard.vi}
              </p>
              {currentCard.ex && <p className="italic">"{currentCard.ex}"</p>}
            </div>

            <button
              onClick={() => handleGradeCard(autoGradedResult.grade)}
              disabled={isGrading}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              Tiếp tục thẻ kế tiếp (Nhấn Enter) <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import { useState, useEffect, useMemo } from 'react';
import { speakWord } from '../../services/audio';
import RatingBar from './RatingBar';

interface Vocabulary {
  id: number;
  word: string;
  defTh?: string;
  defEn?: string;
  type?: string;
}

interface MultipleChoiceModeProps {
  vocabulary: Vocabulary;
  distractors: Vocabulary[];
  onRate: (rating: number) => void;
}

export default function MultipleChoiceMode({
  vocabulary,
  distractors,
  onRate
}: MultipleChoiceModeProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [responseTime, setResponseTime] = useState<number>(0);

  const options = useMemo(() => {
    const allOptions = [vocabulary, ...distractors.slice(0, 3)];
    return allOptions.sort(() => Math.random() - 0.5);
  }, [vocabulary.id, distractors]);

  useEffect(() => {
    setSelectedId(null);
    setShowResult(false);
    setStartTime(Date.now());
    setResponseTime(0);
  }, [vocabulary.id]);

  const handleSelect = (id: number) => {
    if (showResult) return;
    const elapsed = (Date.now() - startTime) / 1000;
    setSelectedId(id);
    setShowResult(true);
    setResponseTime(elapsed);
    if (id === vocabulary.id) {
      speakWord(vocabulary.word);
    }
  };

  const isCorrect = selectedId === vocabulary.id;

  const getSuggestedRating = () => {
    if (!isCorrect) return 1;
    if (responseTime > 30) return 1;
    if (responseTime > 15) return 2;
    if (responseTime > 5) return 3;
    return 4;
  };

  // Live timer
  const [liveTime, setLiveTime] = useState(0);
  useEffect(() => {
    if (showResult) return;
    const interval = setInterval(() => {
      setLiveTime((Date.now() - startTime) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [startTime, showResult]);

  const getTimerColor = () => {
    if (liveTime < 5) return 'text-emerald-400';
    if (liveTime < 15) return 'text-yellow-400';
    if (liveTime < 30) return 'text-orange-400';
    return 'text-red-400';
  };

  const getTimerBarColor = () => {
    if (liveTime < 5) return 'bg-emerald-500';
    if (liveTime < 15) return 'bg-yellow-500';
    if (liveTime < 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getOptionClasses = (id: number) => {
    const base = `w-full p-4 rounded-2xl text-left transition-all duration-200
      bg-[var(--color-bg-surface)]/40 backdrop-blur-xl border`;

    if (!showResult) {
      return `${base} border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 active:scale-[0.98] cursor-pointer`;
    }
    if (id === vocabulary.id) {
      return `${base} border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]`;
    }
    if (id === selectedId) {
      return `${base} border-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)]`;
    }
    return `${base} border-white/5 opacity-30`;
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto px-2">
      {/* Live Timer Bar */}
      {!showResult && (
        <div className="w-full flex items-center gap-3 bg-[var(--color-bg-surface)]/40 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-white/5">
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-100 ${getTimerBarColor()}`}
              style={{ width: `${Math.min((liveTime / 30) * 100, 100)}%` }}
            />
          </div>
          <span className={`text-sm font-semibold tabular-nums min-w-[40px] text-right ${getTimerColor()}`}>
            {Math.floor(liveTime)}s
          </span>
        </div>
      )}

      {/* Question Card — Glassmorphism with emerald accent */}
      <div className="w-full rounded-3xl p-5 md:p-6 text-center
        bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl
        border border-emerald-500/20
        shadow-[0_0_40px_rgba(16,185,129,0.15)]">

        <h1 className="text-3xl sm:text-4xl font-bold font-display mb-2 text-[var(--color-text-primary)]">
          {vocabulary.word}
        </h1>

        {vocabulary.type && (
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-sm font-medium text-emerald-400 mb-2">
            {vocabulary.type}
          </span>
        )}

        <p className="text-sm text-[var(--color-text-muted)]">
          เลือกความหมายที่ถูกต้อง
        </p>
      </div>

      {/* Options — Glass cards */}
      <div className="w-full flex flex-col gap-2.5">
        {options.map((option) => (
          <button
            key={option.id}
            className={getOptionClasses(option.id)}
            onClick={() => handleSelect(option.id)}
            disabled={showResult}
          >
            <span className="block text-base font-medium text-[var(--color-text-primary)]">
              {option.defTh}
            </span>
            {option.defEn && (
              <span className="block text-sm text-[var(--color-text-secondary)] mt-0.5">
                {option.defEn}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Result & Rating */}
      {showResult && (
        <div className={`w-full rounded-3xl p-5 text-center
          bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl border
          ${isCorrect
            ? 'border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]'
            : 'border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.15)]'
          }
          animate-in fade-in slide-in-from-bottom-2 duration-300`}
        >
          <p className={`text-lg font-semibold mb-1 ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {isCorrect ? '✅ ถูกต้อง!' : '❌ ไม่ถูกต้อง'}
          </p>

          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            ⏱️ {responseTime.toFixed(1)}s · แนะนำ: {['', 'Again', 'Hard', 'Good', 'Easy'][getSuggestedRating()]}
          </p>

          {!isCorrect && (
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              คำตอบที่ถูก: <span className="text-emerald-400 font-medium">{vocabulary.defTh}</span>
            </p>
          )}

          <RatingBar onRate={onRate} />
        </div>
      )}
    </div>
  );
}

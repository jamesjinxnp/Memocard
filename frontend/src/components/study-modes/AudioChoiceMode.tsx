import { useState, useEffect, useMemo, useRef } from 'react';
import { speakWord, stopSpeaking } from '../../services/audio';
import RatingBar from './RatingBar';

interface Vocabulary {
  id: number;
  word: string;
  defTh?: string;
  defEn?: string;
  type?: string;
}

interface AudioChoiceModeProps {
  vocabulary: Vocabulary;
  distractors: Vocabulary[];
  onRate: (rating: number) => void;
}

export default function AudioChoiceMode({ vocabulary, distractors, onRate }: AudioChoiceModeProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [responseTime, setResponseTime] = useState<number>(0);
  const currentPlayingRef = useRef<number | null>(null);

  const options = useMemo(() => {
    const allOptions = [vocabulary, ...distractors.slice(0, 3)];
    return allOptions.sort(() => Math.random() - 0.5);
  }, [vocabulary.id, distractors]);

  useEffect(() => {
    setSelectedId(null);
    setShowResult(false);
    setIsCorrect(false);
    setStartTime(Date.now());
    setResponseTime(0);
    stopSpeaking();
    setPlayingId(null);
    currentPlayingRef.current = null;
  }, [vocabulary.id]);

  const handlePlay = async (option: Vocabulary) => {
    if (showResult) return;
    stopSpeaking();
    currentPlayingRef.current = option.id;
    setPlayingId(option.id);
    try {
      await speakWord(option.word);
    } catch (err) {
      console.warn('Audio playback error:', err);
    } finally {
      if (currentPlayingRef.current === option.id) {
        setPlayingId(null);
        currentPlayingRef.current = null;
      }
    }
  };

  const handleSelect = (id: number) => {
    if (showResult) return;
    const elapsed = (Date.now() - startTime) / 1000;
    setSelectedId(id);
    setShowResult(true);
    setResponseTime(elapsed);
    const correct = id === vocabulary.id;
    setIsCorrect(correct);
    if (correct) speakWord(vocabulary.word);
  };

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
    const base = `flex items-center gap-3 w-full p-3 rounded-2xl transition-all duration-200
      bg-[var(--color-bg-surface)]/40 backdrop-blur-xl border`;

    if (!showResult) {
      return `${base} border-white/10 hover:border-violet-500/40`;
    }
    if (id === vocabulary.id) {
      return `${base} border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]`;
    }
    if (id === selectedId) {
      return `${base} border-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)]`;
    }
    return `${base} border-white/5 opacity-30`;
  };

  if (distractors.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto px-2">
        <div className="w-full rounded-3xl p-6 text-center
          bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl
          border border-violet-500/20
          shadow-[0_0_40px_rgba(139,92,246,0.15)]">
          <div className="text-4xl mb-3">🎧</div>
          <p className="text-[var(--color-text-secondary)]">กำลังโหลดตัวเลือก...</p>
        </div>
      </div>
    );
  }

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

      {/* Definition Card — Glassmorphism with violet accent */}
      <div className="w-full rounded-3xl p-5 md:p-6 text-center
        bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl
        border border-violet-500/20
        shadow-[0_0_40px_rgba(139,92,246,0.15)]">

        <div className="text-4xl mb-2">🎧</div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-violet-400 mb-3">
          เลือกเสียงที่ตรงกับคำแปล
        </h2>

        <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent mb-2">
          {vocabulary.defTh || vocabulary.defEn}
        </p>

        {vocabulary.type && (
          <span className="inline-block px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-sm font-medium text-violet-400">
            {vocabulary.type}
          </span>
        )}
      </div>

      {/* Audio Options — Glass cards */}
      <div className="w-full flex flex-col gap-2.5">
        {options.map((option, index) => (
          <div key={option.id} className={getOptionClasses(option.id)}>
            <button
              className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg
                transition-all duration-200 active:scale-90
                ${playingId === option.id
                  ? 'bg-violet-500/30 border border-violet-500/50'
                  : 'bg-violet-500/15 border border-violet-500/20 hover:bg-violet-500/25'
                }`}
              onClick={() => handlePlay(option)}
            >
              {playingId === option.id ? '🔊' : '▶️'}
            </button>
            <button
              className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10
                text-[var(--color-text-primary)] font-medium
                hover:bg-white/10 transition-colors
                disabled:cursor-not-allowed"
              onClick={() => handleSelect(option.id)}
              disabled={showResult}
            >
              ตัวเลือก {index + 1}
            </button>
            {showResult && option.id === vocabulary.id && (
              <span className="text-sm font-semibold text-emerald-400">{option.word}</span>
            )}
          </div>
        ))}
      </div>

      {/* Result Card */}
      {showResult && (
        <div className={`w-full rounded-3xl p-5 text-center
          bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl border
          ${isCorrect
            ? 'border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]'
            : 'border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.15)]'
          }
          animate-in fade-in slide-in-from-bottom-2 duration-300`}
        >
          <div className="text-4xl mb-2">{isCorrect ? '✅' : '❌'}</div>

          <p className={`text-lg font-semibold mb-1 ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            คำตอบ: <strong>{vocabulary.word}</strong>
          </p>

          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            ⏱️ {responseTime.toFixed(1)}s · แนะนำ: {['', 'Again', 'Hard', 'Good', 'Easy'][getSuggestedRating()]}
          </p>

          <RatingBar onRate={onRate} />
        </div>
      )}
    </div>
  );
}

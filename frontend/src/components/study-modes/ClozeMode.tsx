import { useState, useEffect, useMemo } from 'react';
import { speakSentence } from '../../services/audio';
import RatingBar from './RatingBar';

interface Vocabulary {
  id: number;
  word: string;
  defTh?: string;
  defEn?: string;
  example?: string;
}

interface ClozeModeProps {
  vocabulary: Vocabulary;
  onRate: (rating: number) => void;
}

export default function ClozeMode({ vocabulary, onRate }: ClozeModeProps) {
  const [input, setInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [responseTime, setResponseTime] = useState<number>(0);

  const { clozeSentence, blankLength } = useMemo(() => {
    if (!vocabulary.example) {
      return { clozeSentence: `Use "${vocabulary.word}" in a sentence.`, blankLength: vocabulary.word.length };
    }
    const regex = new RegExp(`\\b${vocabulary.word}\\b`, 'gi');
    const sentence = vocabulary.example.replace(regex, (match) => '_'.repeat(match.length));
    return { clozeSentence: sentence, blankLength: vocabulary.word.length };
  }, [vocabulary]);

  useEffect(() => {
    setInput('');
    setShowResult(false);
    setIsCorrect(false);
    setStartTime(Date.now());
    setResponseTime(0);
  }, [vocabulary.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userAnswer = input.toLowerCase().trim();
    const correctAnswer = vocabulary.word.toLowerCase().trim();
    const correct = userAnswer === correctAnswer;
    const elapsed = (Date.now() - startTime) / 1000;

    setIsCorrect(correct);
    setShowResult(true);
    setResponseTime(elapsed);

    if (correct && vocabulary.example) {
      speakSentence(vocabulary.example);
    }
  };

  const getSuggestedRating = () => {
    if (!isCorrect) return 1;
    if (responseTime > 60) return 1;
    if (responseTime > 25) return 2;
    if (responseTime > 10) return 3;
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
    if (liveTime < 10) return 'text-emerald-400';
    if (liveTime < 25) return 'text-yellow-400';
    if (liveTime < 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getTimerBarColor = () => {
    if (liveTime < 10) return 'bg-emerald-500';
    if (liveTime < 25) return 'bg-yellow-500';
    if (liveTime < 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto px-2">
      {/* Live Timer Bar */}
      {!showResult && (
        <div className="w-full flex items-center gap-3 bg-[var(--color-bg-surface)]/40 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-white/5">
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-100 ${getTimerBarColor()}`}
              style={{ width: `${Math.min((liveTime / 60) * 100, 100)}%` }}
            />
          </div>
          <span className={`text-sm font-semibold tabular-nums min-w-[40px] text-right ${getTimerColor()}`}>
            {Math.floor(liveTime)}s
          </span>
        </div>
      )}

      {/* Cloze Card — Glassmorphism with cyan accent */}
      <div className="w-full rounded-3xl p-5 md:p-6 text-center
        bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl
        border border-cyan-500/20
        shadow-[0_0_40px_rgba(6,182,212,0.15)]">
        {/* Gradient accent strip */}
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r from-cyan-600 to-teal-700" />

        <h2 className="text-sm font-semibold uppercase tracking-widest text-cyan-400 mb-4">
          เติมคำในช่องว่าง
        </h2>

        <p className="text-lg md:text-xl leading-relaxed mb-4 px-3 py-3
          bg-white/5 rounded-xl border border-white/5
          text-[var(--color-text-primary)]">
          {clozeSentence}
        </p>

        {vocabulary.defTh && (
          <p className="text-sm text-cyan-300/80 mb-2">
            💡 {vocabulary.defTh}
          </p>
        )}

        <p className="text-xs text-[var(--color-text-muted)]">
          ({blankLength} ตัวอักษร)
        </p>
      </div>

      {/* Input Form */}
      {!showResult ? (
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำที่หายไป..."
            className="w-full px-4 py-3.5 text-lg text-center rounded-2xl
              bg-[var(--color-bg-surface)]/40 backdrop-blur-xl
              border border-white/10 focus:border-cyan-500/50
              text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
              outline-none transition-all duration-200
              focus:shadow-[0_0_20px_rgba(6,182,212,0.15)]"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            autoFocus
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-full py-3.5 rounded-2xl text-base font-semibold text-white
              bg-gradient-to-r from-cyan-600 to-teal-700
              hover:from-cyan-500 hover:to-teal-600
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 active:scale-[0.98]"
          >
            ตรวจคำตอบ
          </button>
        </form>
      ) : (
        /* Result Card — Glassmorphism */
        <div className={`w-full rounded-3xl p-5 md:p-6 text-center
          bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl border
          ${isCorrect
            ? 'border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]'
            : 'border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.15)]'
          }
          animate-in fade-in slide-in-from-bottom-2 duration-300`}
        >
          <div className="text-4xl mb-3">{isCorrect ? '✅' : '❌'}</div>

          <p className={`text-xl font-bold font-display mb-2 ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {vocabulary.word}
          </p>

          {vocabulary.example && (
            <p className="text-sm italic opacity-70 text-[var(--color-text-secondary)] mb-3">
              {vocabulary.example}
            </p>
          )}

          {!isCorrect && (
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              คำตอบของคุณ: <span className="line-through text-red-400">{input}</span>
            </p>
          )}

          <button
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
              text-[var(--color-text-secondary)] hover:bg-white/10 transition-colors mb-3"
            onClick={() => vocabulary.example && speakSentence(vocabulary.example)}
          >
            🔊 ฟังประโยค
          </button>

          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            ⏱️ {responseTime.toFixed(1)}s
          </p>

          {/* Rating — highlight suggested */}
          <RatingBar onRate={onRate} />
          {getSuggestedRating() > 0 && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              แนะนำ: {['', 'Again', 'Hard', 'Good', 'Easy'][getSuggestedRating()]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

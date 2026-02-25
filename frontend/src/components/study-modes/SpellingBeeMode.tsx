import { useState, useEffect, useRef, useMemo } from 'react';
import RatingBar from './RatingBar';

interface Vocabulary {
  id: number;
  word: string;
  defTh?: string;
  defEn?: string;
  type?: string;
  ipaUs?: string;
}

interface SpellingBeeModeProps {
  vocabulary: Vocabulary;
  onRate: (rating: number) => void;
}

type HintLevel = 0 | 1 | 2 | 3 | 4 | 5;

export default function SpellingBeeMode({ vocabulary, onRate }: SpellingBeeModeProps) {
  const [input, setInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hintLevel, setHintLevel] = useState<HintLevel>(0);
  const [attempts, setAttempts] = useState(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [responseTime, setResponseTime] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInput('');
    setShowResult(false);
    setIsCorrect(false);
    setHintLevel(0);
    setAttempts(0);
    setStartTime(Date.now());
    setResponseTime(0);
    inputRef.current?.focus();
  }, [vocabulary.id]);

  const shuffledPositions = useMemo(() => {
    const word = vocabulary.word;
    const positions = word.split('').map((_, i) => i);
    const seed = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = (i: number) => {
      const x = Math.sin(seed + i) * 10000;
      return x - Math.floor(x);
    };
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(random(i) * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    return positions;
  }, [vocabulary.word]);

  const getRevealedWord = (): string => {
    const word = vocabulary.word;
    if (word.length === 0) return '';
    const revealedPositions: Set<number> = new Set();
    const positionsToReveal = Math.min(hintLevel, shuffledPositions.length);
    for (let i = 0; i < positionsToReveal; i++) {
      revealedPositions.add(shuffledPositions[i]);
    }
    return word
      .split('')
      .map((char, idx) => {
        if (char === ' ') return '  ';
        if (char === '-') return '-';
        return revealedPositions.has(idx) ? char.toUpperCase() : '_';
      })
      .join(' ');
  };

  const useHint = () => {
    if (hintLevel < 5) setHintLevel((prev) => (prev + 1) as HintLevel);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userAnswer = input.toLowerCase().trim();
    const correctAnswer = vocabulary.word.toLowerCase().trim();
    const correct = userAnswer === correctAnswer;
    const elapsed = (Date.now() - startTime) / 1000;
    setAttempts(attempts + 1);
    if (correct) {
      setIsCorrect(true);
      setShowResult(true);
      setResponseTime(elapsed);
    } else if (attempts >= 2) {
      setIsCorrect(false);
      setShowResult(true);
      setResponseTime(elapsed);
    } else {
      setInput('');
      inputRef.current?.focus();
    }
  };

  const getSuggestedRating = () => {
    if (!isCorrect) return 1;
    if (responseTime > 60 || hintLevel >= 4) return 1;
    if (responseTime > 30 || hintLevel >= 2) return 2;
    if (responseTime > 12 || hintLevel >= 1 || attempts > 1) return 3;
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
    if (liveTime < 12) return 'text-emerald-400';
    if (liveTime < 30) return 'text-yellow-400';
    if (liveTime < 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getTimerBarColor = () => {
    if (liveTime < 12) return 'bg-emerald-500';
    if (liveTime < 30) return 'bg-yellow-500';
    if (liveTime < 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto px-2">
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

      {/* Definition Card — Glassmorphism with pink accent */}
      <div className="w-full rounded-3xl p-5 md:p-6 text-center
        bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl
        border border-pink-500/20
        shadow-[0_0_40px_rgba(236,72,153,0.15)]">

        <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent mb-2">
          {vocabulary.defTh || vocabulary.defEn}
        </p>

        {vocabulary.type && (
          <span className="inline-block px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 text-sm font-medium text-pink-400">
            {vocabulary.type}
          </span>
        )}
      </div>

      {/* Hint Section — Glass */}
      <div className="w-full rounded-2xl p-4 bg-[var(--color-bg-surface)]/30 backdrop-blur-xl border border-white/5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Hints: {hintLevel}/5
          </span>
          <button
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30
              text-amber-400 text-sm font-medium transition-all duration-200 active:scale-95
              disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={useHint}
            disabled={hintLevel >= 5 || showResult}
          >
            💡 ขอ Hint ({5 - hintLevel})
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          📏 {vocabulary.word.length} ตัวอักษร
        </p>
      </div>

      {/* Input Form */}
      {!showResult ? (
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          {/* Hangman Display */}
          <div
            className={`w-full rounded-2xl p-5 min-h-[80px] flex flex-col items-center justify-center cursor-text
              bg-[var(--color-bg-surface)]/40 backdrop-blur-xl
              border border-white/10 transition-all duration-200
              focus-within:border-pink-500/40 focus-within:shadow-[0_0_20px_rgba(236,72,153,0.15)]
              ${attempts > 0 && !isCorrect ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
            onClick={() => inputRef.current?.focus()}
          >
            <div className="flex gap-2 justify-center flex-wrap">
              {vocabulary.word.split('').map((_, idx) => {
                const typedChar = input[idx];
                const hintChar = getRevealedWord().split(' ')[idx];

                if (typedChar) {
                  return <span key={idx} className="text-2xl font-bold font-mono min-w-[1.5rem] text-center text-[var(--color-text-primary)]">{typedChar.toUpperCase()}</span>;
                } else if (hintChar && hintChar !== '_') {
                  return <span key={idx} className="text-2xl font-bold font-mono min-w-[1.5rem] text-center text-amber-400">{hintChar}</span>;
                } else {
                  return <span key={idx} className="text-2xl font-bold font-mono min-w-[1.5rem] text-center text-[var(--color-text-muted)]">_</span>;
                }
              })}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="absolute opacity-0 w-full h-full cursor-text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
              maxLength={vocabulary.word.length}
            />
          </div>

          {hintLevel >= 5 && (vocabulary.defTh || vocabulary.defEn) && (
            <p className="text-sm text-[var(--color-text-muted)] text-center">
              💡 {vocabulary.defTh || vocabulary.defEn}
            </p>
          )}

          <p className="text-xs text-[var(--color-text-muted)] text-center">
            ความพยายาม: {attempts + 1}/3
          </p>

          <button
            type="submit"
            disabled={!input.trim()}
            className="w-full py-3.5 rounded-2xl text-base font-semibold text-white
              bg-gradient-to-r from-pink-600 to-rose-700
              hover:from-pink-500 hover:to-rose-600
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 active:scale-[0.98]"
          >
            ตรวจคำตอบ
          </button>
        </form>
      ) : (
        /* Result Card */
        <div className={`w-full rounded-3xl p-5 md:p-6 text-center
          bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl border
          ${isCorrect
            ? 'border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]'
            : 'border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.15)]'
          }
          animate-in fade-in slide-in-from-bottom-2 duration-300`}
        >
          <div className="text-4xl mb-3">{isCorrect ? '🏆' : '😢'}</div>

          <h2 className={`text-2xl font-bold font-display mb-1 ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {vocabulary.word}
          </h2>

          {vocabulary.ipaUs && (
            <p className="text-base opacity-60 font-serif mb-2 text-[var(--color-text-secondary)]">
              /{vocabulary.ipaUs}/
            </p>
          )}

          {!isCorrect && input && (
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">
              คำตอบของคุณ: <span className="line-through text-red-400">{input}</span>
            </p>
          )}

          <div className="flex gap-3 justify-center text-xs text-[var(--color-text-muted)] mb-4">
            <span>⏱️ {responseTime.toFixed(1)}s</span>
            <span>💡 {hintLevel} hints</span>
            <span>🔄 {attempts} attempts</span>
          </div>

          <RatingBar onRate={onRate} />

          {getSuggestedRating() > 0 && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              แนะนำ: {['', 'Again', 'Hard', 'Good', 'Easy'][getSuggestedRating()]}
            </p>
          )}
        </div>
      )}

      {/* Shake animation keyframes */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}

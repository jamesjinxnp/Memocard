import { useState, useRef, useEffect } from 'react';
import { speakWord } from '../../services/audio';
import RatingBar from './RatingBar';

interface Vocabulary {
  id: number;
  word: string;
  defTh?: string;
  defEn?: string;
  type?: string;
  ipaUs?: string;
}

interface TypingModeProps {
  vocabulary: Vocabulary;
  onRate: (rating: number) => void;
}

export default function TypingMode({ vocabulary, onRate }: TypingModeProps) {
  const [input, setInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [responseTime, setResponseTime] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setInput('');
    setShowResult(false);
    setIsCorrect(false);
    setAttempts(0);
    setStartTime(Date.now());
    setResponseTime(0);
  }, [vocabulary.id]);

  const normalizeText = (text: string) =>
    text.toLowerCase().trim().replace(/[^a-z\s-]/g, '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userAnswer = normalizeText(input);
    const correctAnswer = normalizeText(vocabulary.word);
    const correct = userAnswer === correctAnswer;
    const elapsed = (Date.now() - startTime) / 1000;

    setIsCorrect(correct);
    setShowResult(true);
    setAttempts(attempts + 1);
    setResponseTime(elapsed);

    if (correct) {
      speakWord(vocabulary.word);
    }
  };

  const handleRate = (rating: number) => {
    onRate(rating);
    setInput('');
    setShowResult(false);
  };

  const getSuggestedRating = () => {
    if (!isCorrect) return 1;
    if (responseTime > 45) return 1;
    if (responseTime > 20) return 2;
    if (responseTime > 8) return 3;
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
    if (liveTime < 8) return 'text-emerald-400';
    if (liveTime < 20) return 'text-yellow-400';
    if (liveTime < 45) return 'text-orange-400';
    return 'text-red-400';
  };

  const getTimerBarColor = () => {
    if (liveTime < 8) return 'bg-emerald-500';
    if (liveTime < 20) return 'bg-yellow-500';
    if (liveTime < 45) return 'bg-orange-500';
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
              style={{ width: `${Math.min((liveTime / 45) * 100, 100)}%` }}
            />
          </div>
          <span className={`text-sm font-semibold tabular-nums min-w-[40px] text-right ${getTimerColor()}`}>
            {Math.floor(liveTime)}s
          </span>
        </div>
      )}

      {/* Definition Card — Glassmorphism with blue accent */}
      <div className="w-full rounded-3xl p-5 md:p-6 text-center
        bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl
        border border-blue-500/20
        shadow-[0_0_40px_rgba(59,130,246,0.15)]">

        {vocabulary.type && (
          <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-sm font-medium text-blue-400 mb-3">
            {vocabulary.type}
          </span>
        )}

        {vocabulary.defEn && (
          <p className="text-lg md:text-xl text-[var(--color-text-primary)] mb-2">
            {vocabulary.defEn}
          </p>
        )}

        {vocabulary.defTh && (
          <p className="text-base md:text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            {vocabulary.defTh}
          </p>
        )}
      </div>

      {/* Input Form */}
      {!showResult ? (
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำศัพท์ที่ถูกต้อง..."
            className="w-full px-4 py-3.5 text-lg text-center rounded-2xl
              bg-[var(--color-bg-surface)]/40 backdrop-blur-xl
              border border-white/10 focus:border-blue-500/50
              text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
              outline-none transition-all duration-200
              focus:shadow-[0_0_20px_rgba(59,130,246,0.15)]"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-full py-3.5 rounded-2xl text-base font-semibold text-white
              bg-gradient-to-r from-blue-600 to-indigo-700
              hover:from-blue-500 hover:to-indigo-600
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

          <h2 className={`text-2xl font-bold font-display mb-1 ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {vocabulary.word}
          </h2>

          {vocabulary.ipaUs && (
            <p className="text-base opacity-60 font-serif mb-3 text-[var(--color-text-secondary)]">
              /{vocabulary.ipaUs}/
            </p>
          )}

          {!isCorrect && (
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              คำตอบของคุณ: <span className="line-through text-red-400">{input}</span>
            </p>
          )}

          <button
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
              text-[var(--color-text-secondary)] hover:bg-white/10 transition-colors mb-4"
            onClick={() => speakWord(vocabulary.word)}
          >
            🔊 ฟังเสียง
          </button>

          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            แนะนำ: {['', 'Again', 'Hard', 'Good', 'Easy'][getSuggestedRating()]}
          </p>

          <RatingBar onRate={handleRate} />

          {!isCorrect && (
            <button
              className="mt-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
                text-[var(--color-text-secondary)] hover:bg-white/10 transition-colors"
              onClick={() => {
                setShowResult(false);
                setInput('');
                inputRef.current?.focus();
              }}
            >
              ลองใหม่อีกครั้ง
            </button>
          )}
        </div>
      )}
    </div>
  );
}

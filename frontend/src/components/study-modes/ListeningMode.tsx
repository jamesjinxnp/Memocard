import { useState, useEffect, useRef } from 'react';
import { speakWord, speakSentence } from '../../services/audio';
import RatingBar from './RatingBar';

interface Vocabulary {
  id: number;
  word: string;
  defTh?: string;
  defEn?: string;
  type?: string;
  ipaUs?: string;
  example?: string;
}

interface ListeningModeProps {
  vocabulary: Vocabulary;
  onRate: (rating: number) => void;
}

export default function ListeningMode({ vocabulary, onRate }: ListeningModeProps) {
  const [input, setInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [responseTime, setResponseTime] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInput('');
    setShowResult(false);
    setIsCorrect(false);
    setPlayCount(0);
    setStartTime(Date.now());
    setResponseTime(0);
    handlePlay();
    inputRef.current?.focus();
  }, [vocabulary.id]);

  const handlePlay = async (slow = false) => {
    setIsPlaying(true);
    try {
      await speakWord(vocabulary.word, slow);
      setPlayCount((c) => c + 1);
    } finally {
      setIsPlaying(false);
    }
  };

  const handlePlayExample = async () => {
    if (vocabulary.example) {
      setIsPlaying(true);
      try {
        await speakSentence(vocabulary.example);
      } finally {
        setIsPlaying(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const elapsed = (Date.now() - startTime) / 1000;
    setResponseTime(elapsed);
    const userAnswer = input.toLowerCase().trim();
    const correctAnswer = vocabulary.word.toLowerCase().trim();
    const correct = userAnswer === correctAnswer;
    setIsCorrect(correct);
    setShowResult(true);
    if (!correct) {
      await speakWord(vocabulary.word, true);
    } else {
      speakWord(vocabulary.word);
    }
  };

  const getSuggestedRating = () => {
    if (!isCorrect) return 1;
    if (responseTime > 45 || playCount > 5) return 1;
    if (responseTime > 25 || playCount > 3) return 2;
    if (responseTime > 10 || playCount > 1) return 3;
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
    if (liveTime < 45) return 'text-orange-400';
    return 'text-red-400';
  };

  const getTimerBarColor = () => {
    if (liveTime < 10) return 'bg-emerald-500';
    if (liveTime < 25) return 'bg-yellow-500';
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

      {/* Audio Card — Glassmorphism with amber accent */}
      <div className="w-full rounded-3xl p-5 md:p-6 text-center
        bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl
        border border-amber-500/20
        shadow-[0_0_40px_rgba(245,158,11,0.15)]">

        <div className="text-5xl mb-3">🎧</div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400 mb-4">
          ฟังและพิมพ์คำศัพท์
        </h2>

        <div className="flex gap-3 justify-center mb-3">
          <button
            className="px-5 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/30
              text-amber-400 font-medium transition-all duration-200 active:scale-95
              hover:bg-amber-500/30 disabled:opacity-40"
            onClick={() => handlePlay(false)}
            disabled={isPlaying}
          >
            🔊 เล่น
          </button>
          <button
            className="px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10
              text-[var(--color-text-secondary)] font-medium transition-all duration-200 active:scale-95
              hover:bg-white/10 disabled:opacity-40"
            onClick={() => handlePlay(true)}
            disabled={isPlaying}
          >
            🐢 เล่นช้า
          </button>
        </div>

        <p className="text-xs text-[var(--color-text-muted)]">
          เล่นแล้ว {playCount} ครั้ง
        </p>
      </div>

      {/* Typing Input */}
      {!showResult && (
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำที่ได้ยิน..."
            className="w-full px-4 py-3.5 text-lg text-center rounded-2xl
              bg-[var(--color-bg-surface)]/40 backdrop-blur-xl
              border border-white/10 focus:border-amber-500/50
              text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
              outline-none transition-all duration-200
              focus:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-full py-3.5 rounded-2xl text-base font-semibold text-white
              bg-gradient-to-r from-amber-600 to-orange-700
              hover:from-amber-500 hover:to-orange-600
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 active:scale-[0.98]"
          >
            ตรวจคำตอบ
          </button>
        </form>
      )}

      {/* Result Card — Glassmorphism */}
      {showResult && (
        <div className={`w-full rounded-3xl p-5 md:p-6 text-center
          bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl border
          ${isCorrect
            ? 'border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]'
            : 'border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.15)]'
          }
          animate-in fade-in slide-in-from-bottom-2 duration-300`}
        >
          <div className="text-4xl mb-3">{isCorrect ? '✅' : '❌'}</div>

          {/* Wrong answer comparison */}
          {!isCorrect && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-[var(--color-text-muted)]">คุณพิมพ์:</span>
                <span className="text-sm font-semibold text-red-400 line-through">{input || '(ว่าง)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">คำตอบที่ถูก:</span>
                <span className="text-sm font-semibold text-emerald-400">{vocabulary.word}</span>
                <button
                  className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30 transition-colors"
                  onClick={() => speakWord(vocabulary.word, true)}
                >
                  🔊 ฟังช้าๆ
                </button>
              </div>
            </div>
          )}

          <h1 className="text-2xl md:text-3xl font-bold font-display mb-1 text-[var(--color-text-primary)]">
            {vocabulary.word}
          </h1>

          {vocabulary.ipaUs && (
            <p className="text-base opacity-60 font-serif mb-2 text-[var(--color-text-secondary)]">
              /{vocabulary.ipaUs}/
            </p>
          )}

          {vocabulary.type && (
            <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-sm font-medium text-amber-400 mb-2">
              {vocabulary.type}
            </span>
          )}

          {vocabulary.defEn && (
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">{vocabulary.defEn}</p>
          )}

          {vocabulary.defTh && (
            <p className="text-sm text-[var(--color-text-muted)]">{vocabulary.defTh}</p>
          )}

          {vocabulary.example && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-sm italic text-[var(--color-text-secondary)] mb-2">{vocabulary.example}</p>
              <button
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs
                  text-[var(--color-text-secondary)] hover:bg-white/10 transition-colors"
                onClick={handlePlayExample}
                disabled={isPlaying}
              >
                🔊 ฟังตัวอย่าง
              </button>
            </div>
          )}

          <p className="text-xs text-[var(--color-text-muted)] mt-3 mb-4">
            ⏱️ {responseTime.toFixed(1)}s | 🔊 {playCount}x · แนะนำ: {['', 'Again', 'Hard', 'Good', 'Easy'][getSuggestedRating()]}
          </p>

          <RatingBar onRate={onRate} />
        </div>
      )}
    </div>
  );
}

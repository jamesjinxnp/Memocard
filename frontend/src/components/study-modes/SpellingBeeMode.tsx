import { useState, useEffect, useRef, useMemo } from 'react';

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

  // Generate shuffled positions based on word (consistent for same word)
  const shuffledPositions = useMemo(() => {
    const word = vocabulary.word;
    const positions = word.split('').map((_, i) => i);

    // Simple seeded shuffle based on word
    const seed = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = (i: number) => {
      const x = Math.sin(seed + i) * 10000;
      return x - Math.floor(x);
    };

    // Fisher-Yates shuffle with seed
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(random(i) * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    return positions;
  }, [vocabulary.word]);

  // Hangman-style hint: progressively reveal letters at random positions
  const getRevealedWord = (): string => {
    const word = vocabulary.word;
    const len = word.length;

    if (len === 0) return '';

    // Reveal positions based on hint level (using shuffled order)
    const revealedPositions: Set<number> = new Set();
    const positionsToReveal = Math.min(hintLevel, shuffledPositions.length);

    for (let i = 0; i < positionsToReveal; i++) {
      revealedPositions.add(shuffledPositions[i]);
    }

    // Build the display string
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
    if (hintLevel < 5) {
      setHintLevel((prev) => (prev + 1) as HintLevel);
    }
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
      // Show answer after 3 failed attempts
      setIsCorrect(false);
      setShowResult(true);
      setResponseTime(elapsed);
    } else {
      // Shake animation and clear input
      setInput('');
      inputRef.current?.focus();
    }
  };

  // Time-based rating: Again (wrong or >60s or hints≥4), Hard (30-60s or hints 2-3), Good (12-30s or hints 1), Easy (<12s with 0 hints)
  const getSuggestedRating = () => {
    if (!isCorrect) return 1; // Again - wrong answer
    if (responseTime > 60 || hintLevel >= 4) return 1; // Again - took too long or too many hints
    if (responseTime > 30 || hintLevel >= 2) return 2; // Hard
    if (responseTime > 12 || hintLevel >= 1 || attempts > 1) return 3; // Good
    return 4; // Easy - fast, no hints, first attempt
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
    if (liveTime < 12) return '#22c55e'; // Easy - green
    if (liveTime < 30) return '#eab308'; // Good - yellow
    if (liveTime < 60) return '#f97316'; // Hard - orange
    return '#ef4444'; // Again - red
  };

  return (
    <div className="spelling-bee-mode">
      {/* Live Timer Bar */}
      {!showResult && (
        <div className="live-timer-container">
          <div className="live-timer-track">
            <div className="live-timer-bar" style={{
              width: `${Math.min((liveTime / 60) * 100, 100)}%`,
              background: getTimerColor()
            }} />
          </div>
          <span className="live-timer-text" style={{ color: getTimerColor() }}>
            {Math.floor(liveTime)}s
          </span>
        </div>
      )}

      {/* Definition Card - แสดงคำแปลไทย */}
      <div className="definition-card">
        <p className="thai-definition">{vocabulary.defTh || vocabulary.defEn}</p>

        {vocabulary.type && (
          <span className="type-badge">{vocabulary.type}</span>
        )}
      </div>

      {/* Hint System */}
      <div className="hint-section">
        <div className="hint-header">
          <span>Hints Used: {hintLevel}/5</span>
          <button
            className="hint-btn"
            onClick={useHint}
            disabled={hintLevel >= 5 || showResult}
          >
            💡 ขอ Hint ({5 - hintLevel} เหลือ)
          </button>
        </div>

        {/* Show word length always */}
        <p className="word-length-info">
          📏 {vocabulary.word.length} ตัวอักษร
        </p>
      </div>

      {/* Input Form */}
      {!showResult ? (
        <form onSubmit={handleSubmit} className="input-form">
          {/* Unified Hangman Input - user typing replaces underscores */}
          <div
            className={`hangman-input-wrapper ${attempts > 0 && !isCorrect ? 'shake' : ''}`}
            onClick={() => inputRef.current?.focus()}
          >
            <div className="hangman-display-line">
              {/* Show typed letters + remaining blanks */}
              {vocabulary.word.split('').map((_, idx) => {
                const typedChar = input[idx];
                const hintChar = getRevealedWord().split(' ')[idx];

                // Priority: user typed > hint revealed > underscore
                if (typedChar) {
                  return <span key={idx} className="typed-char">{typedChar.toUpperCase()}</span>;
                } else if (hintChar && hintChar !== '_') {
                  return <span key={idx} className="hint-char">{hintChar}</span>;
                } else {
                  return <span key={idx} className="blank-char">_</span>;
                }
              })}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="hangman-hidden-input"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
              maxLength={vocabulary.word.length}
            />
          </div>

          {hintLevel >= 5 && (vocabulary.defTh || vocabulary.defEn) && (
            <p className="hint-definition-below">💡 {vocabulary.defTh || vocabulary.defEn}</p>
          )}

          <div className="attempt-indicator">
            ความพยายาม: {attempts + 1}/3
          </div>

          <button type="submit" className="submit-btn" disabled={!input.trim()}>
            ตรวจคำตอบ
          </button>
        </form>
      ) : (
        /* Result */
        <div className={`result ${isCorrect ? 'correct' : 'incorrect'}`}>
          <div className="result-icon">{isCorrect ? '🏆' : '😢'}</div>

          <h2 className="word">{vocabulary.word}</h2>

          {vocabulary.ipaUs && (
            <p className="ipa">/{vocabulary.ipaUs}/</p>
          )}

          {!isCorrect && input && (
            <p className="your-answer">
              คำตอบของคุณ: <span className="wrong">{input}</span>
            </p>
          )}

          <div className="stats">
            <span>⏱️ {responseTime.toFixed(1)}s</span>
            <span>Hints: {hintLevel}</span>
            <span>Attempts: {attempts}</span>
          </div>

          {/* Rating */}
          <div className="rating-buttons">
            <button
              className={`rating-btn again ${getSuggestedRating() === 1 ? 'suggested' : ''}`}
              onClick={() => onRate(1)}
            >
              Again
            </button>
            <button
              className={`rating-btn hard ${getSuggestedRating() === 2 ? 'suggested' : ''}`}
              onClick={() => onRate(2)}
            >
              Hard
            </button>
            <button
              className={`rating-btn good ${getSuggestedRating() === 3 ? 'suggested' : ''}`}
              onClick={() => onRate(3)}
            >
              Good
            </button>
            <button
              className={`rating-btn easy ${getSuggestedRating() === 4 ? 'suggested' : ''}`}
              onClick={() => onRate(4)}
            >
              Easy
            </button>
          </div>
        </div>
      )}

      <style>{`
        .spelling-bee-mode {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          padding: 2rem;
          max-width: 500px;
          margin: 0 auto;
        }

        .live-timer-container {
          width: 100%;
          background: #1e293b;
          border-radius: 12px;
          padding: 0.5rem 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .live-timer-track {
          flex: 1;
          height: 8px;
          background: #334155;
          border-radius: 4px;
          overflow: hidden;
        }

        .live-timer-bar {
          height: 100%;
          border-radius: 4px;
          transition: width 0.1s linear, background 0.3s;
        }

        .live-timer-text {
          font-size: 0.9rem;
          font-weight: 600;
          white-space: nowrap;
          min-width: 50px;
          text-align: right;
        }

        .definition-card {
          background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
          color: white;
          padding: 2rem;
          border-radius: 16px;
          text-align: center;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }

        .thai-definition {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1rem 0;
        }

        .type-badge {
          background: rgba(255,255,255,0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.85rem;
          display: inline-block;
          margin-bottom: 1rem;
        }

        .mode-badge {
          background: rgba(0,0,0,0.1);
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-weight: 600;
          display: inline-block;
          margin-bottom: 1rem;
        }

        .audio-controls {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .play-btn {
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .play-btn.large {
          width: 80px;
          height: 80px;
          font-size: 2rem;
          background: white;
        }

        .play-btn.small {
          width: 50px;
          height: 50px;
          font-size: 1.2rem;
          background: rgba(255,255,255,0.5);
        }

        .play-btn:hover:not(:disabled) {
          transform: scale(1.1);
        }

        .instruction {
          font-size: 0.95rem;
        }

        .hint-section {
          width: 100%;
          background: #f8fafc;
          border-radius: 12px;
          padding: 1rem;
        }

        .hint-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .hint-btn {
          padding: 0.5rem 1rem;
          background: #fbbf24;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
        }

        .hint-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .word-length-info {
          font-size: 0.9rem;
          color: #64748b;
          margin-bottom: 0.5rem;
        }

        .hangman-input-wrapper {
          position: relative;
          background: white;
          border: 3px solid #e2e8f0;
          border-radius: 16px;
          padding: 1.5rem;
          min-height: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: text;
        }

        .hangman-input-wrapper:focus-within {
          border-color: #667eea;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2);
        }

        .hangman-display-line {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .hangman-display-line span {
          font-size: 1.8rem;
          font-weight: 700;
          font-family: monospace;
          min-width: 1.5rem;
          text-align: center;
        }

        .typed-char {
          color: #1e293b;
        }

        .hint-char {
          color: #f59e0b;
        }

        .blank-char {
          color: #94a3b8;
        }

        .hangman-hidden-input {
          position: absolute;
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: text;
        }

        .hint-definition-below {
          font-size: 0.9rem;
          color: #64748b;
          text-align: center;
          margin: 0.5rem 0;
        }

        .input-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .word-input {
          width: 100%;
          padding: 1rem;
          font-size: 1.5rem;
          border: 3px solid #e2e8f0;
          border-radius: 12px;
          text-align: center;
          font-family: monospace;
          letter-spacing: 0.2em;
        }

        .word-input:focus {
          outline: none;
          border-color: #fda085;
        }

        .word-input.shake {
          animation: shake 0.5s;
          border-color: #ef4444;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .attempt-indicator {
          text-align: center;
          font-size: 0.9rem;
          color: #64748b;
        }

        .submit-btn {
          padding: 1rem;
          font-size: 1rem;
          font-weight: 600;
          background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
          color: #1e293b;
          border: none;
          border-radius: 12px;
          cursor: pointer;
        }

        .submit-btn:disabled {
          opacity: 0.5;
        }

        .result {
          text-align: center;
          padding: 2rem;
          border-radius: 16px;
          width: 100%;
          color: white;
        }

        .result.correct {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }

        .result.incorrect {
          background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        }

        .result-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .word {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .ipa {
          font-size: 1.1rem;
          opacity: 0.9;
          font-family: serif;
        }

        .your-answer {
          margin-top: 1rem;
          font-size: 0.9rem;
        }

        .wrong {
          text-decoration: line-through;
        }

        .stats {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin: 1rem 0;
          font-size: 0.9rem;
          opacity: 0.9;
        }

        .speak-btn {
          padding: 0.5rem 1rem;
          background: rgba(255,255,255,0.2);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          margin-bottom: 1.5rem;
        }

        .rating-buttons {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .rating-btn {
          padding: 0.5rem 1rem;
          border: 2px solid rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.1);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .rating-btn.suggested {
          background: rgba(255,255,255,0.3);
          border-color: white;
          transform: scale(1.05);
        }

        .rating-btn:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
}

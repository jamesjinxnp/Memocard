import { useState, useEffect, useRef } from 'react';
import { speakWord, speakSentence } from '../../services/audio';

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
    // Auto-play on new card
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

    // Audio feedback: play slow when wrong to help learn pronunciation
    if (!correct) {
      // Play slow pronunciation for wrong answers
      await speakWord(vocabulary.word, true);
    } else {
      speakWord(vocabulary.word);
    }
  };

  // Time-based rating: Again (wrong or >45s or plays>5), Hard (25-45s), Good (10-25s), Easy (<10s)
  const getSuggestedRating = () => {
    if (!isCorrect) return 1; // Again - wrong answer
    if (responseTime > 45 || playCount > 5) return 1; // Again - took too long or too many plays
    if (responseTime > 25 || playCount > 3) return 2; // Hard
    if (responseTime > 10 || playCount > 1) return 3; // Good
    return 4; // Easy - fast with minimal plays
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
    if (liveTime < 10) return '#22c55e'; // Easy - green
    if (liveTime < 25) return '#eab308'; // Good - yellow
    if (liveTime < 45) return '#f97316'; // Hard - orange
    return '#ef4444'; // Again - red
  };

  return (
    <div className="listening-mode">
      {/* Live Timer Bar */}
      {!showResult && (
        <div className="live-timer-container">
          <div className="live-timer-track">
            <div className="live-timer-bar" style={{
              width: `${Math.min((liveTime / 45) * 100, 100)}%`,
              background: getTimerColor()
            }} />
          </div>
          <span className="live-timer-text" style={{ color: getTimerColor() }}>
            {Math.floor(liveTime)}s
          </span>
        </div>
      )}

      {/* Audio Player Card */}
      <div className="audio-card">
        <div className="audio-icon">🎧</div>
        <h2>ฟังและพิมพ์คำศัพท์</h2>

        <div className="play-buttons">
          <button
            className="play-btn normal"
            onClick={() => handlePlay(false)}
            disabled={isPlaying}
          >
            🔊 เล่น
          </button>
          <button
            className="play-btn slow"
            onClick={() => handlePlay(true)}
            disabled={isPlaying}
          >
            🐢 เล่นช้า
          </button>
        </div>

        <p className="play-count">เล่นแล้ว {playCount} ครั้ง</p>
      </div>

      {/* Typing Input */}
      {!showResult && (
        <form onSubmit={handleSubmit} className="input-form">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำที่ได้ยิน..."
            className="word-input"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <button type="submit" className="submit-btn" disabled={!input.trim()}>
            ตรวจคำตอบ
          </button>
        </form>
      )}

      {/* Result Display */}
      {showResult && (
        <div className={`result-card ${isCorrect ? 'correct' : 'incorrect'}`}>
          <div className="result-icon">{isCorrect ? '✅' : '❌'}</div>

          {/* Show comparison when wrong */}
          {!isCorrect && (
            <div className="wrong-comparison">
              <div className="your-answer">
                <span className="label">คุณพิมพ์:</span>
                <span className="answer wrong">{input || '(ว่าง)'}</span>
              </div>
              <div className="correct-answer">
                <span className="label">คำตอบที่ถูก:</span>
                <span className="answer correct-text">{vocabulary.word}</span>
                <button className="replay-btn" onClick={() => speakWord(vocabulary.word, true)}>
                  🔊 ฟังช้าๆ
                </button>
              </div>
            </div>
          )}

          <h1 className="word">{vocabulary.word}</h1>

          {vocabulary.ipaUs && (
            <p className="ipa">/{vocabulary.ipaUs}/</p>
          )}

          {vocabulary.type && (
            <span className="type-badge">{vocabulary.type}</span>
          )}

          {vocabulary.defEn && (
            <p className="def-en">{vocabulary.defEn}</p>
          )}

          {vocabulary.defTh && (
            <p className="def-th">{vocabulary.defTh}</p>
          )}

          {vocabulary.example && (
            <div className="example-section">
              <p className="example">{vocabulary.example}</p>
              <button
                className="example-play"
                onClick={handlePlayExample}
                disabled={isPlaying}
              >
                🔊 ฟังตัวอย่าง
              </button>
            </div>
          )}

          {/* Rating Buttons */}
          <p className="time-display">⏱️ {responseTime.toFixed(1)}s | 🔊 {playCount}x plays</p>
          <div className="rating-buttons">
            <button className={`rating-btn again ${getSuggestedRating() === 1 ? 'suggested' : ''}`} onClick={() => onRate(1)}>
              Again
            </button>
            <button className={`rating-btn hard ${getSuggestedRating() === 2 ? 'suggested' : ''}`} onClick={() => onRate(2)}>
              Hard
            </button>
            <button className={`rating-btn good ${getSuggestedRating() === 3 ? 'suggested' : ''}`} onClick={() => onRate(3)}>
              Good
            </button>
            <button className={`rating-btn easy ${getSuggestedRating() === 4 ? 'suggested' : ''}`} onClick={() => onRate(4)}>
              Easy
            </button>
          </div>
        </div>
      )}

      <style>{`
        .listening-mode {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
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

        .audio-card {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          padding: 2rem;
          border-radius: 16px;
          text-align: center;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }

        .audio-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .audio-card h2 {
          margin-bottom: 1.5rem;
        }

        .play-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .play-btn {
          padding: 1rem 1.5rem;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .play-btn:disabled {
          opacity: 0.6;
        }

        .play-btn:not(:disabled):hover {
          transform: scale(1.05);
        }

        .play-btn.normal {
          background: white;
          color: #f5576c;
        }

        .play-btn.slow {
          background: rgba(255,255,255,0.2);
          color: white;
        }

        .play-count {
          font-size: 0.9rem;
          opacity: 0.8;
        }

        .input-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .word-input {
          width: 100%;
          padding: 1rem;
          font-size: 1.25rem;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          text-align: center;
          background: white;
          color: #1e293b;
        }

        .word-input:focus {
          outline: none;
          border-color: #f5576c;
        }

        .submit-btn {
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .submit-btn:not(:disabled):hover {
          transform: scale(1.02);
        }

        .result-card {
          background: white;
          padding: 2rem;
          border-radius: 16px;
          text-align: center;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }

        .result-card.correct {
          border: 3px solid #22c55e;
        }

        .result-card.incorrect {
          border: 3px solid #ef4444;
        }

        .result-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .answer-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 2rem;
          border-radius: 16px;
          text-align: center;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }

        .word {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .ipa {
          font-size: 1.2rem;
          opacity: 0.9;
          font-family: serif;
          margin-bottom: 0.5rem;
        }

        .type-badge {
          display: inline-block;
          background: rgba(255,255,255,0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }

        .def-en {
          font-size: 1.1rem;
          margin-bottom: 0.5rem;
        }

        .def-th {
          font-size: 1rem;
          opacity: 0.9;
        }

        .example-section {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255,255,255,0.2);
        }

        .example {
          font-style: italic;
          font-size: 0.95rem;
          opacity: 0.9;
          margin-bottom: 0.5rem;
        }

        .example-play {
          padding: 0.5rem 1rem;
          background: rgba(255,255,255,0.2);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
        }

        .rating-buttons {
          display: flex;
          gap: 0.5rem;
          margin-top: 1.5rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .rating-btn {
          padding: 0.75rem 1.25rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .rating-btn:hover {
          transform: translateY(-2px);
        }

        .rating-btn.again { background: #ef4444; color: white; }
        .rating-btn.hard { background: #f97316; color: white; }
        .rating-btn.good { background: #22c55e; color: white; }
        .rating-btn.easy { background: #3b82f6; color: white; }
        .rating-btn.suggested { transform: scale(1.1); box-shadow: 0 0 10px rgba(255,255,255,0.5); }
        .time-display { font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem; margin-top: 1rem; }

        /* Wrong answer comparison styles */
        .wrong-comparison {
          background: #fef2f2;
          border: 2px solid #ef4444;
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1rem;
          text-align: left;
        }

        .wrong-comparison .your-answer,
        .wrong-comparison .correct-answer {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }

        .wrong-comparison .label {
          font-size: 0.85rem;
          color: #64748b;
          min-width: 80px;
        }

        .wrong-comparison .answer {
          font-size: 1.1rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
        }

        .wrong-comparison .answer.wrong {
          background: #fee2e2;
          color: #dc2626;
          text-decoration: line-through;
        }

        .wrong-comparison .answer.correct-text {
          background: #dcfce7;
          color: #16a34a;
        }

        .replay-btn {
          padding: 0.25rem 0.75rem;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .replay-btn:hover {
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}

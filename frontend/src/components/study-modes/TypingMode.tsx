import { useState, useRef, useEffect } from 'react';
import { speakWord } from '../../services/audio';

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
    const elapsed = (Date.now() - startTime) / 1000; // seconds

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

  // Time-based rating: Again (wrong or >45s), Hard (20-45s), Good (8-20s), Easy (<8s)
  const getSuggestedRating = () => {
    if (!isCorrect) return 1; // Again - wrong answer
    if (responseTime > 45) return 1; // Again - took too long
    if (responseTime > 20) return 2; // Hard
    if (responseTime > 8) return 3; // Good
    return 4; // Easy - fast response
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
    if (liveTime < 8) return '#22c55e'; // Easy - green
    if (liveTime < 20) return '#eab308'; // Good - yellow
    if (liveTime < 45) return '#f97316'; // Hard - orange
    return '#ef4444'; // Again - red
  };

  return (
    <div className="typing-mode">
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

      {/* Definition Display */}
      <div className="definition-card">
        {vocabulary.type && (
          <span className="type-badge">{vocabulary.type}</span>
        )}

        {vocabulary.defEn && (
          <p className="def-en">{vocabulary.defEn}</p>
        )}

        {vocabulary.defTh && (
          <p className="def-th">{vocabulary.defTh}</p>
        )}
      </div>

      {/* Input Form */}
      {!showResult ? (
        <form onSubmit={handleSubmit} className="input-form">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำศัพท์ที่ถูกต้อง..."
            className="word-input"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <button type="submit" className="submit-btn" disabled={!input.trim()}>
            ตรวจคำตอบ
          </button>
        </form>
      ) : (
        /* Result Display */
        <div className={`result ${isCorrect ? 'correct' : 'incorrect'}`}>
          <div className="result-icon">
            {isCorrect ? '✅' : '❌'}
          </div>

          <h2 className="correct-word">{vocabulary.word}</h2>

          {vocabulary.ipaUs && (
            <p className="ipa">/{vocabulary.ipaUs}/</p>
          )}

          {!isCorrect && (
            <p className="your-answer">
              คำตอบของคุณ: <span className="wrong">{input}</span>
            </p>
          )}

          <button
            className="speak-btn"
            onClick={() => speakWord(vocabulary.word)}
          >
            🔊 ฟังเสียง
          </button>

          {/* Rating Buttons */}
          <div className="rating-buttons">
            <button
              className={`rating-btn again ${getSuggestedRating() === 1 ? 'suggested' : ''}`}
              onClick={() => handleRate(1)}
            >
              Again
            </button>
            <button
              className={`rating-btn hard ${getSuggestedRating() === 2 ? 'suggested' : ''}`}
              onClick={() => handleRate(2)}
            >
              Hard
            </button>
            <button
              className={`rating-btn good ${getSuggestedRating() === 3 ? 'suggested' : ''}`}
              onClick={() => handleRate(3)}
            >
              Good
            </button>
            <button
              className={`rating-btn easy ${getSuggestedRating() === 4 ? 'suggested' : ''}`}
              onClick={() => handleRate(4)}
            >
              Easy
            </button>
          </div>

          {!isCorrect && (
            <button
              className="try-again-btn"
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

      <style>{`
        .typing-mode {
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

        .definition-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 2rem;
          border-radius: 16px;
          text-align: center;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }

        .type-badge {
          background: rgba(255,255,255,0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.85rem;
          display: inline-block;
          margin-bottom: 1rem;
        }

        .def-en {
          font-size: 1.2rem;
          margin-bottom: 0.5rem;
        }

        .def-th {
          font-size: 1rem;
          opacity: 0.9;
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
          transition: border-color 0.2s;
          background: white;
          color: #1e293b;
        }

        .word-input:focus {
          outline: none;
          border-color: #667eea;
        }

        .submit-btn {
          padding: 1rem;
          font-size: 1rem;
          font-weight: 600;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.2s, opacity 0.2s;
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .submit-btn:not(:disabled):hover {
          transform: translateY(-2px);
        }

        .result {
          text-align: center;
          padding: 2rem;
          border-radius: 16px;
          width: 100%;
        }

        .result.correct {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          color: white;
        }

        .result.incorrect {
          background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
          color: white;
        }

        .result-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .correct-word {
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
          opacity: 0.8;
        }

        .speak-btn {
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          background: rgba(255,255,255,0.2);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          font-size: 1rem;
        }

        .rating-buttons {
          display: flex;
          gap: 0.5rem;
          margin-top: 1.5rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .rating-btn {
          padding: 0.5rem 1rem;
          border: 2px solid rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.1);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .rating-btn.suggested {
          background: rgba(255,255,255,0.3);
          border-color: white;
          transform: scale(1.05);
        }

        .rating-btn:hover {
          background: rgba(255,255,255,0.2);
        }

        .try-again-btn {
          margin-top: 1rem;
          padding: 0.75rem 1.5rem;
          background: rgba(255,255,255,0.2);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          font-size: 1rem;
        }

        .try-again-btn:hover {
          background: rgba(255,255,255,0.3);
        }
      `}</style>
    </div>
  );
}

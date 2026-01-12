import { useState, useEffect, useMemo } from 'react';
import { speakWord } from '../../services/audio';

interface Vocabulary {
  id: number;
  word: string;
  defTh?: string;
  defEn?: string;
  type?: string;
}

interface MultipleChoiceModeProps {
  vocabulary: Vocabulary;
  distractors: Vocabulary[]; // 3 wrong options
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

  // Shuffle options
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

  // Time-based rating: Again (wrong or >30s), Hard (15-30s), Good (5-15s), Easy (<5s)
  const getSuggestedRating = () => {
    if (!isCorrect) return 1; // Again - wrong answer
    if (responseTime > 30) return 1; // Again - took too long
    if (responseTime > 15) return 2; // Hard
    if (responseTime > 5) return 3; // Good
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
    if (liveTime < 5) return '#22c55e'; // Easy - green
    if (liveTime < 15) return '#eab308'; // Good - yellow
    if (liveTime < 30) return '#f97316'; // Hard - orange
    return '#ef4444'; // Again - red
  };

  const getOptionClass = (id: number) => {
    if (!showResult) return '';
    if (id === vocabulary.id) return 'correct';
    if (id === selectedId) return 'incorrect';
    return 'disabled';
  };

  return (
    <div className="multiple-choice-mode">
      {/* Live Timer Bar */}
      {!showResult && (
        <div className="live-timer-container">
          <div className="live-timer-track">
            <div className="live-timer-bar" style={{
              width: `${Math.min((liveTime / 30) * 100, 100)}%`,
              background: getTimerColor()
            }} />
          </div>
          <span className="live-timer-text" style={{ color: getTimerColor() }}>
            {Math.floor(liveTime)}s
          </span>
        </div>
      )}

      {/* Question Card */}
      <div className="question-card">
        <h1 className="word">{vocabulary.word}</h1>
        {vocabulary.type && (
          <span className="type-badge">{vocabulary.type}</span>
        )}
        <p className="instruction">เลือกความหมายที่ถูกต้อง</p>
      </div>

      {/* Options */}
      <div className="options">
        {options.map((option) => (
          <button
            key={option.id}
            className={`option ${getOptionClass(option.id)}`}
            onClick={() => handleSelect(option.id)}
            disabled={showResult}
          >
            <span className="def-th">{option.defTh}</span>
            {option.defEn && (
              <span className="def-en">{option.defEn}</span>
            )}
          </button>
        ))}
      </div>

      {/* Result & Rating */}
      {showResult && (
        <div className={`result ${isCorrect ? 'correct' : 'incorrect'}`}>
          <p className="result-text">
            {isCorrect ? '✅ ถูกต้อง!' : '❌ ไม่ถูกต้อง'}
          </p>

          <p className="time-display">⏱️ {responseTime.toFixed(1)}s</p>

          {!isCorrect && (
            <p className="correct-answer">
              คำตอบที่ถูก: {vocabulary.defTh}
            </p>
          )}

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
        .multiple-choice-mode {
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

        .question-card {
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

        .type-badge {
          display: inline-block;
          background: rgba(255,255,255,0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }

        .instruction {
          font-size: 0.95rem;
          opacity: 0.9;
        }

        .options {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .option {
          width: 100%;
          padding: 1rem;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
        }

        .option:hover:not(:disabled) {
          border-color: #667eea;
          transform: translateX(4px);
        }

        .option.correct {
          background: #dcfce7;
          border-color: #22c55e;
        }

        .option.incorrect {
          background: #fee2e2;
          border-color: #ef4444;
        }

        .option.disabled {
          opacity: 0.5;
        }

        .option .def-th {
          display: block;
          font-size: 1.1rem;
          font-weight: 500;
          color: #1e293b;
        }

        .option .def-en {
          display: block;
          font-size: 0.9rem;
          color: #64748b;
          margin-top: 0.25rem;
        }

        .result {
          text-align: center;
          padding: 1.5rem;
          border-radius: 12px;
          width: 100%;
        }

        .result.correct {
          background: #dcfce7;
        }

        .result.incorrect {
          background: #fee2e2;
        }

        .result-text {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .correct-answer {
          font-size: 0.95rem;
          color: #64748b;
          margin-bottom: 1rem;
        }

        .rating-buttons {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .rating-btn {
          padding: 0.75rem 1.5rem;
          min-height: 48px;
          min-width: 72px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: transform 0.2s;
          color: white;
        }

        .rating-btn:hover {
          transform: translateY(-2px);
        }

        .rating-btn:active {
          transform: scale(0.95);
        }

        .rating-btn.again { background: #ef4444; }
        .rating-btn.hard { background: #f97316; }
        .rating-btn.good { background: #22c55e; }
        .rating-btn.easy { background: #3b82f6; }
        .rating-btn.suggested { transform: scale(1.1); box-shadow: 0 0 10px rgba(255,255,255,0.5); }
        .time-display { font-size: 0.9rem; color: #64748b; margin-bottom: 0.5rem; }
      `}</style>
    </div>
  );
}

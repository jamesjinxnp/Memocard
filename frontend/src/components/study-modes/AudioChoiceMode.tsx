import { useState, useEffect, useMemo } from 'react';
import { speakWord } from '../../services/audio';

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

  // Shuffle options - same as MultipleChoiceMode
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
  }, [vocabulary.id]);

  const handlePlay = async (option: Vocabulary) => {
    if (showResult) return;
    setPlayingId(option.id);
    try {
      await speakWord(option.word);
    } finally {
      setPlayingId(null);
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

    if (correct) {
      speakWord(vocabulary.word);
    }
  };

  // Time-based rating: Again (wrong or >30s), Hard (15-30s), Good (5-15s), Easy (<5s)
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
    if (liveTime < 5) return '#22c55e';
    if (liveTime < 15) return '#eab308';
    if (liveTime < 30) return '#f97316';
    return '#ef4444';
  };

  const getOptionClass = (id: number) => {
    if (!showResult) return '';
    if (id === vocabulary.id) return 'correct';
    if (id === selectedId) return 'incorrect';
    return 'disabled';
  };

  // Wait for distractors to load
  if (distractors.length === 0) {
    return (
      <div className="audio-choice-mode">
        <div className="definition-card">
          <div className="mode-icon">🎧</div>
          <p>กำลังโหลดตัวเลือก...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="audio-choice-mode">
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

      {/* Definition Card */}
      <div className="definition-card">
        <div className="mode-icon">🎧</div>
        <h2>เลือกเสียงที่ตรงกับคำแปล</h2>
        <p className="thai-definition">{vocabulary.defTh || vocabulary.defEn}</p>
        {vocabulary.type && (
          <span className="type-badge">{vocabulary.type}</span>
        )}
      </div>

      {/* Audio Options */}
      <div className="audio-options">
        {options.map((option, index) => (
          <div key={option.id} className={`audio-option ${getOptionClass(option.id)}`}>
            <button
              className="play-audio-btn"
              onClick={() => handlePlay(option)}
              disabled={playingId !== null}
            >
              {playingId === option.id ? '🔊' : '▶️'}
            </button>
            <button
              className="select-btn"
              onClick={() => handleSelect(option.id)}
              disabled={showResult}
            >
              ตัวเลือก {index + 1}
            </button>
            {showResult && option.id === vocabulary.id && (
              <span className="correct-word">{option.word}</span>
            )}
          </div>
        ))}
      </div>

      {/* Result */}
      {showResult && (
        <div className={`result ${isCorrect ? 'correct' : 'incorrect'}`}>
          <div className="result-icon">{isCorrect ? '✅' : '❌'}</div>
          <p className="correct-answer">
            คำตอบ: <strong>{vocabulary.word}</strong>
          </p>
          <p className="time-display">{responseTime.toFixed(1)}s</p>

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
        .audio-choice-mode {
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

        .mode-icon {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }

        .definition-card h2 {
          font-size: 1rem;
          opacity: 0.9;
          margin-bottom: 1rem;
        }

        .thai-definition {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .type-badge {
          background: rgba(255,255,255,0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.85rem;
          display: inline-block;
        }

        .audio-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
        }

        .audio-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: #f1f5f9;
          padding: 0.75rem;
          border-radius: 12px;
          transition: all 0.2s;
        }

        .audio-option.correct {
          background: #dcfce7;
          border: 2px solid #22c55e;
        }

        .audio-option.incorrect {
          background: #fee2e2;
          border: 2px solid #ef4444;
        }

        .audio-option.disabled {
          opacity: 0.5;
        }

        .play-audio-btn {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: none;
          background: #667eea;
          color: white;
          font-size: 1.25rem;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .play-audio-btn:hover:not(:disabled) {
          transform: scale(1.1);
        }

        .play-audio-btn:disabled {
          opacity: 0.7;
        }

        .select-btn {
          flex: 1;
          padding: 0.75rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          color: #1e293b;
        }

        .select-btn:hover:not(:disabled) {
          border-color: #667eea;
          background: #f0f4ff;
        }

        .select-btn:disabled {
          cursor: not-allowed;
        }

        .correct-word {
          font-weight: 600;
          color: #22c55e;
        }

        .result {
          width: 100%;
          padding: 1.5rem;
          border-radius: 16px;
          text-align: center;
        }

        .result.correct {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          color: white;
        }

        .result.incorrect {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
        }

        .result-icon {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }

        .correct-answer {
          font-size: 1.1rem;
          margin-bottom: 0.5rem;
        }

        .time-display {
          font-size: 0.9rem;
          opacity: 0.9;
          margin-bottom: 1rem;
        }

        .rating-buttons {
          display: flex;
          gap: 0.5rem;
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
      `}</style>
    </div>
  );
}

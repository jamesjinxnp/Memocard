import { useState, useEffect, useRef } from 'react';
import { speakWord } from '../../services/audio';

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
    const [isPlaying, setIsPlaying] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setInput('');
        setShowResult(false);
        setIsCorrect(false);
        setHintLevel(0);
        setAttempts(0);
        // Auto-play audio on new word
        handlePlay();
        inputRef.current?.focus();
    }, [vocabulary.id]);

    const handlePlay = async (slow = false) => {
        setIsPlaying(true);
        try {
            await speakWord(vocabulary.word, slow);
        } finally {
            setIsPlaying(false);
        }
    };

    const getHint = (): string | null => {
        const word = vocabulary.word;

        switch (hintLevel) {
            case 0:
                return null;
            case 1:
                // Word length
                return `${word.length} ตัวอักษร`;
            case 2:
                // First letter
                return `เริ่มต้นด้วย "${word[0].toUpperCase()}"`;
            case 3:
                // First and last letter
                return `${word[0].toUpperCase()} _ _ _ ${word[word.length - 1]}`;
            case 4:
                // Part of speech
                return vocabulary.type ? `(${vocabulary.type})` : 'No type available';
            case 5:
                // Definition
                return vocabulary.defTh || vocabulary.defEn || 'No definition';
            default:
                return null;
        }
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

        setAttempts(attempts + 1);

        if (correct) {
            setIsCorrect(true);
            setShowResult(true);
            speakWord(vocabulary.word);
        } else if (attempts >= 2) {
            // Show answer after 3 failed attempts
            setIsCorrect(false);
            setShowResult(true);
        } else {
            // Shake animation and clear input
            setInput('');
            inputRef.current?.focus();
        }
    };

    // Calculate rating based on hints used and attempts
    const getSuggestedRating = () => {
        if (!isCorrect) return 1;
        if (hintLevel === 0 && attempts === 1) return 4; // Easy
        if (hintLevel <= 2 && attempts <= 2) return 3; // Good
        return 2; // Hard
    };

    const hintLabels = [
        '🔒 No hints',
        '📏 จำนวนตัวอักษร',
        '🔤 ตัวอักษรแรก',
        '🔡 ตัวแรก + ตัวสุดท้าย',
        '📚 ประเภทคำ',
        '💡 ความหมาย'
    ];

    return (
        <div className="spelling-bee-mode">
            {/* Audio Card */}
            <div className="audio-card">
                <div className="mode-badge">🐝 Spelling Bee (Hardcore)</div>

                <div className="audio-controls">
                    <button
                        className="play-btn large"
                        onClick={() => handlePlay(false)}
                        disabled={isPlaying}
                    >
                        🔊
                    </button>
                    <button
                        className="play-btn small"
                        onClick={() => handlePlay(true)}
                        disabled={isPlaying}
                    >
                        🐢
                    </button>
                </div>

                <p className="instruction">ฟังเสียงและสะกดคำให้ถูกต้อง</p>
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

                {hintLevel > 0 && (
                    <div className="hints-list">
                        {Array.from({ length: hintLevel }, (_, i) => (
                            <div key={i} className="hint-item">
                                <span className="hint-label">{hintLabels[i + 1]}</span>
                            </div>
                        ))}
                        <div className="current-hint">
                            {getHint()}
                        </div>
                    </div>
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
                        placeholder="สะกดคำ..."
                        className={`word-input ${attempts > 0 && !isCorrect ? 'shake' : ''}`}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck="false"
                    />

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
                        <span>Hints ใช้: {hintLevel}</span>
                        <span>Attempts: {attempts}</span>
                    </div>

                    <button
                        className="speak-btn"
                        onClick={() => handlePlay(false)}
                    >
                        🔊 ฟังอีกครั้ง
                    </button>

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

        .audio-card {
          background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
          color: #1e293b;
          padding: 2rem;
          border-radius: 16px;
          text-align: center;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
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

        .hints-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .hint-item {
          font-size: 0.85rem;
          color: #64748b;
        }

        .current-hint {
          font-size: 1.1rem;
          font-weight: 600;
          color: #1e293b;
          background: #fef3c7;
          padding: 0.75rem;
          border-radius: 8px;
          text-align: center;
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

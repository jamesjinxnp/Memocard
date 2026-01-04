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

    // Shuffle options
    const options = useMemo(() => {
        const allOptions = [vocabulary, ...distractors.slice(0, 3)];
        return allOptions.sort(() => Math.random() - 0.5);
    }, [vocabulary.id, distractors]);

    useEffect(() => {
        setSelectedId(null);
        setShowResult(false);
    }, [vocabulary.id]);

    const handleSelect = (id: number) => {
        if (showResult) return;

        setSelectedId(id);
        setShowResult(true);

        if (id === vocabulary.id) {
            speakWord(vocabulary.word);
        }
    };

    const isCorrect = selectedId === vocabulary.id;

    const getOptionClass = (id: number) => {
        if (!showResult) return '';
        if (id === vocabulary.id) return 'correct';
        if (id === selectedId) return 'incorrect';
        return 'disabled';
    };

    return (
        <div className="multiple-choice-mode">
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

                    {!isCorrect && (
                        <p className="correct-answer">
                            คำตอบที่ถูก: {vocabulary.defTh}
                        </p>
                    )}

                    <div className="rating-buttons">
                        <button
                            className={`rating-btn ${isCorrect ? 'good' : 'again'}`}
                            onClick={() => onRate(isCorrect ? 3 : 1)}
                        >
                            {isCorrect ? 'Good' : 'Again'}
                        </button>
                        {isCorrect && (
                            <button
                                className="rating-btn easy"
                                onClick={() => onRate(4)}
                            >
                                Easy
                            </button>
                        )}
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
        }

        .rating-btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
          color: white;
        }

        .rating-btn:hover {
          transform: translateY(-2px);
        }

        .rating-btn.again { background: #ef4444; }
        .rating-btn.good { background: #22c55e; }
        .rating-btn.easy { background: #3b82f6; }
      `}</style>
        </div>
    );
}

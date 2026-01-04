import { useState, useEffect, useMemo } from 'react';
import { speakSentence } from '../../services/audio';

interface Vocabulary {
    id: number;
    word: string;
    defTh?: string;
    defEn?: string;
    example?: string;
}

interface ClozeModeProps {
    vocabulary: Vocabulary;
    onRate: (rating: number) => void;
}

export default function ClozeMode({ vocabulary, onRate }: ClozeModeProps) {
    const [input, setInput] = useState('');
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);

    // Create cloze sentence by replacing the word with blanks
    const { clozeSentence, blankLength } = useMemo(() => {
        if (!vocabulary.example) {
            return { clozeSentence: `Use "${vocabulary.word}" in a sentence.`, blankLength: vocabulary.word.length };
        }

        const regex = new RegExp(`\\b${vocabulary.word}\\b`, 'gi');
        const sentence = vocabulary.example.replace(regex, (match) => '_'.repeat(match.length));

        return {
            clozeSentence: sentence,
            blankLength: vocabulary.word.length
        };
    }, [vocabulary]);

    useEffect(() => {
        setInput('');
        setShowResult(false);
        setIsCorrect(false);
    }, [vocabulary.id]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const userAnswer = input.toLowerCase().trim();
        const correctAnswer = vocabulary.word.toLowerCase().trim();
        const correct = userAnswer === correctAnswer;

        setIsCorrect(correct);
        setShowResult(true);

        if (correct && vocabulary.example) {
            speakSentence(vocabulary.example);
        }
    };

    return (
        <div className="cloze-mode">
            {/* Cloze Card */}
            <div className="cloze-card">
                <h2>เติมคำในช่องว่าง</h2>

                <p className="cloze-sentence">{clozeSentence}</p>

                {vocabulary.defTh && (
                    <p className="hint">💡 {vocabulary.defTh}</p>
                )}

                <p className="word-length">({blankLength} ตัวอักษร)</p>
            </div>

            {/* Input Form */}
            {!showResult ? (
                <form onSubmit={handleSubmit} className="input-form">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="พิมพ์คำที่หายไป..."
                        className="word-input"
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        autoFocus
                    />
                    <button type="submit" className="submit-btn" disabled={!input.trim()}>
                        ตรวจคำตอบ
                    </button>
                </form>
            ) : (
                /* Result */
                <div className={`result ${isCorrect ? 'correct' : 'incorrect'}`}>
                    <div className="result-icon">{isCorrect ? '✅' : '❌'}</div>

                    <p className="correct-word">{vocabulary.word}</p>

                    {vocabulary.example && (
                        <p className="full-sentence">{vocabulary.example}</p>
                    )}

                    {!isCorrect && (
                        <p className="your-answer">
                            คำตอบของคุณ: <span className="wrong">{input}</span>
                        </p>
                    )}

                    <button
                        className="speak-btn"
                        onClick={() => vocabulary.example && speakSentence(vocabulary.example)}
                    >
                        🔊 ฟังประโยค
                    </button>

                    <div className="rating-buttons">
                        <button
                            className="rating-btn again"
                            onClick={() => onRate(1)}
                        >
                            Again
                        </button>
                        <button
                            className="rating-btn hard"
                            onClick={() => onRate(2)}
                        >
                            Hard
                        </button>
                        <button
                            className="rating-btn good"
                            onClick={() => onRate(3)}
                        >
                            Good
                        </button>
                        <button
                            className="rating-btn easy"
                            onClick={() => onRate(4)}
                        >
                            Easy
                        </button>
                    </div>
                </div>
            )}

            <style>{`
        .cloze-mode {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          padding: 2rem;
          max-width: 500px;
          margin: 0 auto;
        }

        .cloze-card {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
          padding: 2rem;
          border-radius: 16px;
          text-align: center;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }

        .cloze-card h2 {
          margin-bottom: 1.5rem;
        }

        .cloze-sentence {
          font-size: 1.25rem;
          line-height: 1.6;
          margin-bottom: 1rem;
          background: rgba(255,255,255,0.1);
          padding: 1rem;
          border-radius: 8px;
        }

        .hint {
          font-size: 0.95rem;
          opacity: 0.9;
          margin-bottom: 0.5rem;
        }

        .word-length {
          font-size: 0.85rem;
          opacity: 0.7;
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
        }

        .word-input:focus {
          outline: none;
          border-color: #4facfe;
        }

        .submit-btn {
          padding: 1rem;
          font-size: 1rem;
          font-weight: 600;
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
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

        .correct-word {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .full-sentence {
          font-size: 1rem;
          opacity: 0.9;
          font-style: italic;
          margin-bottom: 1rem;
        }

        .your-answer {
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .wrong {
          text-decoration: line-through;
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

        .rating-btn:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
        </div>
    );
}

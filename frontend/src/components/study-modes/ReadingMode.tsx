import { useState, useEffect, useRef, useMemo } from 'react';
import { speakWord } from '../../services/audio';
import { Volume2 } from 'lucide-react';
import RatingBar from './RatingBar';

interface Vocabulary {
  id: number;
  word: string;
  defTh?: string;
  defEn?: string;
  type?: string;
  ipaUs?: string;
  example?: string;
  imageUrl?: string;
}

interface ReadingModeProps {
  vocabulary: Vocabulary;
  onRate: (rating: number) => void;
  showSchedule?: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
}

function formatIPA(ipa: string | undefined): string {
  if (!ipa) return '';
  return ipa.replace(/^\/+|\/+$/g, '').trim();
}

type SlideState = 'center' | 'exit-left' | 'enter-right';

export default function ReadingMode({ vocabulary, onRate, showSchedule }: ReadingModeProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [slideState, setSlideState] = useState<SlideState>('center');
  const [showEnglish, setShowEnglish] = useState(false);

  const [cardKey, setCardKey] = useState(0);
  const [displayVocab, setDisplayVocab] = useState<Vocabulary>(vocabulary);
  const isTransitioning = useRef(false);

  const latestVocabRef = useRef<Vocabulary>(vocabulary);
  useEffect(() => {
    latestVocabRef.current = vocabulary;
  }, [vocabulary]);

  useEffect(() => {
    if (isTransitioning.current) return;
    setDisplayVocab(vocabulary);
  }, [vocabulary]);

  const handleSpeak = async () => {
    setIsPlaying(true);
    try {
      await speakWord(displayVocab.word);
    } finally {
      setIsPlaying(false);
    }
  };

  const handleFlip = () => {
    if (slideState !== 'center') return;
    setIsFlipped(!isFlipped);
    if (!isFlipped) {
      handleSpeak();
    }
  };

  const handleRate = (rating: number) => {
    isTransitioning.current = true;
    setIsFlipped(false);
    setSlideState('exit-left');
    setShowEnglish(false);
    onRate(rating);

    setTimeout(() => {
      setDisplayVocab(latestVocabRef.current);
      setCardKey(k => k + 1);
      setSlideState('enter-right');
      setTimeout(() => {
        setSlideState('center');
        isTransitioning.current = false;
      }, 50);
    }, 350);
  };

  const ipa = useMemo(() => formatIPA(displayVocab.ipaUs), [displayVocab.ipaUs]);

  const getCardStyle = () => {
    let slideTransform = '';
    let opacity = 1;

    switch (slideState) {
      case 'exit-left':
        slideTransform = 'translateX(-100%)';
        opacity = 0;
        break;
      case 'enter-right':
        slideTransform = 'translateX(100%)';
        opacity = 0;
        break;
      default:
        slideTransform = 'translateX(0)';
        opacity = 1;
    }

    return {
      transform: slideTransform,
      opacity,
      transition: 'transform 0.35s ease-out, opacity 0.35s ease-out',
    };
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto overflow-hidden px-2">
      {/* Flashcard Wrapper */}
      <div
        className="w-full aspect-[3/2] cursor-pointer"
        style={getCardStyle()}
        onClick={handleFlip}
      >
        <div
          className="relative w-full h-full"
          style={{ perspective: '1000px' }}
        >
          <div
            key={cardKey}
            className="relative w-full h-full transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front — Glassmorphism with purple accent */}
            <div
              className="absolute inset-0 rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center text-white
                bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl
                border border-purple-500/20
                shadow-[0_0_40px_rgba(147,51,234,0.15)]"
              style={{ backfaceVisibility: 'hidden' }}
            >
              {/* Gradient accent strip */}
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r from-purple-600 to-violet-700" />

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-display mb-2 text-center text-[var(--color-text-primary)]">
                {displayVocab.word}
              </h1>

              {ipa && (
                <p className="text-sm md:text-base opacity-60 font-serif mb-3 text-[var(--color-text-secondary)]">
                  /{ipa}/
                </p>
              )}

              <button
                className="p-3 rounded-2xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/20
                  transition-all duration-200 active:scale-95 mb-3"
                onClick={(e) => { e.stopPropagation(); handleSpeak(); }}
                disabled={isPlaying}
              >
                <Volume2 className={`size-5 text-purple-400 ${isPlaying ? 'animate-pulse' : ''}`} />
              </button>

              {displayVocab.imageUrl && (
                <img
                  src={displayVocab.imageUrl}
                  alt={displayVocab.word}
                  className="max-w-24 md:max-w-32 max-h-20 md:max-h-24 rounded-xl mb-3 object-cover border border-white/10"
                />
              )}

              {displayVocab.example && (
                <p className="text-center text-xs md:text-sm italic opacity-60 px-2 text-[var(--color-text-secondary)]">
                  <span className="font-semibold not-italic">Example: </span>
                  {displayVocab.example}
                </p>
              )}

              <p className="absolute bottom-3 text-xs md:text-sm opacity-40 text-[var(--color-text-muted)]">
                ✧ แตะเพื่อดูคำตอบ ✧
              </p>
            </div>

            {/* Back — Glassmorphism with emerald accent */}
            <div
              className="absolute inset-0 rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center text-white
                bg-[var(--color-bg-surface)]/60 backdrop-blur-2xl
                border border-emerald-500/20
                shadow-[0_0_40px_rgba(16,185,129,0.15)]
                overflow-y-auto"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              {/* Gradient accent strip */}
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r from-emerald-500 to-teal-600" />

              <h2 className="text-xl md:text-2xl font-bold font-display mb-2 text-[var(--color-text-primary)]">
                {displayVocab.word}
              </h2>

              {/* Thai Translation — Main Focus */}
              {displayVocab.defTh && (
                <p className="text-center text-2xl md:text-3xl font-bold mb-3 bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {displayVocab.defTh}
                </p>
              )}

              {/* English Definition — Hidden by default */}
              {displayVocab.defEn && (
                <div className="w-full text-center mb-3">
                  {showEnglish ? (
                    <p className="text-center text-sm md:text-base opacity-70 text-[var(--color-text-secondary)]">
                      {displayVocab.defEn}
                    </p>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowEnglish(true); }}
                      className="text-xs text-emerald-400/60 hover:text-emerald-400/90 transition-colors underline underline-offset-2"
                    >
                      Show English Meaning
                    </button>
                  )}
                </div>
              )}

              {/* IPA Pronunciation */}
              {ipa && (
                <p className="text-base md:text-lg opacity-60 font-serif mb-2 text-[var(--color-text-secondary)]">
                  /{ipa}/
                </p>
              )}

              {/* Part of Speech Badge */}
              {displayVocab.type && (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-sm font-medium text-emerald-400">
                  {displayVocab.type}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rating Buttons — Shared Component */}
      {isFlipped && slideState === 'center' && (
        <RatingBar onRate={handleRate} showSchedule={showSchedule} />
      )}
    </div>
  );
}

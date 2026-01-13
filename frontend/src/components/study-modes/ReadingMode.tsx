import { useState, useEffect, useRef, useMemo } from 'react';
import { speakWord } from '../../services/audio';
import { Button } from '@/components/ui/button';
import { Volume2 } from 'lucide-react';

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

  // Use a key to force complete re-render of card content
  const [cardKey, setCardKey] = useState(0);
  const [displayVocab, setDisplayVocab] = useState<Vocabulary>(vocabulary);
  const isTransitioning = useRef(false);

  // Ref to always have access to the latest vocabulary prop
  const latestVocabRef = useRef<Vocabulary>(vocabulary);
  useEffect(() => {
    latestVocabRef.current = vocabulary;
  }, [vocabulary]);

  // Store pending vocabulary during transition
  useEffect(() => {
    if (isTransitioning.current) {
      // We're in a transition, the new vocab will be picked up after animation
      return;
    }
    // Not transitioning, update immediately
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

    // 1. Flip กลับ + slide exit left พร้อมกัน
    setIsFlipped(false);
    setSlideState('exit-left');
    setShowEnglish(false); // Reset for next card
    onRate(rating); // This will trigger vocabulary prop change

    // 2. หลัง exit animation เสร็จ -> โหลดการ์ดใหม่ที่ตำแหน่งขวา
    setTimeout(() => {
      // Use the ref to get the LATEST vocabulary (updated by parent's onRate)
      setDisplayVocab(latestVocabRef.current);
      setCardKey(k => k + 1); // Force re-render
      setSlideState('enter-right');

      // 3. เลื่อนการ์ดใหม่จากขวาเข้ามาตรงกลาง (รอสักครู่ให้ position ที่ขวา render ก่อน)
      setTimeout(() => {
        setSlideState('center');
        isTransitioning.current = false;
      }, 50); // เพิ่ม delay เล็กน้อยให้เห็น position ขวา
    }, 350);
  };

  // Calculate IPA from displayVocab using useMemo
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
      {/* Flashcard Wrapper - More mobile-friendly aspect ratio */}
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
            {/* Front - Word + Audio + Image + Example */}
            <div
              className="absolute inset-0 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center text-white bg-gradient-to-br from-violet-600 to-purple-700 shadow-xl"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 text-center">
                {displayVocab.word}
              </h1>

              <button
                className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors active:scale-95 mb-3"
                onClick={(e) => { e.stopPropagation(); handleSpeak(); }}
                disabled={isPlaying}
              >
                <Volume2 className={`size-6 ${isPlaying ? 'animate-pulse' : ''}`} />
              </button>

              {displayVocab.imageUrl && (
                <img
                  src={displayVocab.imageUrl}
                  alt={displayVocab.word}
                  className="max-w-24 md:max-w-32 max-h-20 md:max-h-24 rounded-lg mb-3 object-cover"
                />
              )}

              {displayVocab.example && (
                <p className="text-center text-xs md:text-sm italic opacity-85 px-2">
                  <span className="font-semibold not-italic">Example: </span>
                  {displayVocab.example}
                </p>
              )}

              {/* Only show hint when not flipped */}
              <p className="absolute bottom-3 text-xs md:text-sm opacity-70">แตะเพื่อดูคำตอบ</p>
            </div>

            {/* Back - Word + Thai + English toggle + IPA + Part of Speech */}
            <div
              className="absolute inset-0 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center text-white bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl overflow-y-auto"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <h2 className="text-xl md:text-2xl font-bold mb-2">{displayVocab.word}</h2>

              {/* Thai Translation - Main Focus */}
              {displayVocab.defTh && (
                <p className="text-center text-2xl md:text-3xl font-bold text-white mb-3">
                  {displayVocab.defTh}
                </p>
              )}

              {/* English Definition - Hidden by default with toggle */}
              {displayVocab.defEn && (
                <div className="w-full text-center mb-3">
                  {showEnglish ? (
                    <p className="text-center text-sm md:text-base opacity-90">
                      {displayVocab.defEn}
                    </p>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowEnglish(true); }}
                      className="text-xs text-white/60 hover:text-white/90 transition-colors underline underline-offset-2"
                    >
                      Show English Meaning
                    </button>
                  )}
                </div>
              )}

              {/* IPA Pronunciation */}
              {ipa && (
                <p className="text-base md:text-lg opacity-90 font-serif mb-2">/{ipa}/</p>
              )}

              {/* Part of Speech Badge */}
              {displayVocab.type && (
                <span className="px-3 py-1 rounded-full bg-white/20 text-sm font-medium">
                  {displayVocab.type}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rating Buttons - Touch-friendly sizes */}
      {isFlipped && slideState === 'center' && (
        <div className="flex flex-wrap gap-3 md:gap-4 justify-center w-full">
          <Button
            variant="destructive"
            onClick={() => handleRate(1)}
            className="flex flex-col min-h-12 min-w-[72px] h-auto py-3 px-5 bg-red-500 hover:bg-red-600 active:scale-95 transition-transform text-base"
          >
            <span className="font-semibold">Again</span>
            {showSchedule && <span className="text-xs opacity-80">{showSchedule.again}d</span>}
          </Button>

          <Button
            onClick={() => handleRate(2)}
            className="flex flex-col min-h-12 min-w-[72px] h-auto py-3 px-5 bg-orange-500 hover:bg-orange-600 active:scale-95 transition-transform text-base"
          >
            <span className="font-semibold">Hard</span>
            {showSchedule && <span className="text-xs opacity-80">{showSchedule.hard}d</span>}
          </Button>

          <Button
            onClick={() => handleRate(3)}
            className="flex flex-col min-h-12 min-w-[72px] h-auto py-3 px-5 bg-green-500 hover:bg-green-600 active:scale-95 transition-transform text-base"
          >
            <span className="font-semibold">Good</span>
            {showSchedule && <span className="text-xs opacity-80">{showSchedule.good}d</span>}
          </Button>

          <Button
            onClick={() => handleRate(4)}
            className="flex flex-col min-h-12 min-w-[72px] h-auto py-3 px-5 bg-blue-500 hover:bg-blue-600 active:scale-95 transition-transform text-base"
          >
            <span className="font-semibold">Easy</span>
            {showSchedule && <span className="text-xs opacity-80">{showSchedule.easy}d</span>}
          </Button>
        </div>
      )}
    </div>
  );
}

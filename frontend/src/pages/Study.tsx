import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { studyApi, vocabularyApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, PartyPopper, Loader2 } from 'lucide-react';
import {
    ReadingMode,
    TypingMode,
    ListeningMode,
    MultipleChoiceMode,
    ClozeMode,
    SpellingBeeMode,
    AudioChoiceMode,
} from '@/components/study-modes';

// ==================== Types ====================
type StudyModeType = 'reading' | 'typing' | 'listening' | 'multiple_choice' | 'cloze' | 'spelling' | 'audio_choice';

// Hard modes = Active production (more difficult)
const HARD_MODES: StudyModeType[] = ['spelling', 'typing', 'listening'];

// Mode pools for selection
const ALL_MODES: StudyModeType[] = ['typing', 'listening', 'multiple_choice', 'cloze', 'spelling', 'audio_choice'];

const MODE_NAMES: Record<string, string> = {
    reading: 'Reading',
    typing: 'Typing',
    listening: 'Listening',
    multiple_choice: 'Multiple Choice',
    cloze: 'Cloze',
    spelling: 'Spelling',
    audio_choice: 'Audio Choice',
    multi: 'Multi-Mode',
};

// Card state for interleaving
interface CardStudyState {
    cardId: string;
    vocabulary: any;
    originalState: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
    modeQueue: StudyModeType[];
    currentModeIndex: number;
    retryQueue: StudyModeType[];
    modeAttempts: Map<StudyModeType, number>;
    usedHint: boolean;
    isComplete: boolean;
}

// ==================== Helpers ====================
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Get modes based on card state
function getModesForCardState(state: number): StudyModeType[] {
    switch (state) {
        case 0: // New - Reading + 3 Active modes (4 total as per Complete Flow)
            return ['reading', ...shuffleArray(['multiple_choice', 'audio_choice', 'cloze', 'typing'] as StudyModeType[]).slice(0, 3)];
        case 1: // Learning - 2-3 Medium modes
            return shuffleArray(['cloze', 'audio_choice', 'multiple_choice', 'spelling'] as StudyModeType[]).slice(0, 3);
        case 2: // Review - 2 Hard modes
            return shuffleArray(['spelling', 'typing', 'listening'] as StudyModeType[]).slice(0, 2);
        case 3: // Relearning - Reading + 2 Medium
            return ['reading', ...shuffleArray(['cloze', 'audio_choice', 'multiple_choice'] as StudyModeType[]).slice(0, 2)];
        default:
            return ['reading', ...shuffleArray(ALL_MODES).slice(0, 3)];
    }
}

// Adaptive Mode Selection: Get next mode pool based on previous rating
function getNextModePool(previousRating: number): StudyModeType[] {
    switch (previousRating) {
        case 4: // Easy → ท้าทายขึ้น
            return ['spelling', 'typing', 'listening'];
        case 3: // Good → ท้าทายเล็กน้อย
            return ['cloze', 'audio_choice', 'spelling', 'typing'];
        case 2: // Hard → ฝึกเพิ่ม
            return ['multiple_choice', 'audio_choice', 'cloze'];
        case 1: // Again → กลับมาดูใหม่
            return ['reading', 'multiple_choice'];
        default:
            return ['cloze', 'audio_choice'];
    }
}

// Penalty Logic: Calculate final rating based on mode results
function calculateFinalRating(cardState: CardStudyState): number {
    const totalFails = Array.from(cardState.modeAttempts.values()).reduce((sum, attempts) => sum + Math.max(0, attempts - 1), 0);
    const hardModeFails = Array.from(cardState.modeAttempts.entries())
        .filter(([mode]) => HARD_MODES.includes(mode))
        .reduce((sum, [, attempts]) => sum + Math.max(0, attempts - 1), 0);

    // Perfect: All correct first try + no hint
    if (totalFails === 0 && !cardState.usedHint) return 4; // Easy

    // Minor: 1 fail or used hint
    if (totalFails <= 1) return 3; // Good

    // Struggle in Hard Mode: 3+ fails in hard modes
    if (hardModeFails >= 3) return 1; // Again

    // Multiple fails
    return 2; // Hard
}

// ==================== Component ====================
export default function Study() {
    const { mode } = useParams<{ mode: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const deckId = searchParams.get('deck');
    const isMultiMode = mode === 'multi';

    // Session state
    const [cardStates, setCardStates] = useState<CardStudyState[]>([]);
    const [currentCardIdx, setCurrentCardIdx] = useState(0);
    const [currentRound, setCurrentRound] = useState(0); // Global round tracking for mode consistency
    const [distractors, setDistractors] = useState<any[]>([]);
    const [sessionComplete, setSessionComplete] = useState(false);
    const [completedCount, setCompletedCount] = useState(0);

    // Single mode state (legacy)
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [completed, setCompleted] = useState(false);

    // Get daily limit from localStorage - read fresh on mount
    const getDailyLimit = () => {
        const settings = localStorage.getItem(`deck-settings-${deckId}`);
        return settings ? JSON.parse(settings).dailyNewCards || 20 : 20;
    };
    const dailyLimit = getDailyLimit();

    // Fetch cards for multi-mode using Tree Model queue
    const { data: multiModeData, isLoading: multiLoading } = useQuery({
        queryKey: ['multi-study-queue', deckId, dailyLimit],
        queryFn: async () => {
            let queueResponse = await studyApi.getQueue(deckId || undefined, dailyLimit);
            let queue = queueResponse.data;

            if (queue.needMoreSeeds && deckId) {
                await studyApi.learnDeck(deckId, dailyLimit);
                queueResponse = await studyApi.getQueue(deckId, dailyLimit);
                queue = queueResponse.data;
            }

            // Combine cards with their states in priority order:
            // Relearning (3) → Learning (1) → Review (2) → New (0)
            const allCards = [
                ...(queue.relearning || []).map((c: any) => ({ ...c, originalState: 3 })),
                ...queue.learning.map((c: any) => ({ ...c, originalState: 1 })),
                ...queue.due.map((c: any) => ({ ...c, originalState: 2 })),
                ...queue.new.map((c: any) => ({ ...c, originalState: 0 })),
            ];

            return {
                cards: allCards,
                counts: queue.counts,
                quota: queue.quota,
            };
        },
        enabled: isMultiMode && !!deckId,
    });

    // Initialize card states when data loads
    useEffect(() => {
        if (isMultiMode && multiModeData?.cards?.length > 0 && cardStates.length === 0) {
            const initialStates: CardStudyState[] = multiModeData.cards.map((card: any) => ({
                cardId: card.id,
                vocabulary: card.vocabulary,
                originalState: card.originalState || 0,
                modeQueue: getModesForCardState(card.originalState || 0),
                currentModeIndex: 0,
                retryQueue: [],
                modeAttempts: new Map(),
                usedHint: false,
                isComplete: false,
            }));
            setCardStates(initialStates);
            setCurrentCardIdx(0);
        }
    }, [isMultiMode, multiModeData, cardStates.length]);

    // Fetch session for single mode (legacy)
    const { data: sessionData, isLoading: singleLoading } = useQuery({
        queryKey: ['study-session', mode],
        queryFn: async () => {
            const response = await studyApi.startSession(mode!, 20);
            setSessionId(response.data.sessionId);
            return response.data;
        },
        enabled: !isMultiMode && !!mode,
    });


    // Current card state helper - uses direct index on full array
    const getCurrentCardState = useCallback(() => {
        if (!isMultiMode || cardStates.length === 0) return null;
        const card = cardStates[currentCardIdx];
        if (!card || card.isComplete) return null;
        return card;
    }, [isMultiMode, cardStates, currentCardIdx]);

    // Get current mode for current card - respects round-based consistency
    const getCurrentMode = useCallback((): StudyModeType | null => {
        const cardState = getCurrentCardState();
        if (!cardState) return null;

        // If card has retry queue and already past the current round, process retry first
        if (cardState.retryQueue.length > 0 && cardState.currentModeIndex > currentRound) {
            return cardState.retryQueue[0];
        }

        // If card still needs to do current round's mode
        if (cardState.currentModeIndex <= currentRound && cardState.currentModeIndex < cardState.modeQueue.length) {
            return cardState.modeQueue[cardState.currentModeIndex];
        }

        // If card finished all queue modes but has retry
        if (cardState.currentModeIndex >= cardState.modeQueue.length && cardState.retryQueue.length > 0) {
            return cardState.retryQueue[0];
        }

        return null;
    }, [getCurrentCardState, currentRound]);

    // Session completion check - uses useEffect to react to state changes properly
    useEffect(() => {
        if (isMultiMode && cardStates.length > 0 && cardStates.every(c => c.isComplete)) {
            setSessionComplete(true);
        }
    }, [isMultiMode, cardStates]);

    // Fetch distractors for choice modes
    useEffect(() => {
        const fetchDistractors = async () => {
            const currentMode = isMultiMode ? getCurrentMode() : mode;
            const cardState = getCurrentCardState();

            if ((currentMode === 'multiple_choice' || currentMode === 'audio_choice') && cardState) {
                const response = await vocabularyApi.getRandom(3, undefined, [cardState.vocabulary.id]);
                setDistractors(shuffleArray([...response.data.items || []]));
            }
        };
        fetchDistractors();
    }, [isMultiMode, getCurrentMode, getCurrentCardState, mode, currentCardIdx]);

    // Submit review mutation
    const reviewMutation = useMutation({
        mutationFn: async ({ cardId, rating }: { cardId: string; rating: number }) => {
            return studyApi.submitReview({
                cardId,
                rating,
                studyMode: isMultiMode ? 'multi' : mode!,
            });
        },
    });

    // Handle mode result (pass/fail)
    const handleRate = (rating: number) => {
        if (!isMultiMode) {
            // Single mode: submit directly
            const currentCard = sessionData?.cards[currentCardIndex];
            if (currentCard) {
                reviewMutation.mutate({ cardId: currentCard.id, rating });
                if (currentCardIndex < sessionData.cards.length - 1) {
                    setCurrentCardIndex(prev => prev + 1);
                } else {
                    setCompleted(true);
                    if (sessionId) studyApi.completeSession(sessionId);
                }
            }
            return;
        }

        // Multi-mode: Card Interleaving + Penalty Logic
        const passed = rating >= 3;
        const currentMode = getCurrentMode();
        if (!currentMode) return;

        // Helper to find next incomplete card in the given states array
        const findNext = (fromIdx: number, states: CardStudyState[]): number => {
            const len = states.length;
            if (len === 0) return -1;
            for (let i = 1; i <= len; i++) {
                const idx = (fromIdx + i) % len;
                if (!states[idx].isComplete) {
                    return idx;
                }
            }
            return -1;
        };

        // Use flushSync or compute synchronously
        let computedNextIdx = currentCardIdx;
        let computedShouldAdvanceRound = false;

        const newStates = cardStates.map(c => ({ ...c, modeAttempts: new Map(c.modeAttempts), retryQueue: [...c.retryQueue] }));
        const cardState = newStates[currentCardIdx];

        if (cardState && !cardState.isComplete) {
            if (passed) {
                // Remove from retry queue if present
                cardState.retryQueue = cardState.retryQueue.filter(m => m !== currentMode);

                // Record attempt (1 = correct first try)
                if (!cardState.modeAttempts.has(currentMode)) {
                    cardState.modeAttempts.set(currentMode, 1);
                }

                // Move to next mode or check completion
                if (cardState.retryQueue.length === 0) {
                    if (cardState.currentModeIndex >= cardState.modeQueue.length - 1) {
                        // All modes done, card complete
                        cardState.isComplete = true;
                        const finalRating = calculateFinalRating(cardState);
                        reviewMutation.mutate({ cardId: cardState.cardId, rating: finalRating });
                        setCompletedCount(c => c + 1);
                    } else {
                        cardState.currentModeIndex++;
                    }
                }
            } else {
                // Failed - add to retry queue
                if (!cardState.retryQueue.includes(currentMode)) {
                    cardState.retryQueue.push(currentMode);
                }
                // Increment attempts
                cardState.modeAttempts.set(currentMode, (cardState.modeAttempts.get(currentMode) || 0) + 1);
            }

            // Check if all cards have passed current round - advance global round
            const allPassedCurrentRound = newStates.every(
                c => c.isComplete || c.currentModeIndex > currentRound
            );
            if (allPassedCurrentRound) {
                computedShouldAdvanceRound = true;
            }

            // Compute next card index using the UPDATED states
            computedNextIdx = findNext(currentCardIdx, newStates);
            if (computedNextIdx < 0) computedNextIdx = currentCardIdx;
        }

        // Apply all state updates together
        setCardStates(newStates);
        if (computedShouldAdvanceRound) {
            setCurrentRound(r => r + 1);
        }
        setCurrentCardIdx(computedNextIdx);
    };

    // Loading state
    const isLoading = isMultiMode ? multiLoading : singleLoading;
    if (isLoading) {
        return (
            <div className="min-h-screen min-h-dvh w-full flex items-center justify-center bg-slate-900">
                <Loader2 className="size-8 text-primary animate-spin" />
            </div>
        );
    }

    // No cards
    const hasCards = isMultiMode ? cardStates.length > 0 : sessionData?.cards?.length > 0;
    if (!hasCards) {
        return (
            <div className="min-h-screen min-h-dvh w-full flex flex-col items-center justify-center gap-4 p-6 bg-slate-900 text-center">
                <PartyPopper className="size-16 text-amber-400" />
                <h2 className="text-2xl font-bold text-slate-100">No cards due!</h2>
                <p className="text-slate-400">Great job! You've reviewed all your cards for now.</p>
                <Button size="lg" onClick={() => navigate('/')}>
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    // Session complete
    if (sessionComplete || completed) {
        const totalCards = isMultiMode ? cardStates.length : sessionData?.cards?.length || 0;
        return (
            <div className="min-h-screen min-h-dvh w-full flex items-center justify-center p-6 bg-slate-900">
                <Card className="max-w-md w-full text-center">
                    <CardContent className="p-8 space-y-4">
                        <PartyPopper className="size-16 text-amber-400 mx-auto" />
                        <h2 className="text-2xl font-bold text-slate-100">Session Complete!</h2>
                        <p className="text-slate-400">You reviewed {totalCards} cards</p>
                        <div className="flex gap-3 justify-center pt-4">
                            <Button onClick={() => window.location.reload()}>
                                Study More
                            </Button>
                            <Button variant="outline" onClick={() => navigate('/')}>
                                Back to Dashboard
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Get current card and mode
    const currentCardState = getCurrentCardState();
    const currentMode = isMultiMode ? getCurrentMode() : (mode as StudyModeType);
    const vocabulary = isMultiMode ? currentCardState?.vocabulary : sessionData?.cards[currentCardIndex]?.vocabulary;

    if (!vocabulary || !currentMode) {
        return (
            <div className="min-h-screen min-h-dvh w-full flex items-center justify-center bg-slate-900">
                <Loader2 className="size-8 text-primary animate-spin" />
            </div>
        );
    }

    // Progress calculation
    const totalCards = isMultiMode ? cardStates.length : sessionData?.cards?.length || 0;
    const incompleteCount = isMultiMode ? cardStates.filter(c => !c.isComplete).length : totalCards - currentCardIndex;
    const progressPercent = ((totalCards - incompleteCount) / totalCards) * 100;

    // Check if in retry mode
    const isRetrying = currentCardState && currentCardState.retryQueue.includes(currentMode);

    const renderMode = () => {
        switch (currentMode) {
            case 'reading':
                return <ReadingMode vocabulary={vocabulary} onRate={handleRate} />;
            case 'typing':
                return <TypingMode vocabulary={vocabulary} onRate={handleRate} />;
            case 'listening':
                return <ListeningMode vocabulary={vocabulary} onRate={handleRate} />;
            case 'multiple_choice':
                return <MultipleChoiceMode vocabulary={vocabulary} distractors={distractors} onRate={handleRate} />;
            case 'cloze':
                return <ClozeMode vocabulary={vocabulary} onRate={handleRate} />;
            case 'spelling':
                return <SpellingBeeMode vocabulary={vocabulary} onRate={handleRate} />;
            case 'audio_choice':
                return <AudioChoiceMode vocabulary={vocabulary} distractors={distractors} onRate={handleRate} />;
            default:
                return <ReadingMode vocabulary={vocabulary} onRate={handleRate} />;
        }
    };

    return (
        <div className="min-h-screen min-h-dvh w-full flex flex-col bg-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur">
                <div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate(deckId ? `/deck/${deckId}` : '/')}>
                        <ArrowLeft className="size-4" />
                        Back
                    </Button>
                    <div className="text-center">
                        <h1 className="font-semibold text-slate-100">
                            {MODE_NAMES[currentMode] || 'Study'}
                            {isRetrying && <span className="text-amber-400 ml-2">(Retry)</span>}
                        </h1>
                        {isMultiMode && currentCardState && (
                            <div className="text-xs text-slate-400">
                                Mode {currentCardState.currentModeIndex + 1}/{currentCardState.modeQueue.length}
                                {currentCardState.retryQueue.length > 0 && ` + ${currentCardState.retryQueue.length} retry`}
                            </div>
                        )}
                    </div>
                    <span className="text-sm text-slate-400">
                        {completedCount} / {totalCards}
                    </span>
                </div>
            </header>

            {/* State-based Progress Bar */}
            {isMultiMode && multiModeData?.counts && (
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/90 border-b border-slate-700 text-sm">
                    {/* Relearning */}
                    {(multiModeData.counts.relearning || 0) > 0 && (
                        <div className="flex items-center gap-2 bg-red-500/20 px-3 py-1 rounded-full">
                            <span className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-red-300 font-medium">
                                Relearn: {cardStates.filter(c => c.originalState === 3 && c.isComplete).length}/{multiModeData.counts.relearning}
                            </span>
                        </div>
                    )}
                    {/* Learning */}
                    {multiModeData.counts.learning > 0 && (
                        <div className="flex items-center gap-2 bg-orange-500/20 px-3 py-1 rounded-full">
                            <span className="w-3 h-3 rounded-full bg-orange-500" />
                            <span className="text-orange-300 font-medium">
                                Learn: {cardStates.filter(c => c.originalState === 1 && c.isComplete).length}/{multiModeData.counts.learning}
                            </span>
                        </div>
                    )}
                    {/* Review/Due */}
                    {multiModeData.counts.due > 0 && (
                        <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1 rounded-full">
                            <span className="w-3 h-3 rounded-full bg-yellow-500" />
                            <span className="text-yellow-300 font-medium">
                                Review: {cardStates.filter(c => c.originalState === 2 && c.isComplete).length}/{multiModeData.counts.due}
                            </span>
                        </div>
                    )}
                    {/* New */}
                    {multiModeData.counts.new > 0 && (
                        <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-full">
                            <span className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-green-300 font-medium">
                                New: {cardStates.filter(c => c.originalState === 0 && c.isComplete).length}/{multiModeData.counts.new}
                            </span>
                        </div>
                    )}
                    {/* Total progress */}
                    <div className="ml-auto bg-slate-700/50 px-3 py-1 rounded-full">
                        <span className="text-slate-300 font-medium">Total: {completedCount}/{totalCards}</span>
                    </div>
                </div>
            )}

            {/* Simple Progress Bar */}
            <div className="h-1 bg-slate-800">
                <div
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Mode indicators for multi-mode */}
            {isMultiMode && currentCardState && (
                <div className="flex justify-center gap-2 py-3 bg-slate-800/50">
                    {currentCardState.modeQueue.map((m, i) => {
                        const isCompleted = i < currentCardState.currentModeIndex;
                        const isCurrent = i === currentCardState.currentModeIndex && currentCardState.retryQueue.length === 0;
                        const isRetryMode = currentCardState.retryQueue.includes(m);

                        return (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition-all ${isCompleted ? 'bg-green-500' :
                                    isCurrent ? 'bg-primary scale-125' :
                                        isRetryMode ? 'bg-amber-500' :
                                            'bg-slate-600'
                                    }`}
                                title={MODE_NAMES[m]}
                            />
                        );
                    })}
                    {/* Retry queue indicators */}
                    {currentCardState.retryQueue.length > 0 && (
                        <>
                            <div className="w-px h-2 bg-slate-500" />
                            {currentCardState.retryQueue.map((m, i) => (
                                <div
                                    key={`retry-${i}`}
                                    className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-amber-400 scale-125' : 'bg-amber-600'}`}
                                    title={`Retry: ${MODE_NAMES[m]}`}
                                />
                            ))}
                        </>
                    )}
                </div>
            )}



            {/* Study Mode Content */}
            <main className="flex-1 flex items-center justify-center p-4 md:p-6">
                {renderMode()}
            </main>
        </div>
    );
}

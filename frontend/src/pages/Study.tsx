import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { studyApi, learningPathApi } from '@/services/api';
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
    ModeProgressRail,
    getModeAccent,
    getModeIcon,
} from '@/components/study-modes';
import { useMultiModeSession, useStudyReview, useDistractors } from '@/hooks/study';
import type { StudyModeType } from '@/types/schema';

// ==================== Constants ====================

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

// ==================== Component ====================

export default function Study() {
    const { mode, nodeId } = useParams<{ mode?: string; nodeId?: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const deckId = searchParams.get('deck');

    // Determine study context: node mode or deck review mode
    const isNodeMode = !!nodeId;
    const isPathContext = searchParams.get('context') === 'path' || isNodeMode;
    const isMultiMode = isNodeMode || mode === 'multi';

    // ==================== Daily Limit ====================
    const getDailyLimit = () => {
        const settings = localStorage.getItem(`deck-settings-${deckId}`);
        return settings ? JSON.parse(settings).dailyNewCards || 20 : 20;
    };
    const dailyLimit = getDailyLimit();

    // ==================== Multi-Mode Session Hook ====================
    // Node mode: uses sourceType 'node' with nodeId
    // Deck review: uses sourceType 'review' with deckId
    const multiModeSession = useMultiModeSession({
        sourceType: isNodeMode ? 'node' : 'review',
        sourceId: isNodeMode ? nodeId! : (deckId ?? ''),
        dailyLimit,
        enabled: isMultiMode,
        isPathContext, // Force Reading First if from Path
        reviewOnly: isPathContext && !isNodeMode, // Review Time! from path = review-only, no new cards
    });
    const {
        cardStates,
        currentCardIdx,
        currentRound,
        isLoading: multiLoading,
        sessionComplete,
        completedCount,
        multiModeData,
        nodeSessionData,
        getCurrentCardState,
        getCurrentMode,
        getTotalRetries,
        setCardStates,
        setCurrentCardIdx,
        setCurrentRound,
        setCompletedCount,
        totalCards: multiTotalCards,
        progressPercent: multiProgressPercent,
        isRetrying,
    } = multiModeSession;

    // ==================== Single Mode State (Legacy) ====================
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [completed, setCompleted] = useState(false);

    // Single mode data fetch
    const { data: sessionData, isLoading: singleLoading } = useQuery({
        queryKey: ['study-session', mode],
        queryFn: async () => {
            const response = await studyApi.startSession(mode!, 20);
            setSessionId(response.data.sessionId);
            return response.data;
        },
        enabled: !isMultiMode && !!mode,
    });

    // ==================== Node Completion State ====================
    const startTimeRef = useRef(Date.now());
    const hasTriggeredCompletion = useRef(false); // Prevent infinite loop
    const [nodeCompletionData, setNodeCompletionData] = useState<{
        stars: number;
        crowns: number;
        xpEarned: number;
        nextNodeId?: number;
    } | null>(null);

    // Calculate correct count from card states
    const correctCount = cardStates.filter(c => {
        const attempts = Array.from(c.modeAttempts.values());
        const totalFails = attempts.reduce((sum, a) => sum + Math.max(0, a - 1), 0);
        return totalFails === 0;
    }).length;

    // ==================== Complete Node Mutation ====================
    const completeNodeMutation = useMutation({
        mutationFn: async () => {
            if (!nodeId) return null;
            const duration = Date.now() - startTimeRef.current;

            // Build results array from cardStates for proper FSRS logging
            const results = cardStates.map(card => {
                const attempts = Array.from(card.modeAttempts.values());
                const totalFails = attempts.reduce((sum, a) => sum + Math.max(0, a - 1), 0);
                let rating = 4; // Easy
                if (totalFails >= 3) rating = 1; // Again
                else if (totalFails >= 1) rating = totalFails === 1 ? 3 : 2;

                return {
                    vocabId: card.vocabulary.id,
                    rating,
                };
            });

            const response = await learningPathApi.completeNode(parseInt(nodeId), {
                cardsReviewed: cardStates.length,
                correctCount: correctCount,
                responseTime: duration,
                results,
            });
            return response.data;
        },
        onSuccess: (data) => {
            if (data) setNodeCompletionData(data);
        },
        onError: (err) => {
            console.error("Failed to complete node:", err);
        }
    });

    // ==================== Trigger Node Completion ====================
    useEffect(() => {
        if (isNodeMode && sessionComplete && !hasTriggeredCompletion.current) {
            hasTriggeredCompletion.current = true;
            completeNodeMutation.mutate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isNodeMode, sessionComplete]);

    // ==================== Study Review Hook ====================
    const { handleRate } = useStudyReview({
        isMultiMode,
        isNodeMode,
        cardStates,
        currentCardIdx,
        currentRound,
        getCurrentMode,
        setCardStates,
        setCurrentCardIdx,
        setCurrentRound,
        setCompletedCount,
        sessionData,
        sessionId,
        currentCardIndex,
        setCurrentCardIndex,
        setCompleted,
        mode,
    });

    // ==================== Current Card/Mode ====================
    const currentCardState = getCurrentCardState();
    const currentMode = isMultiMode ? getCurrentMode() : (mode as StudyModeType);
    const vocabulary = isMultiMode
        ? currentCardState?.vocabulary
        : sessionData?.cards[currentCardIndex]?.vocabulary;

    // ==================== Distractors Hook ====================
    const { distractors } = useDistractors({
        currentMode,
        currentVocabularyId: vocabulary?.id,
        enabled: isMultiMode && !!vocabulary,
    });

    // ==================== Loading State ====================
    const isLoading = isMultiMode ? multiLoading : singleLoading;
    if (isLoading) {
        return (
            <div className="min-h-screen min-h-dvh w-full flex items-center justify-center bg-deep">
                <Loader2 className="size-8 text-primary animate-spin" />
            </div>
        );
    }

    // ==================== No Cards ====================
    const hasCards = isMultiMode ? cardStates.length > 0 : sessionData?.cards?.length > 0;
    if (!hasCards) {
        return (
            <div className="min-h-screen min-h-dvh w-full flex flex-col items-center justify-center gap-4 p-6 bg-deep text-center">
                <PartyPopper className="size-16 text-amber-400" />
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">No cards due!</h2>
                <p className="text-[var(--color-text-secondary)]">Great job! You've reviewed all your cards for now.</p>
                <Button size="lg" onClick={() => navigate('/')}>
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    // ==================== Session Complete ====================
    if (sessionComplete || completed) {
        const totalCards = isMultiMode ? cardStates.length : sessionData?.cards?.length || 0;

        // Node mode: Show loading while completing, then show results
        if (isNodeMode) {
            if (completeNodeMutation.isPending) {
                return (
                    <div className="min-h-screen min-h-dvh w-full flex items-center justify-center bg-deep">
                        <div className="text-center space-y-4">
                            <Loader2 className="size-12 text-primary animate-spin mx-auto" />
                            <p className="text-[var(--color-text-secondary)]">Saving your progress...</p>
                        </div>
                    </div>
                );
            }

            // Show completion result with stars/XP
            return (
                <div className="min-h-screen min-h-dvh w-full flex items-center justify-center p-6 bg-deep">
                    <Card className="max-w-md w-full text-center">
                        <CardContent className="p-8 space-y-6">
                            <PartyPopper className="size-16 text-amber-400 mx-auto" />
                            <h2 className="text-2xl font-bold font-display text-[var(--color-text-primary)]">Node Complete!</h2>

                            {/* Stars Display */}
                            {nodeCompletionData && (
                                <div className="space-y-4">
                                    <div className="flex justify-center gap-2">
                                        {[1, 2, 3].map((star) => (
                                            <span
                                                key={star}
                                                className={`text-4xl ${star <= nodeCompletionData.stars ? 'text-accent-amber' : 'text-[var(--color-text-muted)]'}`}
                                            >
                                                ⭐
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex justify-center gap-6 text-sm">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-emerald-400">+{nodeCompletionData.xpEarned}</div>
                                            <div className="text-[var(--color-text-muted)]">XP</div>
                                        </div>
                                        {nodeCompletionData.crowns > 0 && (
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-amber-400">+{nodeCompletionData.crowns}</div>
                                                <div className="text-[var(--color-text-muted)]">Crowns</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <p className="text-[var(--color-text-secondary)]">You reviewed {totalCards} cards</p>

                            <div className="flex gap-3 justify-center pt-4">
                                {nodeCompletionData?.nextNodeId && (
                                    <Button onClick={() => {
                                        console.log('🚀 [Next Level] Navigating to next node:', nodeCompletionData.nextNodeId);
                                        // Use window.location.href to force full page reload
                                        // React Router navigate() doesn't re-mount when only the param changes
                                        window.location.href = `/study/node/${nodeCompletionData.nextNodeId}`;
                                    }}>
                                        Next Level 🚀
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => navigate(-1)}>
                                    Back to Path
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        // Regular mode: simple completion card
        return (
            <div className="min-h-screen min-h-dvh w-full flex items-center justify-center p-6 bg-deep">
                <Card className="max-w-md w-full text-center">
                    <CardContent className="p-8 space-y-4">
                        <PartyPopper className="size-16 text-amber-400 mx-auto" />
                        <h2 className="text-2xl font-bold font-display text-[var(--color-text-primary)]">Session Complete!</h2>
                        <p className="text-[var(--color-text-secondary)]">You reviewed {totalCards} cards</p>
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

    // ==================== No Vocabulary/Mode Available ====================
    if (!vocabulary || !currentMode) {
        return (
            <div className="min-h-screen min-h-dvh w-full flex items-center justify-center bg-deep">
                <Loader2 className="size-8 text-primary animate-spin" />
            </div>
        );
    }

    // ==================== Progress Calculation ====================
    const totalCards = isMultiMode ? multiTotalCards : sessionData?.cards?.length || 0;
    const progressPercent = isMultiMode
        ? multiProgressPercent
        : ((currentCardIndex + 1) / totalCards) * 100;

    // ==================== Render Mode ====================
    // Generate a key that changes whenever the card changes OR is retried.
    // This forces React to unmount/remount the mode component, resetting all internal state
    // (fixes: same card retry not resetting ClozeMode when vocabulary.id doesn't change)
    const modeResetKey = isMultiMode
        ? `${currentCardIdx}-${currentCardState?.retryQueue.length ?? 0}-${currentCardState?.modeAttempts.size ?? 0}-${Array.from(currentCardState?.modeAttempts.values() ?? []).reduce((s, v) => s + v, 0)}`
        : `${currentCardIndex}`;

    const renderMode = () => {
        switch (currentMode) {
            case 'reading':
                return <ReadingMode key={modeResetKey} vocabulary={vocabulary} onRate={handleRate} />;
            case 'typing':
                return <TypingMode key={modeResetKey} vocabulary={vocabulary} onRate={handleRate} />;
            case 'listening':
                return <ListeningMode key={modeResetKey} vocabulary={vocabulary} onRate={handleRate} />;
            case 'multiple_choice':
                return <MultipleChoiceMode key={modeResetKey} vocabulary={vocabulary} distractors={distractors} onRate={handleRate} />;
            case 'cloze':
                return <ClozeMode key={modeResetKey} vocabulary={vocabulary} onRate={handleRate} />;
            case 'spelling':
                return <SpellingBeeMode key={modeResetKey} vocabulary={vocabulary} onRate={handleRate} />;
            case 'audio_choice':
                return <AudioChoiceMode key={modeResetKey} vocabulary={vocabulary} distractors={distractors} onRate={handleRate} />;
            default:
                return <ReadingMode key={modeResetKey} vocabulary={vocabulary} onRate={handleRate} />;
        }
    };

    const modeAccent = getModeAccent(currentMode);
    const modeIcon = getModeIcon(currentMode);

    return (
        <div className="min-h-screen min-h-dvh w-full flex flex-col bg-deep relative">
            {/* Ambient background orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className={`absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br ${modeAccent.gradient} opacity-[0.04] blur-3xl transition-all duration-1000`} />
                <div className={`absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-br ${modeAccent.gradient} opacity-[0.03] blur-3xl transition-all duration-1000`} />
            </div>

            {/* Header — Glassmorphism */}
            <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[var(--color-bg-deep)]/80 backdrop-blur-2xl">
                <div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-4">
                    <Button variant="ghost" size="sm" onClick={() => {
                        if (isNodeMode && nodeSessionData?.deckId) {
                            navigate(`/path/${nodeSessionData.deckId}`);
                        } else if (isPathContext && deckId) {
                            navigate(`/path/${deckId}`);
                        } else if (deckId) {
                            navigate(`/deck/${deckId}`);
                        } else {
                            navigate('/');
                        }
                    }}>
                        <ArrowLeft className="size-4" />
                        Back
                    </Button>
                    <div className="text-center">
                        <h1 className="font-semibold font-display text-[var(--color-text-primary)] flex items-center gap-1.5 justify-center">
                            <span>{modeIcon}</span>
                            {MODE_NAMES[currentMode] || 'Study'}
                            {isRetrying && <span className="text-amber-400 text-sm">(Retry)</span>}
                        </h1>
                        {isMultiMode && currentCardState && (
                            <div className="text-xs text-[var(--color-text-secondary)]">
                                Mode {currentCardState.currentModeIndex + 1}/{currentCardState.modeQueue.length}
                                {currentCardState.retryQueue.length > 0 && ` + ${currentCardState.retryQueue.length} retry`}
                            </div>
                        )}
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                        {completedCount} / {totalCards}
                    </span>
                </div>
            </header>

            {/* State-based Progress Bar */}
            {isMultiMode && multiModeData?.counts && (
                <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-surface)]/90 border-b border-[var(--color-border-default)] text-sm">
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
                    <div className="ml-auto bg-[var(--color-bg-elevated)]/50 px-3 py-1 rounded-full">
                        <span className="text-[var(--color-text-secondary)] font-medium">Total: {completedCount}/{totalCards}</span>
                    </div>
                </div>
            )}

            {/* Gradient Progress Bar — Mode Accent */}
            <div className="h-1.5 bg-white/5">
                <div
                    className={`h-full bg-gradient-to-r ${modeAccent.gradient} transition-all duration-500 ease-out`}
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Mode Progress Rail */}
            {isMultiMode && currentCardState && (
                <ModeProgressRail
                    modeQueue={currentCardState.modeQueue}
                    currentModeIndex={currentCardState.currentModeIndex}
                    retryQueue={currentCardState.retryQueue}
                />
            )}

            {/* Study Mode Content */}
            <main className="flex-1 flex items-center justify-center p-4 md:p-6 relative z-10">
                {renderMode()}
            </main>
        </div>
    );
}

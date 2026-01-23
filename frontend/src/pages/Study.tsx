import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { studyApi } from '@/services/api';
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
    const { mode } = useParams<{ mode: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const deckId = searchParams.get('deck');
    const isMultiMode = mode === 'multi';

    // ==================== Daily Limit ====================
    const getDailyLimit = () => {
        const settings = localStorage.getItem(`deck-settings-${deckId}`);
        return settings ? JSON.parse(settings).dailyNewCards || 20 : 20;
    };
    const dailyLimit = getDailyLimit();

    // ==================== Multi-Mode Session Hook ====================
    const multiModeSession = useMultiModeSession(deckId, dailyLimit, isMultiMode);
    const {
        cardStates,
        currentCardIdx,
        currentRound,
        isLoading: multiLoading,
        sessionComplete,
        completedCount,
        multiModeData,
        getCurrentCardState,
        getCurrentMode,
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

    // ==================== Study Review Hook ====================
    const { handleRate } = useStudyReview({
        isMultiMode,
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
            <div className="min-h-screen min-h-dvh w-full flex items-center justify-center bg-slate-900">
                <Loader2 className="size-8 text-primary animate-spin" />
            </div>
        );
    }

    // ==================== No Cards ====================
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

    // ==================== Session Complete ====================
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

    // ==================== No Vocabulary/Mode Available ====================
    if (!vocabulary || !currentMode) {
        return (
            <div className="min-h-screen min-h-dvh w-full flex items-center justify-center bg-slate-900">
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

/**
 * useStudyReview - Handles review submission and card interleaving logic
 * 
 * Contains:
 * - handleRate function (the main rating logic)
 * - Single-mode review handling
 * - Multi-mode penalty calculation
 * - Card interleaving navigation
 */

import { useMutation } from '@tanstack/react-query';
import { studyApi } from '@/services/api';
import type { StudyModeType } from '@/types/schema';
import type { CardStudyState } from './useMultiModeSession';

// ==================== Types ====================

interface UseStudyReviewParams {
    // Multi-mode state
    isMultiMode: boolean;
    cardStates: CardStudyState[];
    currentCardIdx: number;
    currentRound: number;
    getCurrentMode: () => StudyModeType | null;

    // Setters
    setCardStates: React.Dispatch<React.SetStateAction<CardStudyState[]>>;
    setCurrentCardIdx: React.Dispatch<React.SetStateAction<number>>;
    setCurrentRound: React.Dispatch<React.SetStateAction<number>>;
    setCompletedCount: React.Dispatch<React.SetStateAction<number>>;

    // Single mode state
    sessionData?: { cards: Array<{ id: string; vocabulary: unknown }> } | null;
    sessionId: string | null;
    currentCardIndex: number;
    setCurrentCardIndex: React.Dispatch<React.SetStateAction<number>>;
    setCompleted: React.Dispatch<React.SetStateAction<boolean>>;

    // URL params
    mode: string | undefined;
}

interface UseStudyReviewReturn {
    handleRate: (rating: number) => void;
    isSubmitting: boolean;
}

// ==================== Constants ====================

const HARD_MODES: StudyModeType[] = ['spelling', 'typing', 'listening'];

// ==================== Helpers ====================

/**
 * Calculate final FSRS rating based on mode attempts during card session
 */
function calculateFinalRating(cardState: CardStudyState): number {
    const totalFails = Array.from(cardState.modeAttempts.values())
        .reduce((sum, attempts) => sum + Math.max(0, attempts - 1), 0);

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

/**
 * Find next incomplete card index using round-robin
 */
function findNextIncompleteCard(fromIdx: number, states: CardStudyState[]): number {
    const len = states.length;
    if (len === 0) return -1;

    for (let i = 1; i <= len; i++) {
        const idx = (fromIdx + i) % len;
        if (!states[idx].isComplete) {
            return idx;
        }
    }
    return -1;
}

// ==================== Hook ====================

export function useStudyReview({
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
}: UseStudyReviewParams): UseStudyReviewReturn {

    // ==================== Mutation ====================
    const reviewMutation = useMutation({
        mutationFn: async ({ cardId, rating }: { cardId: string; rating: number }) => {
            return studyApi.submitReview({
                cardId,
                rating,
                studyMode: isMultiMode ? 'multi' : mode!,
            });
        },
    });

    // ==================== Handle Rate ====================
    const handleRate = (rating: number) => {
        // ==================== Single Mode ====================
        if (!isMultiMode) {
            const currentCard = sessionData?.cards[currentCardIndex];
            if (currentCard) {
                reviewMutation.mutate({ cardId: currentCard.id, rating });

                if (sessionData && currentCardIndex < sessionData.cards.length - 1) {
                    setCurrentCardIndex(prev => prev + 1);
                } else {
                    setCompleted(true);
                    if (sessionId) studyApi.completeSession(sessionId);
                }
            }
            return;
        }

        // ==================== Multi Mode: Card Interleaving + Penalty Logic ====================
        const passed = rating >= 3;
        const currentMode = getCurrentMode();
        if (!currentMode) return;

        // Clone states for immutable update
        const newStates = cardStates.map(c => ({
            ...c,
            modeAttempts: new Map(c.modeAttempts),
            retryQueue: [...c.retryQueue],
        }));

        const cardState = newStates[currentCardIdx];
        if (!cardState || cardState.isComplete) return;

        let computedNextIdx = currentCardIdx;
        let computedShouldAdvanceRound = false;

        if (passed) {
            // ==================== Passed: Progress Forward ====================

            // Remove from retry queue if present
            cardState.retryQueue = cardState.retryQueue.filter(m => m !== currentMode);

            // Record attempt (1 = correct first try)
            if (!cardState.modeAttempts.has(currentMode)) {
                cardState.modeAttempts.set(currentMode, 1);
            }

            // Move to next mode or complete card
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
            // ==================== Failed: Add to Retry Queue ====================

            if (!cardState.retryQueue.includes(currentMode)) {
                cardState.retryQueue.push(currentMode);
            }

            // Increment attempts
            cardState.modeAttempts.set(
                currentMode,
                (cardState.modeAttempts.get(currentMode) || 0) + 1
            );
        }

        // ==================== Check Round Advancement ====================
        const allPassedCurrentRound = newStates.every(
            c => c.isComplete || c.currentModeIndex > currentRound
        );
        if (allPassedCurrentRound) {
            computedShouldAdvanceRound = true;
        }

        // ==================== Find Next Card ====================
        computedNextIdx = findNextIncompleteCard(currentCardIdx, newStates);
        if (computedNextIdx < 0) computedNextIdx = currentCardIdx;

        // ==================== Apply State Updates ====================
        setCardStates(newStates);
        if (computedShouldAdvanceRound) {
            setCurrentRound(r => r + 1);
        }
        setCurrentCardIdx(computedNextIdx);
    };

    return {
        handleRate,
        isSubmitting: reviewMutation.isPending,
    };
}

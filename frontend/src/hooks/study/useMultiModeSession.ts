/**
 * useMultiModeSession - Manages multi-mode study session state
 * 
 * Supports two source types:
 * - 'review': Standard FSRS review (existing behavior)
 * - 'node': Learning path node study session (with pre-defined mode queues)
 * 
 * Handles:
 * - Card states with interleaving (cardStates, currentCardIdx, currentRound)
 * - Current card/mode getters
 * - Session completion detection
 * - Progress tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { studyApi, learningPathApi } from '@/services/api';
import type { StudyModeType, Vocabulary, CardStateValue, NodeSessionResponse } from '@/types/schema';

export interface CardStudyState {
    cardId: string;
    vocabulary: Vocabulary;
    originalState: CardStateValue;
    modeQueue: StudyModeType[];
    currentModeIndex: number;
    retryQueue: StudyModeType[];
    modeAttempts: Map<StudyModeType, number>;
    usedHint: boolean;
    isComplete: boolean;
}

export interface UseMultiModeSessionProps {
    /** Source type: 'node' for learning path, 'review' for standard FSRS review */
    sourceType: 'node' | 'review';
    /** Source ID: nodeId for 'node' type, deckId for 'review' type */
    sourceId: string;
    /** Daily card limit (only used for 'review' mode) */
    dailyLimit?: number;
    /** Whether to enable the hook */
    enabled: boolean;
}

export interface MultiModeSessionReturn {
    // State
    cardStates: CardStudyState[];
    currentCardIdx: number;
    currentRound: number;
    isLoading: boolean;
    sessionComplete: boolean;
    completedCount: number;

    // Data from API
    multiModeData: {
        cards: Array<{ id: string; vocabulary: Vocabulary; originalState: CardStateValue }>;
        counts: { relearning: number; learning: number; due: number; new: number; totalNew: number };
        quota: { daily: number; used: number; remaining: number };
    } | undefined;

    // Node-specific data
    nodeSessionData: NodeSessionResponse | undefined;

    // Getters
    getCurrentCardState: () => CardStudyState | null;
    getCurrentMode: () => StudyModeType | null;
    getTotalRetries: () => number;

    // Setters (for external updates from useStudyReview)
    setCardStates: React.Dispatch<React.SetStateAction<CardStudyState[]>>;
    setCurrentCardIdx: React.Dispatch<React.SetStateAction<number>>;
    setCurrentRound: React.Dispatch<React.SetStateAction<number>>;
    setCompletedCount: React.Dispatch<React.SetStateAction<number>>;

    // Computed
    totalCards: number;
    progressPercent: number;
    isRetrying: boolean;
    sourceType: 'node' | 'review';
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

/**
 * Get modes based on card state (for review mode only)
 * Node mode uses pre-defined mode queues from backend
 */
function getModesForCardState(state: number): StudyModeType[] {
    const ALL_MODES: StudyModeType[] = ['typing', 'listening', 'multiple_choice', 'cloze', 'spelling', 'audio_choice'];

    switch (state) {
        case 0: // New - Reading + 3 Active modes
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

// ==================== Hook ====================

export function useMultiModeSession({
    sourceType,
    sourceId,
    dailyLimit = 20,
    enabled,
}: UseMultiModeSessionProps): MultiModeSessionReturn {
    // ==================== State ====================
    const queryClient = useQueryClient();
    const [cardStates, setCardStates] = useState<CardStudyState[]>([]);
    const [currentCardIdx, setCurrentCardIdx] = useState(0);
    const [currentRound, setCurrentRound] = useState(0);
    const [sessionComplete, setSessionComplete] = useState(false);
    const [completedCount, setCompletedCount] = useState(0);

    // ==================== Node Session Data Fetching ====================
    const { data: nodeSessionData, isLoading: isNodeLoading } = useQuery({
        queryKey: ['node-study-session', sourceId],
        queryFn: async () => {
            const response = await learningPathApi.getNodeSession(parseInt(sourceId));
            return response.data as NodeSessionResponse;
        },
        enabled: enabled && sourceType === 'node' && !!sourceId,
    });

    // ==================== Review Queue Data Fetching ====================
    const { data: multiModeData, isLoading: isReviewLoading } = useQuery({
        queryKey: ['multi-study-queue', sourceId, dailyLimit],
        queryFn: async () => {
            let queueResponse = await studyApi.getQueue(sourceId || undefined, dailyLimit);
            let queue = queueResponse.data;

            // Auto-seed if needed
            if (queue.needMoreSeeds && sourceId) {
                await studyApi.learnDeck(sourceId, dailyLimit);
                queueResponse = await studyApi.getQueue(sourceId, dailyLimit);
                queue = queueResponse.data;
            }

            // Combine cards in priority order: Relearning → Learning → Review → New
            const allCards = [
                ...(queue.relearning || []).map((c: { id: string; vocabulary: Vocabulary }) => ({ ...c, originalState: 3 as CardStateValue })),
                ...queue.learning.map((c: { id: string; vocabulary: Vocabulary }) => ({ ...c, originalState: 1 as CardStateValue })),
                ...queue.due.map((c: { id: string; vocabulary: Vocabulary }) => ({ ...c, originalState: 2 as CardStateValue })),
                ...queue.new.map((c: { id: string; vocabulary: Vocabulary }) => ({ ...c, originalState: 0 as CardStateValue })),
            ];

            return {
                cards: allCards,
                counts: queue.counts,
                quota: queue.quota,
            };
        },
        enabled: enabled && sourceType === 'review' && !!sourceId,
    });

    // Combine loading states
    const isLoading = sourceType === 'node' ? isNodeLoading : isReviewLoading;

    // ==================== Initialize Card States (Node Mode) ====================
    // IMPORTANT: Use the SAME getModesForCardState() as review mode for unified behavior
    useEffect(() => {
        if (enabled && sourceType === 'node' && nodeSessionData?.items?.length && cardStates.length === 0) {
            const initialStates: CardStudyState[] = nodeSessionData.items.map((item) => ({
                // Use card ID if exists, otherwise create temp ID from vocab
                cardId: item.card?.id ?? `temp-${item.vocab.id}`,
                vocabulary: item.vocab,
                originalState: item.originalState,
                // Use the SAME adaptive mode generation as review mode (NOT backend's hardcoded queue)
                modeQueue: getModesForCardState(item.originalState),
                currentModeIndex: 0,
                retryQueue: [],
                modeAttempts: new Map(),
                usedHint: false,
                isComplete: false,
            }));
            setCardStates(initialStates);
            setCurrentCardIdx(0);
            setCurrentRound(0);
            setSessionComplete(false);
            setCompletedCount(0);
        }
    }, [enabled, sourceType, nodeSessionData, cardStates.length]);

    // ==================== Initialize Card States (Review Mode) ====================
    useEffect(() => {
        if (enabled && sourceType === 'review' && multiModeData?.cards?.length && multiModeData.cards.length > 0 && cardStates.length === 0) {
            const initialStates: CardStudyState[] = multiModeData.cards.map((card) => ({
                cardId: card.id,
                vocabulary: card.vocabulary,
                originalState: card.originalState,
                modeQueue: getModesForCardState(card.originalState),
                currentModeIndex: 0,
                retryQueue: [],
                modeAttempts: new Map(),
                usedHint: false,
                isComplete: false,
            }));
            setCardStates(initialStates);
            setCurrentCardIdx(0);
            setCurrentRound(0);
            setSessionComplete(false);
            setCompletedCount(0);
        }
    }, [enabled, sourceType, multiModeData, cardStates.length]);

    // ==================== Session Completion Check ====================
    useEffect(() => {
        if (enabled && cardStates.length > 0 && cardStates.every(c => c.isComplete)) {
            setSessionComplete(true);

            // Force dashboard refresh
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
                queryClient.invalidateQueries({ queryKey: ['user-progress'] }),
                queryClient.invalidateQueries({ queryKey: ['cards-due'] })
            ]);
        }
    }, [enabled, cardStates, queryClient]);

    // ==================== Getters ====================
    const getCurrentCardState = useCallback((): CardStudyState | null => {
        if (!enabled || cardStates.length === 0) return null;
        const card = cardStates[currentCardIdx];
        if (!card || card.isComplete) return null;
        return card;
    }, [enabled, cardStates, currentCardIdx]);

    const getCurrentMode = useCallback((): StudyModeType | null => {
        const cardState = getCurrentCardState();
        if (!cardState) return null;

        // 1. Priority: Retry Queue (if we've moved past the round, OR if it's the only thing left)
        if (cardState.retryQueue.length > 0) {
            // If we are advanced past the round, definitely do retry
            if (cardState.currentModeIndex > currentRound) {
                return cardState.retryQueue[0];
            }
            // Fallback: If we are technically "in" the round but stuck?
            // Actually, if we are in the round, we usually prefer modeQueue.
        }

        // 2. Priority: Normal Mode Queue (Active Round)
        if (cardState.currentModeIndex < cardState.modeQueue.length) {
            // Strict check: Only if allowed by round
            if (cardState.currentModeIndex <= currentRound) {
                return cardState.modeQueue[cardState.currentModeIndex];
            }
        }

        // 3. Cleanup: If we finished normal modes but have retries remaining
        if (cardState.retryQueue.length > 0) {
            return cardState.retryQueue[0];
        }

        // 4. Deadlock Prevention:
        // If we are here, it means:
        // - We have no retry items OR they are gated?
        // - We have mode items BUT they are gated (> currentRound).
        // BUT currentCardState IS this card. So the scheduler picked us.
        // If the scheduler picked us, we MUST have something to do, otherwise infinite load.

        // If we have retries, just show them.
        if (cardState.retryQueue.length > 0) {
            return cardState.retryQueue[0];
        }

        // If we have modes left, just show them (even if ostensibly gated - better than crashing).
        if (cardState.currentModeIndex < cardState.modeQueue.length) {
            return cardState.modeQueue[cardState.currentModeIndex];
        }

        return null;
    }, [getCurrentCardState, currentRound]);

    /**
     * Get total retry count across all cards (for star rating calculation)
     */
    const getTotalRetries = useCallback((): number => {
        return cardStates.reduce((total, card) => {
            const attempts = Array.from(card.modeAttempts.values());
            // Count retries as attempts beyond the first
            return total + attempts.reduce((sum, a) => sum + Math.max(0, a - 1), 0);
        }, 0);
    }, [cardStates]);

    // ==================== Computed Values ====================
    const totalCards = cardStates.length;
    const incompleteCount = cardStates.filter(c => !c.isComplete).length;
    const progressPercent = totalCards > 0 ? ((totalCards - incompleteCount) / totalCards) * 100 : 0;

    const currentCardState = getCurrentCardState();
    const currentMode = getCurrentMode();
    const isRetrying = currentCardState !== null && currentMode !== null && currentCardState.retryQueue.includes(currentMode);

    return {
        // State
        cardStates,
        currentCardIdx,
        currentRound,
        isLoading,
        sessionComplete,
        completedCount,

        // Data
        multiModeData,
        nodeSessionData,

        // Getters
        getCurrentCardState,
        getCurrentMode,
        getTotalRetries,

        // Setters
        setCardStates,
        setCurrentCardIdx,
        setCurrentRound,
        setCompletedCount,

        // Computed
        totalCards,
        progressPercent,
        isRetrying,
        sourceType,
    };
}

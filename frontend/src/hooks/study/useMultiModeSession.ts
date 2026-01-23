/**
 * useMultiModeSession - Manages multi-mode study session state
 * 
 * Handles:
 * - Card states with interleaving (cardStates, currentCardIdx, currentRound)
 * - Current card/mode getters
 * - Session completion detection
 * - Progress tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studyApi } from '@/services/api';
import type { StudyModeType, Vocabulary, CardStateValue } from '@/types/schema';

// ==================== Types ====================

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

    // Getters
    getCurrentCardState: () => CardStudyState | null;
    getCurrentMode: () => StudyModeType | null;

    // Setters (for external updates from useStudyReview)
    setCardStates: React.Dispatch<React.SetStateAction<CardStudyState[]>>;
    setCurrentCardIdx: React.Dispatch<React.SetStateAction<number>>;
    setCurrentRound: React.Dispatch<React.SetStateAction<number>>;
    setCompletedCount: React.Dispatch<React.SetStateAction<number>>;

    // Computed
    totalCards: number;
    progressPercent: number;
    isRetrying: boolean;
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

export function useMultiModeSession(
    deckId: string | null,
    dailyLimit: number,
    enabled: boolean
): MultiModeSessionReturn {
    // ==================== State ====================
    const [cardStates, setCardStates] = useState<CardStudyState[]>([]);
    const [currentCardIdx, setCurrentCardIdx] = useState(0);
    const [currentRound, setCurrentRound] = useState(0);
    const [sessionComplete, setSessionComplete] = useState(false);
    const [completedCount, setCompletedCount] = useState(0);

    // ==================== Data Fetching ====================
    const { data: multiModeData, isLoading } = useQuery({
        queryKey: ['multi-study-queue', deckId, dailyLimit],
        queryFn: async () => {
            let queueResponse = await studyApi.getQueue(deckId || undefined, dailyLimit);
            let queue = queueResponse.data;

            // Auto-seed if needed
            if (queue.needMoreSeeds && deckId) {
                await studyApi.learnDeck(deckId, dailyLimit);
                queueResponse = await studyApi.getQueue(deckId, dailyLimit);
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
        enabled: enabled && !!deckId,
    });

    // ==================== Initialize Card States ====================
    useEffect(() => {
        if (enabled && multiModeData?.cards?.length && multiModeData.cards.length > 0 && cardStates.length === 0) {
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
        }
    }, [enabled, multiModeData, cardStates.length]);

    // ==================== Session Completion Check ====================
    useEffect(() => {
        if (enabled && cardStates.length > 0 && cardStates.every(c => c.isComplete)) {
            setSessionComplete(true);
        }
    }, [enabled, cardStates]);

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

        // Getters
        getCurrentCardState,
        getCurrentMode,

        // Setters
        setCardStates,
        setCurrentCardIdx,
        setCurrentRound,
        setCompletedCount,

        // Computed
        totalCards,
        progressPercent,
        isRetrying,
    };
}

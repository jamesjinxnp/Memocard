/**
 * useDistractors - Fetches distractor vocabulary for choice-based modes
 * 
 * Handles:
 * - Fetching random vocabulary words as wrong answers
 * - Excluding current vocabulary from distractors
 * - Shuffling results for randomness
 */

import { useState, useEffect } from 'react';
import { vocabularyApi } from '@/services/api';
import type { Vocabulary, StudyModeType } from '@/types/schema';

// ==================== Types ====================

interface UseDistractorsParams {
    currentMode: StudyModeType | null;
    currentVocabularyId: number | undefined;
    enabled: boolean;
}

interface UseDistractorsReturn {
    distractors: Vocabulary[];
    isLoading: boolean;
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

// ==================== Hook ====================

export function useDistractors({
    currentMode,
    currentVocabularyId,
    enabled,
}: UseDistractorsParams): UseDistractorsReturn {
    const [distractors, setDistractors] = useState<Vocabulary[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const needsDistractors = currentMode === 'multiple_choice' || currentMode === 'audio_choice';

        if (!enabled || !needsDistractors || !currentVocabularyId) {
            return;
        }

        const fetchDistractors = async () => {
            setIsLoading(true);
            try {
                const response = await vocabularyApi.getRandom(3, undefined, [currentVocabularyId]);
                const items = response.data.items || [];
                setDistractors(shuffleArray([...items]));
            } catch (err) {
                console.warn('Failed to fetch distractors:', err);
                setDistractors([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDistractors();
    }, [currentMode, currentVocabularyId, enabled]);

    return {
        distractors,
        isLoading,
    };
}

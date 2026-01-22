/**
 * Frontend Type Definitions
 * Auto-generated based on backend/src/db/schema.ts
 * 
 * These types mirror the Drizzle schema for type safety across the frontend.
 */

// ==================== CONSTANTS ====================

/** FSRS Card State (use as CardState.New, etc.) */
export const CardState = {
    New: 0,
    Learning: 1,
    Review: 2,
    Relearning: 3,
} as const;

export type CardStateValue = (typeof CardState)[keyof typeof CardState];

/** FSRS Rating (use as Rating.Again, etc.) */
export const Rating = {
    Again: 1,
    Hard: 2,
    Good: 3,
    Easy: 4,
} as const;

export type RatingValue = (typeof Rating)[keyof typeof Rating];

/** Study Mode Types */
export type StudyModeType =
    | 'reading'
    | 'typing'
    | 'listening'
    | 'multiple_choice'
    | 'cloze'
    | 'spelling'
    | 'audio_choice'
    | 'multi';

// ==================== USER ====================

export interface User {
    id: string;
    email: string;
    name?: string | null;
    preferences?: string | null; // JSON string
    createdAt: Date;
    updatedAt?: Date | null;
}

export interface UserPreferences {
    theme?: 'dark' | 'light';
    dailyNewCards?: number;
}

// ==================== VOCABULARY ====================

export interface Vocabulary {
    id: number;
    word: string;
    defTh?: string | null;
    defEn?: string | null;
    type?: string | null; // part of speech
    ipaUs?: string | null;
    ipaUk?: string | null;
    cefr?: string | null; // A1, A2, B1, B2, C1
    example?: string | null;
    audioTh?: string | null;
    audioEn?: string | null;
    audioExample?: string | null;
    imageUrl?: string | null;
    tag?: string | null; // Comma-separated tags
}

// ==================== CARD (FSRS State) ====================

export interface Card {
    id: string;
    userId: string;
    vocabularyId: number;

    // FSRS fields
    due: Date;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    learningSteps: number;
    reps: number;
    lapses: number;
    state: CardStateValue;
    lastReview?: Date | null;

    createdAt: Date;
}

// ==================== REVIEW LOG ====================

export interface ReviewLog {
    id: string;
    cardId: string;
    userId: string;

    rating: RatingValue;
    state: CardStateValue; // State before review
    studyMode: StudyModeType;
    responseTime?: number | null; // milliseconds

    // FSRS log data
    stability?: number | null;
    difficulty?: number | null;
    elapsedDays?: number | null;
    scheduledDays?: number | null;

    reviewedAt: Date;
}

// ==================== STUDY SESSION ====================

export interface StudySession {
    id: string;
    userId: string;
    mode: StudyModeType;
    cardsStudied: number;
    correctCount: number;
    duration?: number | null; // seconds
    startedAt: Date;
    completedAt?: Date | null;
}

// ==================== API RESPONSE TYPES ====================

/** Card with embedded vocabulary (from queue/session endpoints) */
export interface CardWithVocabulary {
    id: string;
    vocabulary: Vocabulary;
    state: CardStateValue;
}

/** /study/queue response */
export interface StudyQueueResponse {
    relearning: CardWithVocabulary[];
    learning: CardWithVocabulary[];
    due: CardWithVocabulary[];
    new: CardWithVocabulary[];
    counts: {
        relearning: number;
        learning: number;
        due: number;
        new: number;
        totalNew: number;
    };
    totalByState: {
        relearning: number;
        learning: number;
        review: number;
        new: number;
    };
    quota: {
        daily: number;
        used: number;
        remaining: number;
    };
    needMoreSeeds: boolean;
}

/** /study/stats response */
export interface StudyStatsResponse {
    totalCards: number;
    cardsByState: Record<string, number>;
    reviewsToday: number;
    dueToday: number;
    nextDueTime?: string | null;
}

/** /study/stats/progress response */
export interface StudyProgressResponse {
    streak: number;
    overallAccuracy: number;
    totalReviews: number;
    bestDay: string;
    dailyStats: DailyStat[];
}

export interface DailyStat {
    date: string;
    dayName: string;
    reviews: number;
    correct: number;
    accuracy: number;
}

/** /study/session/start response */
export interface SessionStartResponse {
    sessionId: string;
    mode: string;
    cards: CardWithVocabulary[];
}

/** /study/review request body */
export interface SubmitReviewRequest {
    cardId: string;
    rating: RatingValue;
    studyMode: StudyModeType;
    responseTime?: number;
}

/** /study/review response */
export interface SubmitReviewResponse {
    message: string;
    nextReview: Date;
    interval: number;
    newState: CardStateValue;
}

// ==================== STUDY PAGE TYPES ====================

/** Card study state for multi-mode interleaving */
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

// ==================== DECK TYPES ====================

export interface DeckInfo {
    name: string;
    count: number;
}

export interface DeckStats {
    deck: string;
    total: number;
    learned: number;
    new: number;
}

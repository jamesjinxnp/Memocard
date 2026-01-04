import {
    FSRS,
    Card as FSRSCard,
    Rating,
    State,
    createEmptyCard,
    generatorParameters,
    RecordLogItem
} from 'ts-fsrs';

// FSRS instance with optimized parameters
const fsrsParams = generatorParameters({
    maximum_interval: 365,
    request_retention: 0.9,
    enable_fuzz: true,
});

const fsrs = new FSRS(fsrsParams);

/**
 * Create a new empty FSRS card
 */
export function createNewCard(now: Date = new Date()): FSRSCard {
    return createEmptyCard(now);
}

/**
 * Convert database card to FSRS card format
 */
export function dbCardToFSRS(dbCard: {
    due: Date;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    learningSteps: number;
    reps: number;
    lapses: number;
    state: number;
    lastReview: Date | null;
}): FSRSCard {
    return {
        due: dbCard.due,
        stability: dbCard.stability,
        difficulty: dbCard.difficulty,
        elapsed_days: dbCard.elapsedDays,
        scheduled_days: dbCard.scheduledDays,
        learning_steps: dbCard.learningSteps,
        reps: dbCard.reps,
        lapses: dbCard.lapses,
        state: dbCard.state as State,
        last_review: dbCard.lastReview || undefined,
    };
}

/**
 * Convert FSRS card back to database format
 */
export function fsrsCardToDb(fsrsCard: FSRSCard) {
    return {
        due: fsrsCard.due,
        stability: fsrsCard.stability,
        difficulty: fsrsCard.difficulty,
        elapsedDays: fsrsCard.elapsed_days,
        scheduledDays: fsrsCard.scheduled_days,
        learningSteps: fsrsCard.learning_steps,
        reps: fsrsCard.reps,
        lapses: fsrsCard.lapses,
        state: fsrsCard.state as number,
        lastReview: fsrsCard.last_review || null,
    };
}

/**
 * Schedule the next review for a card based on rating
 */
export function scheduleReview(
    card: FSRSCard,
    rating: Rating,
    now: Date = new Date()
): RecordLogItem {
    return fsrs.next(card, now, rating);
}

/**
 * Get all possible scheduling options for a card
 */
export function getSchedulingOptions(card: FSRSCard, now: Date = new Date()) {
    const repeat = fsrs.repeat(card, now);
    return {
        again: repeat[Rating.Again],
        hard: repeat[Rating.Hard],
        good: repeat[Rating.Good],
        easy: repeat[Rating.Easy],
    };
}

/**
 * Convert rating number to FSRS Rating enum
 */
export function toRating(rating: number): Rating {
    switch (rating) {
        case 1: return Rating.Again;
        case 2: return Rating.Hard;
        case 3: return Rating.Good;
        case 4: return Rating.Easy;
        default: throw new Error(`Invalid rating: ${rating}`);
    }
}

/**
 * Get human-readable state name
 */
export function getStateName(state: State): string {
    switch (state) {
        case State.New: return 'New';
        case State.Learning: return 'Learning';
        case State.Review: return 'Review';
        case State.Relearning: return 'Relearning';
        default: return 'Unknown';
    }
}

// Re-export types and enums for convenience
export { Rating, State, type FSRSCard, type RecordLogItem };

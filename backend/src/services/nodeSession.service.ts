/**
 * Node Session Service
 * 
 * Generates study session queues for Learning Path nodes.
 * Implements interleaving flow based on FSRS card state.
 */

import { db } from '../db/client';
import { nodeVocabulary, vocabulary, cards, nodes, reviewLogs, units, levels } from '../db/schema';
import { eq, and, inArray, asc, sql } from 'drizzle-orm';
import { createNewCard, dbCardToFSRS, fsrsCardToDb, scheduleReview, toRating, type FSRSCard } from './fsrs.service';
import { nanoid } from '../utils/nanoid';

// ==================== Types ====================

export type StudyModeType =
    | 'reading'
    | 'typing'
    | 'listening'
    | 'multiple_choice'
    | 'cloze'
    | 'spelling'
    | 'audio_choice';

export type CardStateValue = 0 | 1 | 2 | 3; // New, Learning, Review, Relearning

export interface NodeSessionItem {
    vocab: {
        id: number;
        word: string;
        defTh: string | null;
        defEn: string | null;
        type: string | null;
        ipaUs: string | null;
        ipaUk: string | null;
        cefr: string | null;
        example: string | null;
        audioTh: string | null;
        audioEn: string | null;
        audioExample: string | null;
        imageUrl: string | null;
        tag: string | null;
    };
    card: {
        id: string;
        state: CardStateValue;
        stability: number;
        difficulty: number;
        due: Date;
    } | null;
    modeQueue: StudyModeType[];
    originalState: CardStateValue;
}

export interface NodeSessionResponse {
    nodeId: number;
    deckId: string; // Added for navigation back to learning path
    items: NodeSessionItem[];
    stats: {
        total: number;
        new: number;
        learning: number;
        review: number;
        relearning: number;
    };
}

// ==================== Helpers ====================

/**
 * Generate mode queue based on FSRS card state
 * 
 * Logic from user spec:
 * - New/Relearning (state 0, 3): Passive exposure first → reading, listening, multiple_choice
 * - Learning/Review (state 1, 2): Active recall focus → typing, spelling, listening
 */
function getModesForState(state: CardStateValue): StudyModeType[] {
    switch (state) {
        case 0: // New - Start with passive exposure
            return ['reading', 'listening', 'multiple_choice'];
        case 1: // Learning - Focus on active recall
            return ['typing', 'spelling', 'listening'];
        case 2: // Review - Focus on active recall
            return ['typing', 'spelling', 'listening'];
        case 3: // Relearning - Re-introduce with passive exposure
            return ['reading', 'listening', 'multiple_choice'];
        default:
            return ['reading', 'listening', 'multiple_choice'];
    }
}

// ==================== Main Service ====================

/**
 * Get node study session with interleaving queue
 * 
 * @param userId - The authenticated user's ID
 * @param nodeId - The node ID to generate session for
 * @returns NodeSessionResponse with items and stats
 */
export async function getNodeSession(
    userId: string,
    nodeId: number
): Promise<NodeSessionResponse> {
    // 1. Verify node exists and get deckId via joins
    const nodeWithDeck = await db
        .select({
            node: nodes,
            unit: units,
            level: levels,
        })
        .from(nodes)
        .innerJoin(units, eq(nodes.unitId, units.id))
        .innerJoin(levels, eq(units.levelId, levels.id))
        .where(eq(nodes.id, nodeId))
        .limit(1);

    if (nodeWithDeck.length === 0) {
        throw new Error('Node not found');
    }

    const { level } = nodeWithDeck[0];
    const deckId = level.deckId;

    // 2. Get vocabulary for this node (ordered by position)
    const vocabData = await db
        .select({
            nv: nodeVocabulary,
            vocab: vocabulary,
        })
        .from(nodeVocabulary)
        .innerJoin(vocabulary, eq(nodeVocabulary.vocabularyId, vocabulary.id))
        .where(eq(nodeVocabulary.nodeId, nodeId))
        .orderBy(asc(nodeVocabulary.order));

    if (vocabData.length === 0) {
        return {
            nodeId,
            deckId,
            items: [],
            stats: {
                total: 0,
                new: 0,
                learning: 0,
                review: 0,
                relearning: 0,
            },
        };
    }

    // 3. Get vocabulary IDs for card lookup
    const vocabIds = vocabData.map((v) => v.vocab.id);

    // 4. Get existing cards for this user + vocabulary set
    const existingCards = await db
        .select()
        .from(cards)
        .where(
            and(
                eq(cards.userId, userId),
                inArray(cards.vocabularyId, vocabIds)
            )
        );

    // Create lookup map: vocabularyId → card
    const cardMap = new Map(
        existingCards.map((card) => [card.vocabularyId, card])
    );

    // 5. Build session items
    const stats = {
        total: vocabData.length,
        new: 0,
        learning: 0,
        review: 0,
        relearning: 0,
    };

    const items: NodeSessionItem[] = vocabData.map(({ vocab }) => {
        const card = cardMap.get(vocab.id);
        const originalState: CardStateValue = card ? (card.state as CardStateValue) : 0;

        // Count by state
        switch (originalState) {
            case 0:
                stats.new++;
                break;
            case 1:
                stats.learning++;
                break;
            case 2:
                stats.review++;
                break;
            case 3:
                stats.relearning++;
                break;
        }

        return {
            vocab: {
                id: vocab.id,
                word: vocab.word,
                defTh: vocab.defTh,
                defEn: vocab.defEn,
                type: vocab.type,
                ipaUs: vocab.ipaUs,
                ipaUk: vocab.ipaUk,
                cefr: vocab.cefr,
                example: vocab.example,
                audioTh: vocab.audioTh,
                audioEn: vocab.audioEn,
                audioExample: vocab.audioExample,
                imageUrl: vocab.imageUrl,
                tag: vocab.tag,
            },
            card: card
                ? {
                    id: card.id,
                    state: card.state as CardStateValue,
                    stability: card.stability,
                    difficulty: card.difficulty,
                    due: card.due,
                }
                : null,
            modeQueue: getModesForState(originalState),
            originalState,
        };
    });

    return {
        nodeId,
        deckId,
        items,
        stats,
    };
}

/**
 * Save session progress and persist FSRS card states
 */
export async function saveSessionProgress(
    userId: string,
    nodeId: number,
    results: Array<{
        vocabId: number;
        cardId?: string;
        rating: number; // 1-4
        fsrs?: {
            state: number; // 0-3
            stability: number;
            difficulty: number;
            elapsedDays: number;
            scheduledDays: number;
            reps: number;
            lapses: number;
            lastReview: Date; // ISO string normally, but date object here
            nextReview: Date;
        };
    }>
): Promise<{ savedCount: number }> {
    if (results.length === 0) return { savedCount: 0 };

    // 1. Get Deck ID through Node -> Unit -> Level
    const nodeContext = await db.query.nodes.findFirst({
        where: eq(nodes.id, nodeId),
        with: {
            unit: {
                with: {
                    level: true,
                },
            },
        },
    });

    if (!nodeContext || !nodeContext.unit?.level) {
        throw new Error('Node context not found');
    }

    const deckId = nodeContext.unit.level.deckId;

    // 2. Fetch existing cards to calculate FSRS updates if needed
    const vocabIds = results.map(r => r.vocabId);
    const existingCards = await db.query.cards.findMany({
        where: and(
            eq(cards.userId, userId),
            inArray(cards.vocabularyId, vocabIds)
        ),
    });

    const cardMap = new Map(existingCards.map(c => [c.vocabularyId, c]));

    const now = new Date();
    const upsertValues = [];
    const reviewLogsToInsert = [];

    // 3. Process each result
    for (const r of results) {
        let fsrsData;
        let cardId = r.cardId || cardMap.get(r.vocabId)?.id || nanoid();

        if (r.fsrs) {
            // Use provided FSRS data (pre-calculated by frontend)
            fsrsData = {
                due: new Date(r.fsrs.nextReview),
                stability: r.fsrs.stability,
                difficulty: r.fsrs.difficulty,
                elapsedDays: r.fsrs.elapsedDays,
                scheduledDays: r.fsrs.scheduledDays,
                reps: r.fsrs.reps,
                lapses: r.fsrs.lapses,
                state: r.fsrs.state,
                lastReview: new Date(r.fsrs.lastReview || now),
            };
        } else {
            // Calculate FSRS data on backend
            // Get previous state or create new
            const existingCard = cardMap.get(r.vocabId);
            let fsrsCard: FSRSCard;

            if (existingCard) {
                fsrsCard = dbCardToFSRS(existingCard);
            } else {
                fsrsCard = createNewCard(now);
            }

            // Schedule review
            const rating = toRating(r.rating);
            const schedulingResult = scheduleReview(fsrsCard, rating, now);

            // Map back to DB format
            const dbFromFsrs = fsrsCardToDb(schedulingResult.card);
            fsrsData = {
                due: dbFromFsrs.due,
                stability: dbFromFsrs.stability,
                difficulty: dbFromFsrs.difficulty,
                elapsedDays: dbFromFsrs.elapsedDays,
                scheduledDays: dbFromFsrs.scheduledDays,
                reps: dbFromFsrs.reps,
                lapses: dbFromFsrs.lapses,
                state: dbFromFsrs.state,
                lastReview: dbFromFsrs.lastReview || now,
            };

            // Prepare review log
            reviewLogsToInsert.push({
                id: nanoid(),
                userId,
                cardId,
                rating: r.rating,
                state: existingCard ? existingCard.state : 0, // 0 = New
                studyMode: 'review', // Default to review for node sessions
                responseTime: 0, // We don't track per-card duration in node session summary yet
                stability: schedulingResult.log.stability,
                difficulty: schedulingResult.log.difficulty,
                elapsedDays: schedulingResult.log.elapsed_days,
                scheduledDays: schedulingResult.log.scheduled_days,
                reviewedAt: now,
            });
        }

        upsertValues.push({
            id: cardId,
            userId,
            vocabularyId: r.vocabId,
            ...fsrsData,
            learningSteps: 0, // Simplified
            createdAt: cardMap.get(r.vocabId)?.createdAt || now,
        });
    }

    // 4. Batch Upsert Cards using primary key
    if (upsertValues.length > 0) {
        await db.insert(cards)
            .values(upsertValues)
            .onConflictDoUpdate({
                target: cards.id, // Use primary key for conflict detection
                set: {
                    state: sql`excluded.state`,
                    stability: sql`excluded.stability`,
                    difficulty: sql`excluded.difficulty`,
                    elapsedDays: sql`excluded.elapsed_days`,
                    scheduledDays: sql`excluded.scheduled_days`,
                    reps: sql`excluded.reps`,
                    lapses: sql`excluded.lapses`,
                    lastReview: sql`excluded.last_review`,
                    due: sql`excluded.due`,
                },
            });
    }

    // 5. Insert Review Logs (if generated)
    if (reviewLogsToInsert.length > 0) {
        await db.insert(reviewLogs).values(reviewLogsToInsert);
    }

    return { savedCount: upsertValues.length };
}

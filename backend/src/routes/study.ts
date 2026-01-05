import { Elysia, t } from 'elysia';
import { nanoid } from '../utils/nanoid';
import { db } from '../db/client';
import { cards, vocabulary, reviewLogs, studySessions } from '../db/schema';
import { eq, and, lte, asc, sql } from 'drizzle-orm';
import { getUserFromHeader } from '../middleware/auth';
import {
    createNewCard,
    dbCardToFSRS,
    fsrsCardToDb,
    scheduleReview,
    toRating,
    getSchedulingOptions
} from '../services/fsrs.service';

const study = new Elysia({ prefix: '/study' })
    .derive(({ headers }) => {
        const user = getUserFromHeader(headers);
        return { user };
    })

    // ==================== GET DUE CARDS ====================
    .get('/due', async ({ user, set, query }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const now = new Date();
        const limit = parseInt(query.limit || '20');

        // Get due cards for user
        const dueCards = await db
            .select({
                card: cards,
                vocab: vocabulary,
            })
            .from(cards)
            .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
            .where(and(
                eq(cards.userId, user.userId),
                lte(cards.due, now)
            ))
            .orderBy(asc(cards.due))
            .limit(limit);

        // Add scheduling options for each card
        const cardsWithOptions = dueCards.map(({ card, vocab }) => {
            const fsrsCard = dbCardToFSRS(card);
            const options = getSchedulingOptions(fsrsCard, now);

            return {
                id: card.id,
                vocabulary: vocab,
                state: card.state,
                reps: card.reps,
                lapses: card.lapses,
                schedulingOptions: {
                    again: { interval: options.again.card.scheduled_days },
                    hard: { interval: options.hard.card.scheduled_days },
                    good: { interval: options.good.card.scheduled_days },
                    easy: { interval: options.easy.card.scheduled_days },
                },
            };
        });

        return {
            cards: cardsWithOptions,
            count: cardsWithOptions.length,
        };
    }, {
        query: t.Object({
            limit: t.Optional(t.String()),
        })
    })

    // ==================== GET NEW CARDS TO LEARN ====================
    .get('/new', async ({ user, set, query }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const limit = parseInt(query.limit || '10');

        // Get vocabulary IDs that user already has cards for
        const existingCardVocabIds = await db
            .select({ vocabularyId: cards.vocabularyId })
            .from(cards)
            .where(eq(cards.userId, user.userId));

        const existingIds = existingCardVocabIds.map(c => c.vocabularyId);

        // Get new vocabulary words
        const newVocab = await db
            .select()
            .from(vocabulary)
            .where(existingIds.length > 0
                ? sql`${vocabulary.id} NOT IN (${sql.join(existingIds, sql`, `)})`
                : sql`1=1`
            )
            .limit(limit);

        return {
            vocabulary: newVocab,
            count: newVocab.length,
        };
    }, {
        query: t.Object({
            limit: t.Optional(t.String()),
        })
    })

    // ==================== START LEARNING NEW CARD ====================
    .post('/learn/:vocabularyId', async ({ user, set, params }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const vocabularyId = parseInt(params.vocabularyId);
        const now = new Date();

        // Check if card already exists
        const existingCard = await db.query.cards.findFirst({
            where: and(
                eq(cards.userId, user.userId),
                eq(cards.vocabularyId, vocabularyId)
            ),
        });

        if (existingCard) {
            set.status = 400;
            return { error: 'Card already exists for this vocabulary' };
        }

        // Create new FSRS card
        const fsrsCard = createNewCard(now);
        const cardData = fsrsCardToDb(fsrsCard);

        const cardId = nanoid();
        await db.insert(cards).values({
            id: cardId,
            userId: user.userId,
            vocabularyId,
            ...cardData,
            createdAt: now,
        });

        set.status = 201;
        return {
            message: 'Card created successfully',
            cardId,
        };
    }, {
        params: t.Object({
            vocabularyId: t.String(),
        })
    })

    // ==================== SUBMIT REVIEW ====================
    .post('/review', async ({ user, set, body }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { cardId, rating, studyMode, responseTime } = body;
        const now = new Date();

        // Get current card
        const card = await db.query.cards.findFirst({
            where: and(
                eq(cards.id, cardId),
                eq(cards.userId, user.userId)
            ),
        });

        if (!card) {
            set.status = 404;
            return { error: 'Card not found' };
        }

        // Convert to FSRS card and schedule
        const fsrsCard = dbCardToFSRS(card);
        const fsrsRating = toRating(rating);
        const result = scheduleReview(fsrsCard, fsrsRating, now);

        // Update card in database
        const updatedCard = fsrsCardToDb(result.card);
        await db
            .update(cards)
            .set(updatedCard)
            .where(eq(cards.id, cardId));

        // Create review log
        await db.insert(reviewLogs).values({
            id: nanoid(),
            cardId,
            userId: user.userId,
            rating,
            state: card.state,
            studyMode,
            responseTime,
            stability: result.log.stability,
            difficulty: result.log.difficulty,
            elapsedDays: result.log.elapsed_days,
            scheduledDays: result.log.scheduled_days,
            reviewedAt: now,
        });

        return {
            message: 'Review submitted',
            nextReview: result.card.due,
            interval: result.card.scheduled_days,
            newState: result.card.state,
        };
    }, {
        body: t.Object({
            cardId: t.String(),
            rating: t.Number({ minimum: 1, maximum: 4 }),
            studyMode: t.Union([
                t.Literal('reading'),
                t.Literal('typing'),
                t.Literal('listening'),
                t.Literal('multiple_choice'),
                t.Literal('cloze'),
                t.Literal('spelling_bee'),
            ]),
            responseTime: t.Optional(t.Number()),
        })
    })

    // ==================== START STUDY SESSION ====================
    .post('/session/start', async ({ user, set, body }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { mode, limit = 20 } = body;
        const now = new Date();

        const sessionId = nanoid();
        await db.insert(studySessions).values({
            id: sessionId,
            userId: user.userId,
            mode,
            startedAt: now,
        });

        // Get cards for session (due + some new)
        const dueCards = await db
            .select({
                card: cards,
                vocab: vocabulary,
            })
            .from(cards)
            .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
            .where(and(
                eq(cards.userId, user.userId),
                lte(cards.due, now)
            ))
            .orderBy(asc(cards.due))
            .limit(limit);

        return {
            sessionId,
            mode,
            cards: dueCards.map(({ card, vocab }) => ({
                id: card.id,
                vocabulary: vocab,
                state: card.state,
            })),
        };
    }, {
        body: t.Object({
            mode: t.Union([
                t.Literal('reading'),
                t.Literal('typing'),
                t.Literal('listening'),
                t.Literal('multiple_choice'),
                t.Literal('cloze'),
                t.Literal('spelling_bee'),
            ]),
            limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
        })
    })

    // ==================== COMPLETE STUDY SESSION ====================
    .post('/session/:sessionId/complete', async ({ user, set, params }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const sessionId = params.sessionId;
        const now = new Date();

        const session = await db.query.studySessions.findFirst({
            where: and(
                eq(studySessions.id, sessionId),
                eq(studySessions.userId, user.userId)
            ),
        });

        if (!session) {
            set.status = 404;
            return { error: 'Session not found' };
        }

        // Calculate duration
        const duration = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000);

        // Count reviews in this session
        const reviewCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(reviewLogs)
            .where(and(
                eq(reviewLogs.userId, user.userId),
                sql`${reviewLogs.reviewedAt} >= ${session.startedAt}`
            ));

        await db
            .update(studySessions)
            .set({
                completedAt: now,
                duration,
                cardsStudied: reviewCount[0]?.count || 0,
            })
            .where(eq(studySessions.id, sessionId));

        return {
            message: 'Session completed',
            duration,
            cardsStudied: reviewCount[0]?.count || 0,
        };
    }, {
        params: t.Object({
            sessionId: t.String(),
        })
    })

    // ==================== GET STUDY STATS ====================
    .get('/stats', async ({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Total cards
        const totalCards = await db
            .select({ count: sql<number>`count(*)` })
            .from(cards)
            .where(eq(cards.userId, user.userId));

        // Cards by state
        const cardsByState = await db
            .select({
                state: cards.state,
                count: sql<number>`count(*)`
            })
            .from(cards)
            .where(eq(cards.userId, user.userId))
            .groupBy(cards.state);

        // Reviews today
        const reviewsToday = await db
            .select({ count: sql<number>`count(*)` })
            .from(reviewLogs)
            .where(and(
                eq(reviewLogs.userId, user.userId),
                sql`${reviewLogs.reviewedAt} >= ${todayStart}`
            ));

        // Due today
        const dueToday = await db
            .select({ count: sql<number>`count(*)` })
            .from(cards)
            .where(and(
                eq(cards.userId, user.userId),
                lte(cards.due, now)
            ));

        return {
            totalCards: totalCards[0]?.count || 0,
            cardsByState: cardsByState.reduce((acc, { state, count }) => {
                const stateName = ['new', 'learning', 'review', 'relearning'][state] || 'unknown';
                acc[stateName] = count;
                return acc;
            }, {} as Record<string, number>),
            reviewsToday: reviewsToday[0]?.count || 0,
            dueToday: dueToday[0]?.count || 0,
        };
    })

    // ==================== GET PROGRESS STATS (for charts) ====================
    .get('/stats/progress', async ({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const now = new Date();

        // Get last 7 days data
        const days = 7;
        const dailyStats = [];

        for (let i = days - 1; i >= 0; i--) {
            const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);

            // Reviews on this day
            const dayReviews = await db
                .select({
                    count: sql<number>`count(*)`,
                    correct: sql<number>`sum(case when rating >= 3 then 1 else 0 end)`
                })
                .from(reviewLogs)
                .where(and(
                    eq(reviewLogs.userId, user.userId),
                    sql`${reviewLogs.reviewedAt} >= ${dayStart}`,
                    sql`${reviewLogs.reviewedAt} < ${dayEnd}`
                ));

            const reviews = dayReviews[0]?.count || 0;
            const correct = dayReviews[0]?.correct || 0;
            const accuracy = reviews > 0 ? Math.round((correct / reviews) * 100) : 0;

            dailyStats.push({
                date: dayStart.toISOString().split('T')[0],
                dayName: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
                reviews,
                correct,
                accuracy,
            });
        }

        // Calculate streak (consecutive days with reviews)
        let streak = 0;
        for (let i = dailyStats.length - 1; i >= 0; i--) {
            if (dailyStats[i].reviews > 0) {
                streak++;
            } else if (i < dailyStats.length - 1) {
                // Allow today to have 0 reviews (user might not have studied yet today)
                break;
            }
        }

        // Overall accuracy (last 7 days)
        const totalReviews = dailyStats.reduce((sum, d) => sum + d.reviews, 0);
        const totalCorrect = dailyStats.reduce((sum, d) => sum + d.correct, 0);
        const overallAccuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;

        // Best day
        const bestDay = dailyStats.reduce((best, d) =>
            d.reviews > (best?.reviews || 0) ? d : best
            , dailyStats[0]);

        return {
            streak,
            overallAccuracy,
            totalReviews,
            bestDay: bestDay?.dayName || 'N/A',
            dailyStats,
        };
    });

export default study;

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from '../utils/nanoid';
import { db } from '../db/client';
import { cards, vocabulary, reviewLogs, studySessions } from '../db/schema';
import { eq, and, lte, asc, sql } from 'drizzle-orm';
import { authMiddleware, getCurrentUser } from '../middleware/auth';
import {
    createNewCard,
    dbCardToFSRS,
    fsrsCardToDb,
    scheduleReview,
    toRating,
    getSchedulingOptions
} from '../services/fsrs.service';

const study = new Hono();

// Apply auth middleware to all routes
study.use('*', authMiddleware);

// Validation schemas
const reviewSchema = z.object({
    cardId: z.string(),
    rating: z.number().min(1).max(4),
    studyMode: z.enum(['reading', 'typing', 'listening', 'multiple_choice', 'cloze', 'spelling_bee']),
    responseTime: z.number().optional(),
});

const sessionStartSchema = z.object({
    mode: z.enum(['reading', 'typing', 'listening', 'multiple_choice', 'cloze', 'spelling_bee']),
    limit: z.number().min(1).max(100).optional().default(20),
});

// ==================== GET DUE CARDS ====================
study.get('/due', async (c) => {
    const { userId } = getCurrentUser(c);
    const now = new Date();
    const limit = parseInt(c.req.query('limit') || '20');

    // Get due cards for user
    const dueCards = await db
        .select({
            card: cards,
            vocab: vocabulary,
        })
        .from(cards)
        .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
        .where(and(
            eq(cards.userId, userId),
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

    return c.json({
        cards: cardsWithOptions,
        count: cardsWithOptions.length,
    });
});

// ==================== GET NEW CARDS TO LEARN ====================
study.get('/new', async (c) => {
    const { userId } = getCurrentUser(c);
    const limit = parseInt(c.req.query('limit') || '10');

    // Get vocabulary IDs that user already has cards for
    const existingCardVocabIds = await db
        .select({ vocabularyId: cards.vocabularyId })
        .from(cards)
        .where(eq(cards.userId, userId));

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

    return c.json({
        vocabulary: newVocab,
        count: newVocab.length,
    });
});

// ==================== START LEARNING NEW CARD ====================
study.post('/learn/:vocabularyId', async (c) => {
    const { userId } = getCurrentUser(c);
    const vocabularyId = parseInt(c.req.param('vocabularyId'));
    const now = new Date();

    // Check if card already exists
    const existingCard = await db.query.cards.findFirst({
        where: and(
            eq(cards.userId, userId),
            eq(cards.vocabularyId, vocabularyId)
        ),
    });

    if (existingCard) {
        return c.json({ error: 'Card already exists for this vocabulary' }, 400);
    }

    // Create new FSRS card
    const fsrsCard = createNewCard(now);
    const cardData = fsrsCardToDb(fsrsCard);

    const cardId = nanoid();
    await db.insert(cards).values({
        id: cardId,
        userId,
        vocabularyId,
        ...cardData,
        createdAt: now,
    });

    return c.json({
        message: 'Card created successfully',
        cardId,
    }, 201);
});

// ==================== SUBMIT REVIEW ====================
study.post('/review', zValidator('json', reviewSchema), async (c) => {
    const { userId } = getCurrentUser(c);
    const { cardId, rating, studyMode, responseTime } = c.req.valid('json');
    const now = new Date();

    // Get current card
    const card = await db.query.cards.findFirst({
        where: and(
            eq(cards.id, cardId),
            eq(cards.userId, userId)
        ),
    });

    if (!card) {
        return c.json({ error: 'Card not found' }, 404);
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
        userId,
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

    return c.json({
        message: 'Review submitted',
        nextReview: result.card.due,
        interval: result.card.scheduled_days,
        newState: result.card.state,
    });
});

// ==================== START STUDY SESSION ====================
study.post('/session/start', zValidator('json', sessionStartSchema), async (c) => {
    const { userId } = getCurrentUser(c);
    const { mode, limit } = c.req.valid('json');
    const now = new Date();

    const sessionId = nanoid();
    await db.insert(studySessions).values({
        id: sessionId,
        userId,
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
            eq(cards.userId, userId),
            lte(cards.due, now)
        ))
        .orderBy(asc(cards.due))
        .limit(limit);

    return c.json({
        sessionId,
        mode,
        cards: dueCards.map(({ card, vocab }) => ({
            id: card.id,
            vocabulary: vocab,
            state: card.state,
        })),
    });
});

// ==================== COMPLETE STUDY SESSION ====================
study.post('/session/:sessionId/complete', async (c) => {
    const { userId } = getCurrentUser(c);
    const sessionId = c.req.param('sessionId');
    const now = new Date();

    const session = await db.query.studySessions.findFirst({
        where: and(
            eq(studySessions.id, sessionId),
            eq(studySessions.userId, userId)
        ),
    });

    if (!session) {
        return c.json({ error: 'Session not found' }, 404);
    }

    // Calculate duration
    const duration = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000);

    // Count reviews in this session
    const reviewCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(reviewLogs)
        .where(and(
            eq(reviewLogs.userId, userId),
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

    return c.json({
        message: 'Session completed',
        duration,
        cardsStudied: reviewCount[0]?.count || 0,
    });
});

// ==================== GET STUDY STATS ====================
study.get('/stats', async (c) => {
    const { userId } = getCurrentUser(c);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Total cards
    const totalCards = await db
        .select({ count: sql<number>`count(*)` })
        .from(cards)
        .where(eq(cards.userId, userId));

    // Cards by state
    const cardsByState = await db
        .select({
            state: cards.state,
            count: sql<number>`count(*)`
        })
        .from(cards)
        .where(eq(cards.userId, userId))
        .groupBy(cards.state);

    // Reviews today
    const reviewsToday = await db
        .select({ count: sql<number>`count(*)` })
        .from(reviewLogs)
        .where(and(
            eq(reviewLogs.userId, userId),
            sql`${reviewLogs.reviewedAt} >= ${todayStart}`
        ));

    // Due today
    const dueToday = await db
        .select({ count: sql<number>`count(*)` })
        .from(cards)
        .where(and(
            eq(cards.userId, userId),
            lte(cards.due, now)
        ));

    return c.json({
        totalCards: totalCards[0]?.count || 0,
        cardsByState: cardsByState.reduce((acc, { state, count }) => {
            const stateName = ['new', 'learning', 'review', 'relearning'][state] || 'unknown';
            acc[stateName] = count;
            return acc;
        }, {} as Record<string, number>),
        reviewsToday: reviewsToday[0]?.count || 0,
        dueToday: dueToday[0]?.count || 0,
    });
});

// ==================== GET PROGRESS STATS (for charts) ====================
study.get('/stats/progress', async (c) => {
    const { userId } = getCurrentUser(c);
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
                eq(reviewLogs.userId, userId),
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

    return c.json({
        streak,
        overallAccuracy,
        totalReviews,
        bestDay: bestDay?.dayName || 'N/A',
        dailyStats,
    });
});

export default study;


import { Elysia, t } from 'elysia';
import { nanoid } from '../utils/nanoid';
import { db } from '../db/client';
import { cards, vocabulary, reviewLogs, studySessions } from '../db/schema';
import { eq, and, lte, asc, sql, like, gte } from 'drizzle-orm';
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

    // ==================== GET STUDY QUEUE (Tree Model) ====================
    // Priority: Relearning → Learning → Review → New
    .get('/queue', async ({ user, set, query }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dailyNewLimit = parseInt(query.dailyLimit || '20');
        const deck = query.deck;

        // Build deck filter if specified (return always-true condition if no deck)
        const deckFilter = deck ? like(vocabulary.tag, `%${deck}%`) : sql`1=1`;

        // 0. Relearning cards (forgot - highest priority!)
        const relearningCards = await db
            .select({ card: cards, vocab: vocabulary })
            .from(cards)
            .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
            .where(and(
                eq(cards.userId, user.userId),
                eq(cards.state, 3), // Relearning
                lte(cards.due, now),
                deckFilter
            ))
            .orderBy(asc(cards.due))
            .limit(50);

        // 1. Learning cards (seedlings) - need frequent attention
        const learningCards = await db
            .select({ card: cards, vocab: vocabulary })
            .from(cards)
            .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
            .where(and(
                eq(cards.userId, user.userId),
                eq(cards.state, 1), // Learning
                lte(cards.due, now),
                deckFilter
            ))
            .orderBy(asc(cards.due))
            .limit(50);

        // 2. Review cards (trees needing maintenance)
        const reviewCards = await db
            .select({ card: cards, vocab: vocabulary })
            .from(cards)
            .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
            .where(and(
                eq(cards.userId, user.userId),
                eq(cards.state, 2), // Review
                lte(cards.due, now),
                deckFilter
            ))
            .orderBy(asc(cards.due))
            .limit(50);

        // 3. Count NEW cards (state=0) that were started today (to track daily quota)
        // We count cards that transitioned FROM new state today (not all cards created)
        const newCardsTodayResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(cards)
            .where(and(
                eq(cards.userId, user.userId),
                eq(cards.state, 0), // Still in New state
                gte(cards.createdAt, todayStart)
            ));
        // Count is cards created today that are STILL new (not yet studied)
        // For quota, we want cards that WERE new but now are Learning/Review
        const studiedTodayResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(cards)
            .where(and(
                eq(cards.userId, user.userId),
                sql`${cards.state} > 0`, // Learning, Review, or Relearning
                gte(cards.createdAt, todayStart) // Created today
            ));
        const studiedToday = studiedTodayResult[0]?.count || 0;

        // 4. Calculate remaining quota for new cards
        // Simple: just limit new cards to dailyNewLimit per session
        const hasAnyDueCards = relearningCards.length > 0 || learningCards.length > 0 || reviewCards.length > 0;

        // 5. New cards limit logic:
        // - Always respect dailyNewLimit from user settings
        // - If there are due cards, we still show new cards but user might want to focus on reviews first
        const effectiveLimit = dailyNewLimit;

        const newCards = await db
            .select({ card: cards, vocab: vocabulary })
            .from(cards)
            .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
            .where(and(
                eq(cards.userId, user.userId),
                eq(cards.state, 0), // New
                deckFilter
            ))
            .orderBy(asc(cards.createdAt))
            .limit(effectiveLimit);

        // 6. Count total New cards available
        const totalNewResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(cards)
            .where(and(
                eq(cards.userId, user.userId),
                eq(cards.state, 0)
            ));
        const totalNew = totalNewResult[0]?.count || 0;

        // Format cards for response
        const formatCards = (items: { card: typeof cards.$inferSelect; vocab: typeof vocabulary.$inferSelect }[]) =>
            items.map(({ card, vocab }) => ({
                id: card.id,
                vocabulary: vocab,
                state: card.state,
            }));

        // Count ALL cards by state (not just due) for Progress UI
        const totalRelearningResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(cards)
            .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
            .where(and(eq(cards.userId, user.userId), eq(cards.state, 3), deckFilter));
        const totalLearningResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(cards)
            .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
            .where(and(eq(cards.userId, user.userId), eq(cards.state, 1), deckFilter));
        const totalReviewResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(cards)
            .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
            .where(and(eq(cards.userId, user.userId), eq(cards.state, 2), deckFilter));

        return {
            relearning: formatCards(relearningCards), // ลืมแล้ว ต้องรีบกลับมา
            learning: formatCards(learningCards),     // รดน้ำต้นอ่อน
            due: formatCards(reviewCards),            // บำรุงต้นไม้
            new: formatCards(newCards),               // ปลูกใหม่ (ตาม quota)
            counts: {
                relearning: relearningCards.length,
                learning: learningCards.length,
                due: reviewCards.length,
                new: newCards.length,
                totalNew: totalNew,
            },
            // Total cards in each state (for DeckPage Progress UI)
            totalByState: {
                relearning: totalRelearningResult[0]?.count || 0,
                learning: totalLearningResult[0]?.count || 0,
                review: totalReviewResult[0]?.count || 0,
                new: totalNew,
            },
            quota: {
                daily: dailyNewLimit,
                used: studiedToday,
                remaining: effectiveLimit,
            },
            needMoreSeeds: totalNew < 10,
        };
    }, {
        query: t.Object({
            dailyLimit: t.Optional(t.String()),
            deck: t.Optional(t.String()),
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

    // ==================== BULK LEARN FROM DECK (Add Seeds) ====================
    .post('/learn-deck', async ({ user, set, body }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { deck, limit = 20 } = body;
        const now = new Date();

        // Check how many New cards (seeds) user already has
        const existingNewCountResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(cards)
            .where(and(
                eq(cards.userId, user.userId),
                eq(cards.state, 0)
            ));
        const existingNewCount = existingNewCountResult[0]?.count || 0;

        // Use the user's limit from settings instead of hardcoded 20
        const targetSeeds = limit;
        if (existingNewCount >= targetSeeds) {
            return {
                message: `Already have ${existingNewCount} new cards (seeds) ready to learn`,
                added: 0,
                existing: existingNewCount,
            };
        }

        // Calculate how many seeds to add
        const toAdd = Math.min(limit, targetSeeds - existingNewCount);

        // Get vocabulary from deck that user doesn't have cards for yet
        const existingCardVocabIds = await db
            .select({ vocabularyId: cards.vocabularyId })
            .from(cards)
            .where(eq(cards.userId, user.userId));

        const existingIds = new Set(existingCardVocabIds.map(c => c.vocabularyId));

        // Get vocabulary matching deck tag
        const deckVocab = await db
            .select()
            .from(vocabulary)
            .where(like(vocabulary.tag, `%${deck}%`))
            .limit(toAdd + existingIds.size); // Fetch extra to account for filtering

        // Filter out vocabulary user already has
        const newVocab = deckVocab.filter(v => !existingIds.has(v.id)).slice(0, toAdd);

        if (newVocab.length === 0) {
            return {
                message: 'No new vocabulary to add from this deck',
                added: 0,
            };
        }

        // Create cards for each vocabulary
        const cardsToInsert = newVocab.map(vocab => {
            const fsrsCard = createNewCard(now);
            const cardData = fsrsCardToDb(fsrsCard);
            return {
                id: nanoid(),
                userId: user.userId,
                vocabularyId: vocab.id,
                ...cardData,
                createdAt: now,
            };
        });

        // Batch insert cards
        await db.insert(cards).values(cardsToInsert);

        set.status = 201;
        return {
            message: `Added ${cardsToInsert.length} cards from ${deck} deck`,
            added: cardsToInsert.length,
            vocabulary: newVocab.map(v => ({ id: v.id, word: v.word })),
        };
    }, {
        body: t.Object({
            deck: t.String(),
            limit: t.Optional(t.Number({ minimum: 1, maximum: 500, default: 50 })),
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
                t.Literal('spelling'),
                t.Literal('audio_choice'),
                t.Literal('multi'),
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
                t.Literal('audio_choice'),
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
    .get('/stats', async ({ user, set, query }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const deck = query.deck;

        // Total cards - filter by deck if provided
        let totalCards;
        if (deck) {
            // Count only cards whose vocabulary belongs to this deck
            totalCards = await db
                .select({ count: sql<number>`count(*)` })
                .from(cards)
                .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
                .where(and(
                    eq(cards.userId, user.userId),
                    like(vocabulary.tag, `%${deck}%`)
                ));
        } else {
            totalCards = await db
                .select({ count: sql<number>`count(*)` })
                .from(cards)
                .where(eq(cards.userId, user.userId));
        }

        // Cards by state
        const cardsByState = await db
            .select({
                state: cards.state,
                count: sql<number>`count(*)`
            })
            .from(cards)
            .where(eq(cards.userId, user.userId))
            .groupBy(cards.state);

        // Reviews today - count UNIQUE cards studied today (not total interactions)
        const todayStartTimestamp = Math.floor(todayStart.getTime() / 1000);
        const reviewsToday = await db
            .select({ count: sql<number>`count(DISTINCT ${reviewLogs.cardId})` })
            .from(reviewLogs)
            .where(and(
                eq(reviewLogs.userId, user.userId),
                sql`${reviewLogs.reviewedAt} >= ${todayStartTimestamp}`
            ));

        // Due today
        const dueToday = await db
            .select({ count: sql<number>`count(*)` })
            .from(cards)
            .where(and(
                eq(cards.userId, user.userId),
                lte(cards.due, now)
            ));

        // Next due card (for countdown timer)
        const nextDueCard = await db
            .select({ due: cards.due })
            .from(cards)
            .where(and(
                eq(cards.userId, user.userId),
                sql`${cards.due} > ${Math.floor(now.getTime() / 1000)}`
            ))
            .orderBy(asc(cards.due))
            .limit(1);

        const nextDueTime = nextDueCard[0]?.due
            ? new Date(nextDueCard[0].due).toISOString()
            : null;

        return {
            totalCards: totalCards[0]?.count || 0,
            cardsByState: cardsByState.reduce((acc, { state, count }) => {
                const stateName = ['new', 'learning', 'review', 'relearning'][state] || 'unknown';
                acc[stateName] = count;
                return acc;
            }, {} as Record<string, number>),
            reviewsToday: reviewsToday[0]?.count || 0,
            dueToday: dueToday[0]?.count || 0,
            nextDueTime,
        };
    }, {
        query: t.Object({
            deck: t.Optional(t.String()),
        })
    })

    // ==================== GET PROGRESS STATS (for charts) ====================
    .get('/stats/progress', async ({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const now = new Date();

        // Get last 270 days data (9 months for heatmap)
        const days = 270;
        const dailyStats = [];

        // Batch query for all days at once for better performance
        const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);

        const allReviews = await db
            .select({
                date: sql<string>`date(${reviewLogs.reviewedAt}, 'unixepoch')`,
                count: sql<number>`count(*)`,
                correct: sql<number>`sum(case when rating >= 3 then 1 else 0 end)`
            })
            .from(reviewLogs)
            .where(and(
                eq(reviewLogs.userId, user.userId),
                sql`${reviewLogs.reviewedAt} >= ${Math.floor(startDate.getTime() / 1000)}`
            ))
            .groupBy(sql`date(${reviewLogs.reviewedAt}, 'unixepoch')`);

        // Create a map for quick lookup
        const reviewsMap = new Map<string, { count: number; correct: number }>();
        allReviews.forEach(r => {
            reviewsMap.set(r.date, { count: r.count, correct: r.correct || 0 });
        });

        // Build daily stats array
        for (let i = days - 1; i >= 0; i--) {
            const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const dateStr = dayStart.toISOString().split('T')[0];

            const dayData = reviewsMap.get(dateStr) || { count: 0, correct: 0 };
            const reviews = dayData.count;
            const correct = dayData.correct;
            const accuracy = reviews > 0 ? Math.round((correct / reviews) * 100) : 0;

            dailyStats.push({
                date: dateStr,
                dayName: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
                reviews,
                correct,
                accuracy,
            });
        }

        // Calculate streak (consecutive days with reviews, checking from today backwards)
        let streak = 0;
        for (let i = dailyStats.length - 1; i >= 0; i--) {
            if (dailyStats[i].reviews > 0) {
                streak++;
            } else if (i < dailyStats.length - 1) {
                // Allow today to have 0 reviews (user might not have studied yet today)
                break;
            }
        }

        // Overall accuracy (last 7 days for display)
        const last7Days = dailyStats.slice(-7);
        const totalReviews = last7Days.reduce((sum, d) => sum + d.reviews, 0);
        const totalCorrect = last7Days.reduce((sum, d) => sum + d.correct, 0);
        const overallAccuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;

        // Best day (last 7 days)
        const bestDay = last7Days.reduce((best, d) =>
            d.reviews > (best?.reviews || 0) ? d : best
            , last7Days[0]);

        return {
            streak,
            overallAccuracy,
            totalReviews,
            bestDay: bestDay?.dayName || 'N/A',
            dailyStats,
        };
    })

    // ==================== LEARNING ANALYTICS ====================
    .get('/analytics', async ({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        // ==================== 1. WEAK WORDS (Top 5 highest fail rate) ====================
        // Cards with most "Again" ratings (rating = 1)
        const weakWordsQuery = await db
            .select({
                cardId: reviewLogs.cardId,
                totalReviews: sql<number>`COUNT(*)`,
                failCount: sql<number>`SUM(CASE WHEN ${reviewLogs.rating} = 1 THEN 1 ELSE 0 END)`,
            })
            .from(reviewLogs)
            .where(eq(reviewLogs.userId, user.userId))
            .groupBy(reviewLogs.cardId)
            .having(sql`COUNT(*) >= 2`) // At least 2 reviews to be meaningful
            .orderBy(sql`CAST(SUM(CASE WHEN ${reviewLogs.rating} = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) DESC`)
            .limit(5);

        // Get card and vocabulary details for weak words
        const weakWords = await Promise.all(
            weakWordsQuery.map(async (ww) => {
                const cardData = await db
                    .select({
                        card: cards,
                        vocab: vocabulary,
                    })
                    .from(cards)
                    .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
                    .where(eq(cards.id, ww.cardId))
                    .limit(1);

                if (!cardData[0]) return null;

                const failRate = ww.totalReviews > 0
                    ? Math.round((ww.failCount / ww.totalReviews) * 100)
                    : 0;
                const stability = Math.round(cardData[0].card.stability * 10); // Scale to 0-100

                return {
                    id: cardData[0].vocab.id,
                    word: cardData[0].vocab.word,
                    meaning: cardData[0].vocab.defTh || cardData[0].vocab.defEn || '',
                    stability: Math.min(stability, 100),
                    failRate,
                    totalReviews: ww.totalReviews,
                };
            })
        );

        // ==================== 2. MODE PERFORMANCE (Accuracy by study mode) ====================
        const modePerformance = await db
            .select({
                mode: reviewLogs.studyMode,
                totalReviews: sql<number>`COUNT(*)`,
                correctCount: sql<number>`SUM(CASE WHEN ${reviewLogs.rating} >= 3 THEN 1 ELSE 0 END)`,
            })
            .from(reviewLogs)
            .where(eq(reviewLogs.userId, user.userId))
            .groupBy(reviewLogs.studyMode);

        const modePerformanceData = modePerformance.map((mp) => ({
            mode: formatModeName(mp.mode),
            modeKey: mp.mode,
            accuracy: mp.totalReviews > 0
                ? Math.round((mp.correctCount / mp.totalReviews) * 100)
                : 0,
            totalReviews: mp.totalReviews,
            fullMark: 100,
        }));

        // ==================== 3. BEST TIME TO STUDY (Hourly accuracy) ====================
        const hourlyPerformance = await db
            .select({
                hour: sql<number>`CAST(strftime('%H', datetime(${reviewLogs.reviewedAt}, 'unixepoch', 'localtime')) AS INTEGER)`,
                totalReviews: sql<number>`COUNT(*)`,
                correctCount: sql<number>`SUM(CASE WHEN ${reviewLogs.rating} >= 3 THEN 1 ELSE 0 END)`,
            })
            .from(reviewLogs)
            .where(eq(reviewLogs.userId, user.userId))
            .groupBy(sql`strftime('%H', datetime(${reviewLogs.reviewedAt}, 'unixepoch', 'localtime'))`)
            .orderBy(sql`CAST(strftime('%H', datetime(${reviewLogs.reviewedAt}, 'unixepoch', 'localtime')) AS INTEGER)`);

        const hourlyData = hourlyPerformance.map((hp) => ({
            hour: hp.hour,
            label: formatHour(hp.hour),
            accuracy: hp.totalReviews > 0
                ? Math.round((hp.correctCount / hp.totalReviews) * 100)
                : 0,
            reviews: hp.totalReviews,
        }));

        // Find peak hour
        const peakHour = hourlyData.reduce((max, curr) =>
            curr.accuracy > (max?.accuracy || 0) ? curr : max,
            hourlyData[0] || null
        );

        // ==================== SUMMARY STATS ====================
        const totalReviewsResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(reviewLogs)
            .where(eq(reviewLogs.userId, user.userId));

        const totalCorrectResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(reviewLogs)
            .where(and(
                eq(reviewLogs.userId, user.userId),
                sql`${reviewLogs.rating} >= 3`
            ));

        const overallAccuracy = totalReviewsResult[0]?.count > 0
            ? Math.round((totalCorrectResult[0]?.count / totalReviewsResult[0]?.count) * 100)
            : 0;

        return {
            weakWords: weakWords.filter(Boolean),
            modePerformance: modePerformanceData,
            hourlyPerformance: hourlyData,
            peakHour,
            summary: {
                totalReviews: totalReviewsResult[0]?.count || 0,
                overallAccuracy,
                strongestMode: modePerformanceData.reduce((max, curr) =>
                    curr.accuracy > (max?.accuracy || 0) ? curr : max,
                    modePerformanceData[0] || null
                ),
                weakestMode: modePerformanceData.reduce((min, curr) =>
                    curr.accuracy < (min?.accuracy || 100) ? curr : min,
                    modePerformanceData[0] || null
                ),
            },
        };
    });

// Helper functions for analytics
function formatModeName(mode: string): string {
    const modeNames: Record<string, string> = {
        reading: 'Reading',
        typing: 'Typing',
        listening: 'Listening',
        multiple_choice: 'Multiple Choice',
        cloze: 'Cloze',
        spelling_bee: 'Spelling Bee',
        spelling: 'Spelling',
        audio_choice: 'Audio Choice',
        multi: 'Multi-Mode',
    };
    return modeNames[mode] || mode;
}

function formatHour(hour: number): string {
    if (hour === 0) return '12AM';
    if (hour === 12) return '12PM';
    if (hour < 12) return `${hour}AM`;
    return `${hour - 12}PM`;
}

export default study;

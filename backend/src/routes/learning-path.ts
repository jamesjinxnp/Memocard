/**
 * Learning Path Routes
 * 
 * API endpoints for the Gamified Learning Path system.
 * Follows RESTful design with proper HTTP status codes.
 */

import { Elysia, t } from 'elysia';
import { db } from '../db/client';
import {
    levels,
    units,
    nodes,
    nodeVocabulary,
    userProgress,
    vocabulary,
    cards,
} from '../db/schema';
import { eq, and, lte, gte, inArray, asc, sql } from 'drizzle-orm';
import { getUserFromHeader } from '../middleware/auth';
import { nanoid } from '../utils/nanoid';

// ==================== Types ====================

export interface NodeProgressMap {
    [nodeId: string]: {
        status: 'locked' | 'available' | 'completed';
        stars: number;
        crowns: number;
    };
}

// ==================== Helpers ====================

/**
 * Calculate stars based on accuracy and speed
 */
function calculateStars(correctCount: number, totalCards: number, responseTimeMs: number): number {
    const accuracy = totalCards > 0 ? correctCount / totalCards : 0;
    const avgSpeed = totalCards > 0 ? responseTimeMs / totalCards : Infinity;

    if (accuracy >= 0.95 && avgSpeed < 3000) return 3; // ⭐⭐⭐ Perfect
    if (accuracy >= 0.80 && avgSpeed < 5000) return 2; // ⭐⭐ Good
    if (accuracy >= 0.60) return 1; // ⭐ Pass
    return 0; // No stars (need retry)
}

/**
 * Convert status number to string
 */
function statusToString(status: number): 'locked' | 'available' | 'completed' {
    switch (status) {
        case 0: return 'locked';
        case 1: return 'available';
        case 2: return 'completed';
        default: return 'locked';
    }
}

// ==================== Routes ====================

const learningPath = new Elysia({ prefix: '/path' })
    .derive(({ headers }) => {
        const user = getUserFromHeader(headers);
        return { user };
    })

    // ==================== GET FULL LEARNING PATH STRUCTURE ====================
    // GET /path/:deckId
    .get('/:deckId', async ({ params, set }) => {
        const { deckId } = params;

        // Use Drizzle relational query to fetch nested data in one query
        const levelsData = await db.query.levels.findMany({
            where: eq(levels.deckId, deckId),
            orderBy: [asc(levels.order)],
            with: {
                units: {
                    orderBy: [asc(units.order)],
                    with: {
                        nodes: {
                            orderBy: [asc(nodes.order)],
                            with: {
                                nodeVocabulary: true,
                            },
                        },
                    },
                },
            },
        });

        if (levelsData.length === 0) {
            set.status = 404;
            return { error: 'Deck not found or has no learning path' };
        }

        // Transform to API response format
        const response = {
            deckId,
            levels: levelsData.map((level) => ({
                id: level.id,
                name: level.name,
                description: level.description,
                order: level.order,
                theme: level.theme,
                requiredCrowns: level.requiredCrowns,
                units: level.units.map((unit) => ({
                    id: unit.id,
                    name: unit.name,
                    description: unit.description,
                    order: unit.order,
                    icon: unit.icon,
                    color: unit.color,
                    nodes: unit.nodes.map((node) => ({
                        id: node.id,
                        type: node.type,
                        order: node.order,
                        vocabCount: node.nodeVocabulary.length,
                    })),
                })),
            })),
            stats: {
                totalLevels: levelsData.length,
                totalUnits: levelsData.reduce((sum, l) => sum + l.units.length, 0),
                totalNodes: levelsData.reduce(
                    (sum, l) => sum + l.units.reduce((s, u) => s + u.nodes.length, 0),
                    0
                ),
            },
        };

        return response;
    }, {
        params: t.Object({
            deckId: t.String(),
        }),
    })

    // ==================== GET USER PROGRESS ====================
    // GET /path/:deckId/progress
    .get('/:deckId/progress', async ({ params, user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { deckId } = params;

        // Get all nodes for this deck to know total
        const allNodes = await db
            .select({ nodeId: nodes.id })
            .from(nodes)
            .innerJoin(units, eq(nodes.unitId, units.id))
            .innerJoin(levels, eq(units.levelId, levels.id))
            .where(eq(levels.deckId, deckId));

        if (allNodes.length === 0) {
            set.status = 404;
            return { error: 'Deck not found' };
        }

        const nodeIds = allNodes.map((n) => n.nodeId);

        // Get user's progress for all nodes
        const progressData = await db
            .select()
            .from(userProgress)
            .where(
                and(
                    eq(userProgress.userId, user.userId),
                    inArray(userProgress.nodeId, nodeIds)
                )
            );

        // Build progress map
        const nodeProgressMap: NodeProgressMap = {};
        let completedNodes = 0;
        let totalStars = 0;
        let totalCrowns = 0;

        // Initialize all nodes as locked
        for (const nodeId of nodeIds) {
            nodeProgressMap[nodeId.toString()] = {
                status: 'locked',
                stars: 0,
                crowns: 0,
            };
        }

        // First node should always be available if no progress exists
        if (nodeIds.length > 0) {
            const firstNodeId = nodeIds[0];
            nodeProgressMap[firstNodeId.toString()].status = 'available';
        }

        // Overlay actual progress
        for (const progress of progressData) {
            nodeProgressMap[progress.nodeId.toString()] = {
                status: statusToString(progress.status),
                stars: progress.stars,
                crowns: progress.crowns,
            };

            if (progress.status === 2) {
                completedNodes++;
                totalStars += progress.stars;
                totalCrowns += progress.crowns;

                // If this node is completed, unlock the next one
                const nodeIndex = nodeIds.indexOf(progress.nodeId);
                if (nodeIndex >= 0 && nodeIndex < nodeIds.length - 1) {
                    const nextNodeId = nodeIds[nodeIndex + 1];
                    const nextNodeProgress = nodeProgressMap[nextNodeId.toString()];
                    if (nextNodeProgress.status === 'locked') {
                        nodeProgressMap[nextNodeId.toString()].status = 'available';
                    }
                }
            }
        }

        return {
            deckId,
            totalNodes: allNodes.length,
            completedNodes,
            totalStars,
            totalCrowns,
            nodeProgress: nodeProgressMap,
        };
    }, {
        params: t.Object({
            deckId: t.String(),
        }),
    })

    // ==================== GET DUE CARDS FOR DECK (FSRS Review Button) ====================
    // GET /path/:deckId/due
    .get('/:deckId/due', async ({ params, user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { deckId } = params;
        const now = new Date();

        // 1. Get all unlocked nodes for this user in this deck (status >= 1)
        const unlockedNodes = await db
            .select({ nodeId: userProgress.nodeId })
            .from(userProgress)
            .innerJoin(nodes, eq(userProgress.nodeId, nodes.id))
            .innerJoin(units, eq(nodes.unitId, units.id))
            .innerJoin(levels, eq(units.levelId, levels.id))
            .where(
                and(
                    eq(userProgress.userId, user.userId),
                    eq(levels.deckId, deckId),
                    gte(userProgress.status, 1) // 1=available, 2=completed
                )
            );

        if (unlockedNodes.length === 0) {
            // No unlocked nodes yet
            return {
                deckId,
                totalDue: 0,
                relearningCount: 0,
                learningCount: 0,
                reviewCount: 0,
                cards: [],
            };
        }

        const nodeIds = unlockedNodes.map((n) => n.nodeId);

        // 2. Get vocabulary IDs from those nodes
        const vocabData = await db
            .select({ vocabularyId: nodeVocabulary.vocabularyId })
            .from(nodeVocabulary)
            .where(inArray(nodeVocabulary.nodeId, nodeIds));

        if (vocabData.length === 0) {
            return {
                deckId,
                totalDue: 0,
                relearningCount: 0,
                learningCount: 0,
                reviewCount: 0,
                cards: [],
            };
        }

        const vocabIds = vocabData.map((v) => v.vocabularyId);

        // 3. Get due cards for those vocabulary
        const dueCards = await db
            .select({
                card: cards,
                vocab: vocabulary,
            })
            .from(cards)
            .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
            .where(
                and(
                    eq(cards.userId, user.userId),
                    inArray(cards.vocabularyId, vocabIds),
                    lte(cards.due, now)
                )
            )
            .orderBy(asc(cards.due));

        // Count by state
        let relearningCount = 0;
        let learningCount = 0;
        let reviewCount = 0;

        for (const { card } of dueCards) {
            switch (card.state) {
                case 1:
                    learningCount++;
                    break;
                case 2:
                    reviewCount++;
                    break;
                case 3:
                    relearningCount++;
                    break;
            }
        }

        return {
            deckId,
            totalDue: dueCards.length,
            relearningCount,
            learningCount,
            reviewCount,
            cards: dueCards.map(({ card, vocab }) => ({
                cardId: card.id,
                vocabularyId: vocab.id,
                word: vocab.word,
                definition: vocab.defEn || vocab.defTh,
                example: vocab.example,
                pronunciation: vocab.ipaUs || vocab.ipaUk,
                imageUrl: vocab.imageUrl,
                cefr: vocab.cefr,
                partOfSpeech: vocab.type,
                due: card.due,
                state: card.state,
            })),
        };
    }, {
        params: t.Object({
            deckId: t.String(),
        }),
    })

    // ==================== GET NODE VOCABULARY ====================
    // GET /node/:nodeId
    .get('/node/:nodeId', async ({ params, set }) => {
        const nodeId = parseInt(params.nodeId);

        if (isNaN(nodeId)) {
            set.status = 400;
            return { error: 'Invalid node ID' };
        }

        // Get node with its vocabulary
        const nodeData = await db.query.nodes.findFirst({
            where: eq(nodes.id, nodeId),
            with: {
                nodeVocabulary: {
                    orderBy: [asc(nodeVocabulary.order)],
                    with: {
                        vocabulary: true,
                    },
                },
                unit: {
                    with: {
                        level: true,
                    },
                },
            },
        });

        if (!nodeData) {
            set.status = 404;
            return { error: 'Node not found' };
        }

        return {
            node: {
                id: nodeData.id,
                type: nodeData.type,
                order: nodeData.order,
            },
            unit: {
                id: nodeData.unit.id,
                name: nodeData.unit.name,
                icon: nodeData.unit.icon,
            },
            level: {
                id: nodeData.unit.level.id,
                name: nodeData.unit.level.name,
                deckId: nodeData.unit.level.deckId,
            },
            vocabulary: nodeData.nodeVocabulary.map((nv) => nv.vocabulary),
            vocabCount: nodeData.nodeVocabulary.length,
        };
    }, {
        params: t.Object({
            nodeId: t.String(),
        }),
    })

    // ==================== GET NODE STUDY SESSION ====================
    // GET /path/node/:nodeId/session
    // Returns vocabulary with mode queue for interleaving study flow
    .get('/node/:nodeId/session', async ({ params, user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const nodeId = parseInt(params.nodeId);
        if (isNaN(nodeId)) {
            set.status = 400;
            return { error: 'Invalid node ID' };
        }

        try {
            const { getNodeSession } = await import('../services/nodeSession.service');
            console.log('📦 [NodeSession] Service loaded:', { getNodeSession: !!getNodeSession });
            return await getNodeSession(user.userId, nodeId);
        } catch (error) {
            console.error('❌ [NodeSession] Error:', error);
            if (error instanceof Error && error.message === 'Node not found') {
                set.status = 404;
                return { error: 'Node not found' };
            }
            throw error;
        }
    }, {
        params: t.Object({
            nodeId: t.String(),
        }),
    })

    // ==================== COMPLETE NODE ====================
    // POST /node/:nodeId/complete
    .post('/node/:nodeId/complete', async ({ params, body, user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const nodeId = parseInt(params.nodeId);
        const { cardsReviewed, correctCount, responseTime, results } = body;

        if (isNaN(nodeId)) {
            set.status = 400;
            return { error: 'Invalid node ID' };
        }

        // 1. Save FSRS Progress (if results provided)
        console.log('📥 [CompleteNode] Body received:', JSON.stringify(body, null, 2));
        console.log('📊 [CompleteNode] Results array:', results?.length || 0, 'items');

        if (results && results.length > 0) {
            const { saveSessionProgress } = await import('../services/nodeSession.service');
            const formattedResults = results.map((r: any) => ({
                ...r,
                fsrs: r.fsrs ? {
                    ...r.fsrs,
                    lastReview: new Date(r.fsrs.lastReview),
                    nextReview: new Date(r.fsrs.nextReview)
                } : undefined
            }));
            console.log('📝 [CompleteNode] Calling saveSessionProgress with', formattedResults.length, 'results');
            const saveResult = await saveSessionProgress(user.userId, nodeId, formattedResults);
            console.log('✅ [CompleteNode] saveSessionProgress returned:', saveResult);
        } else {
            console.log('⚠️ [CompleteNode] No results to save!');
        }

        // 2. Use gamification service for all processing
        const { processNodeCompletion } = await import('../services/gamification');

        const result = await processNodeCompletion(user.userId, nodeId, {
            cardsReviewed,
            correctCount,
            responseTimeMs: responseTime,
        });

        return {
            success: true,
            // Stars & Crowns
            stars: result.stars,
            crowns: result.crowns,
            isNewRecord: result.isNewRecord,
            // XP
            xpEarned: result.xpEarned,
            totalXp: result.totalXp,
            // Streak
            currentStreak: result.currentStreak,
            longestStreak: result.longestStreak,
            isStreakExtended: result.isStreakExtended,
            // Progress
            nextNodeId: result.nextNodeId,
        };
    }, {
        params: t.Object({
            nodeId: t.String(),
        }),
        body: t.Object({
            cardsReviewed: t.Number(),
            correctCount: t.Number(),
            responseTime: t.Number(), // milliseconds
            results: t.Optional(t.Array(t.Object({
                vocabId: t.Number(),
                cardId: t.Optional(t.String()),
                rating: t.Number(),
                fsrs: t.Optional(t.Object({
                    state: t.Number(),
                    stability: t.Number(),
                    difficulty: t.Number(),
                    elapsedDays: t.Number(),
                    scheduledDays: t.Number(),
                    reps: t.Number(),
                    lapses: t.Number(),
                    lastReview: t.Optional(t.Any()), // t.Date() might be strict on string format
                    nextReview: t.Any(), // Accept string or date
                })),
            }))),
        }),
    })

    // ==================== GET USER GAMIFICATION STATS ====================
    // GET /path/stats
    .get('/stats', async ({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { getUserStats } = await import('../services/gamification');
        const stats = await getUserStats(user.userId);

        if (!stats) {
            // Return default stats for new users
            return {
                totalXp: 0,
                totalCrowns: 0,
                currentStreak: 0,
                longestStreak: 0,
                lastStudyDate: null,
            };
        }

        return stats;
    });

export default learningPath;


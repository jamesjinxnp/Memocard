/**
 * Gamification Service
 * 
 * Handles XP calculation, streak tracking, and reward processing.
 * All gamification logic is centralized here for maintainability.
 */

import { db } from '../db/client';
import { userStats, userProgress, nodes, units } from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { nanoid } from '../utils/nanoid';

// ==================== Types ====================

export interface PerformanceResult {
    cardsReviewed: number;
    correctCount: number;
    responseTimeMs: number;
}

export interface GamificationResult {
    // Stars & Crowns
    stars: number;
    crowns: number;
    isNewRecord: boolean;

    // XP
    xpEarned: number;
    totalXp: number;

    // Streak
    currentStreak: number;
    longestStreak: number;
    isStreakExtended: boolean;

    // Progress
    nextNodeId: number | null;
}

// ==================== Constants ====================

const XP_BASE = 10;
const XP_PER_STAR = 5;
const XP_PER_CORRECT_CARD = 2;
const XP_STREAK_BONUS_MULTIPLIER = 0.1; // 10% bonus per streak day (capped)
const MAX_STREAK_MULTIPLIER = 2.0; // Max 2x XP from streak

// ==================== Helper Functions ====================

/**
 * Calculate stars based on accuracy and speed
 * @param correctCount Number of correct answers
 * @param totalCards Total cards reviewed
 * @param responseTimeMs Total response time in milliseconds
 */
export function calculateStars(correctCount: number, totalCards: number, responseTimeMs: number): number {
    if (totalCards === 0) return 0;

    const accuracy = correctCount / totalCards;
    const avgSpeed = responseTimeMs / totalCards;

    if (accuracy >= 0.95 && avgSpeed < 3000) return 3; // ⭐⭐⭐ Perfect
    if (accuracy >= 0.80 && avgSpeed < 5000) return 2; // ⭐⭐ Good
    if (accuracy >= 0.60) return 1; // ⭐ Pass
    return 0; // No stars (need retry)
}

/**
 * Calculate XP earned from a session
 * @param stars Stars earned (0-3)
 * @param correctCount Number of correct answers
 * @param currentStreak Current streak days
 */
export function calculateXP(stars: number, correctCount: number, currentStreak: number): number {
    // Base XP
    let xp = XP_BASE;

    // Star bonus
    xp += stars * XP_PER_STAR;

    // Correct card bonus
    xp += correctCount * XP_PER_CORRECT_CARD;

    // Streak multiplier (10% per day, max 2x)
    const streakMultiplier = Math.min(1 + (currentStreak * XP_STREAK_BONUS_MULTIPLIER), MAX_STREAK_MULTIPLIER);
    xp = Math.floor(xp * streakMultiplier);

    return xp;
}

/**
 * Check if two dates are the same day (in local timezone)
 */
function isSameDay(date1: Date, date2: Date): boolean {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

/**
 * Check if date1 is exactly one day before date2 (yesterday)
 */
function isYesterday(date1: Date, date2: Date): boolean {
    const yesterday = new Date(date2);
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(date1, yesterday);
}

// ==================== Main Service Functions ====================

/**
 * Update user streak based on last study date
 * Returns the new streak value and whether it was extended
 */
export async function updateStreak(
    userId: string,
    now: Date = new Date()
): Promise<{ currentStreak: number; longestStreak: number; isStreakExtended: boolean }> {
    // Get or create user stats
    let stats = await db.query.userStats.findFirst({
        where: eq(userStats.userId, userId),
    });

    if (!stats) {
        // Create new stats record
        const newStats = {
            id: nanoid(),
            userId,
            totalXp: 0,
            totalCrowns: 0,
            currentStreak: 1,
            longestStreak: 1,
            lastStudyDate: now,
            updatedAt: now,
        };

        await db.insert(userStats).values(newStats);

        return {
            currentStreak: 1,
            longestStreak: 1,
            isStreakExtended: true,
        };
    }

    const lastStudy = stats.lastStudyDate;
    let newStreak = stats.currentStreak;
    let isStreakExtended = false;

    if (!lastStudy) {
        // First time studying
        newStreak = 1;
        isStreakExtended = true;
    } else if (isSameDay(lastStudy, now)) {
        // Already studied today, no change
        isStreakExtended = false;
    } else if (isYesterday(lastStudy, now)) {
        // Studied yesterday, extend streak!
        newStreak = stats.currentStreak + 1;
        isStreakExtended = true;
    } else {
        // Missed a day, reset streak
        newStreak = 1;
        isStreakExtended = true;
    }

    const newLongestStreak = Math.max(stats.longestStreak, newStreak);

    // Update stats
    await db.update(userStats)
        .set({
            currentStreak: newStreak,
            longestStreak: newLongestStreak,
            lastStudyDate: now,
            updatedAt: now,
        })
        .where(eq(userStats.id, stats.id));

    return {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        isStreakExtended,
    };
}

/**
 * Process node completion and update all gamification data
 * This is the main entry point for gamification
 */
export async function processNodeCompletion(
    userId: string,
    nodeId: number,
    performance: PerformanceResult
): Promise<GamificationResult> {
    const { cardsReviewed, correctCount, responseTimeMs } = performance;
    const now = new Date();

    // Calculate stars
    const stars = calculateStars(correctCount, cardsReviewed, responseTimeMs);

    // Use transaction for data consistency
    return await db.transaction(async (tx) => {
        // 1. Update streak first
        let stats = await tx.query.userStats.findFirst({
            where: eq(userStats.userId, userId),
        });

        let currentStreak = 1;
        let longestStreak = 1;
        let isStreakExtended = false;
        let previousTotalXp = 0;

        if (!stats) {
            // Create new stats
            const newStatsId = nanoid();
            await tx.insert(userStats).values({
                id: newStatsId,
                userId,
                totalXp: 0,
                totalCrowns: 0,
                currentStreak: 1,
                longestStreak: 1,
                lastStudyDate: now,
                updatedAt: now,
            });
            isStreakExtended = true;
        } else {
            previousTotalXp = stats.totalXp;
            const lastStudy = stats.lastStudyDate;

            if (!lastStudy) {
                currentStreak = 1;
                isStreakExtended = true;
            } else if (isSameDay(lastStudy, now)) {
                currentStreak = stats.currentStreak;
                isStreakExtended = false;
            } else if (isYesterday(lastStudy, now)) {
                currentStreak = stats.currentStreak + 1;
                isStreakExtended = true;
            } else {
                currentStreak = 1;
                isStreakExtended = true;
            }

            longestStreak = Math.max(stats.longestStreak, currentStreak);
        }

        // 2. Calculate XP
        const xpEarned = calculateXP(stars, correctCount, currentStreak);
        const newTotalXp = previousTotalXp + xpEarned;

        // 3. Update user progress for the node
        const existingProgress = await tx
            .select()
            .from(userProgress)
            .where(and(
                eq(userProgress.userId, userId),
                eq(userProgress.nodeId, nodeId)
            ))
            .limit(1);

        let isNewRecord = false;
        let newCrowns = 0;

        if (existingProgress.length > 0) {
            const current = existingProgress[0];
            isNewRecord = stars > current.bestScore;
            newCrowns = stars === 3 ? Math.min(current.crowns + 1, 5) : current.crowns;

            await tx.update(userProgress)
                .set({
                    status: 2, // completed
                    stars: Math.max(stars, current.stars),
                    crowns: newCrowns,
                    attempts: current.attempts + 1,
                    bestScore: isNewRecord ? stars : current.bestScore,
                    completedAt: now,
                    updatedAt: now,
                })
                .where(eq(userProgress.id, current.id));
        } else {
            isNewRecord = true;
            newCrowns = stars === 3 ? 1 : 0;

            await tx.insert(userProgress).values({
                id: nanoid(),
                userId,
                nodeId,
                status: 2, // completed
                stars,
                crowns: newCrowns,
                attempts: 1,
                bestScore: stars,
                completedAt: now,
                updatedAt: now,
            });
        }

        // 4. Calculate total crowns change for user stats
        const crownChange = isNewRecord && stars === 3 ? 1 : 0;

        // 5. Update user stats with XP and crowns
        if (stats) {
            await tx.update(userStats)
                .set({
                    totalXp: newTotalXp,
                    totalCrowns: stats.totalCrowns + crownChange,
                    currentStreak,
                    longestStreak,
                    lastStudyDate: now,
                    updatedAt: now,
                })
                .where(eq(userStats.id, stats.id));
        } else {
            // Update the newly created stats
            await tx.update(userStats)
                .set({
                    totalXp: xpEarned,
                    totalCrowns: crownChange,
                    currentStreak,
                    longestStreak,
                    lastStudyDate: now,
                    updatedAt: now,
                })
                .where(eq(userStats.userId, userId));
        }

        // 6. Auto-unlock next node
        const currentNode = await tx.query.nodes.findFirst({
            where: eq(nodes.id, nodeId),
            with: {
                unit: {
                    with: {
                        nodes: {
                            orderBy: [asc(nodes.order)],
                        },
                        level: {
                            with: {
                                units: {
                                    orderBy: [asc(units.order)],
                                },
                            },
                        },
                    },
                },
            },
        });

        let nextNodeId: number | null = null;

        if (currentNode) {
            const unitNodes = currentNode.unit.nodes;
            const currentIndex = unitNodes.findIndex((n) => n.id === nodeId);

            if (currentIndex >= 0 && currentIndex < unitNodes.length - 1) {
                // Next node in same unit
                nextNodeId = unitNodes[currentIndex + 1].id;
            } else {
                // Check next unit
                const levelUnits = currentNode.unit.level.units;
                const unitIndex = levelUnits.findIndex((u) => u.id === currentNode.unit.id);

                if (unitIndex >= 0 && unitIndex < levelUnits.length - 1) {
                    const nextUnit = levelUnits[unitIndex + 1];
                    const nextUnitNodes = await tx
                        .select()
                        .from(nodes)
                        .where(eq(nodes.unitId, nextUnit.id))
                        .orderBy(asc(nodes.order))
                        .limit(1);

                    if (nextUnitNodes.length > 0) {
                        nextNodeId = nextUnitNodes[0].id;
                    }
                }
            }
        }

        // Unlock next node if found
        if (nextNodeId) {
            const nextProgress = await tx
                .select()
                .from(userProgress)
                .where(and(
                    eq(userProgress.userId, userId),
                    eq(userProgress.nodeId, nextNodeId)
                ))
                .limit(1);

            if (nextProgress.length === 0) {
                await tx.insert(userProgress).values({
                    id: nanoid(),
                    userId,
                    nodeId: nextNodeId,
                    status: 1, // available
                    stars: 0,
                    crowns: 0,
                    attempts: 0,
                    bestScore: 0,
                    updatedAt: now,
                });
            }
        }

        return {
            stars,
            crowns: newCrowns,
            isNewRecord,
            xpEarned,
            totalXp: newTotalXp,
            currentStreak,
            longestStreak,
            isStreakExtended,
            nextNodeId,
        };
    });
}

/**
 * Get user's gamification stats
 */
export async function getUserStats(userId: string): Promise<{
    totalXp: number;
    totalCrowns: number;
    currentStreak: number;
    longestStreak: number;
    lastStudyDate: Date | null;
} | null> {
    const stats = await db.query.userStats.findFirst({
        where: eq(userStats.userId, userId),
    });

    if (!stats) return null;

    return {
        totalXp: stats.totalXp,
        totalCrowns: stats.totalCrowns,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        lastStudyDate: stats.lastStudyDate,
    };
}

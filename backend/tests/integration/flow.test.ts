
import { describe, expect, it } from 'bun:test';
import app from '../../src/index';
import { createTestUser, getFirstNode } from '../utils';
import { db } from '../../src/db/client';
import { userProgress, userStats } from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';

describe('Game Loop Integration', () => {
    it('should complete a node, award XP, and unlock the next node', async () => {
        // 1. Setup
        const { user, token } = await createTestUser();
        const node = await getFirstNode();

        console.log(`Testing with User: ${user.id}, Node: ${node.id}`);

        // 2. Action: Complete Node
        const response = await app.handle(
            new Request(`http://localhost/path/node/${node.id}/complete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cardsReviewed: 10,
                    correctCount: 10, // Perfect score -> 3 stars
                    responseTime: 3000
                })
            })
        );

        expect(response.status).toBe(200);
        const data = await response.json();


        // 3. Assertions: Response
        expect(data.success).toBe(true);
        expect(data.stars).toBe(3);
        expect(data.xpEarned).toBeGreaterThan(0);
        expect(data.nextNodeId).toBeTruthy();

        // 4. Assertions: Database State (Progress)
        const progress = await db.query.userProgress.findFirst({
            where: and(
                eq(userProgress.userId, user.id),
                eq(userProgress.nodeId, node.id)
            )
        });
        expect(progress).toBeTruthy();
        expect(progress?.status).toBe(2);
        expect(progress?.stars).toBe(3);

        // 5. Assertions: Database State (Stats)
        const stats = await db.query.userStats.findFirst({
            where: eq(userStats.userId, user.id)
        });
        expect(stats).toBeTruthy();
        expect(stats?.totalXp).toBeGreaterThan(0);
        expect(stats?.currentStreak).toBe(1); // First day
    });
});

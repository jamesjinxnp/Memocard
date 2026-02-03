
import { describe, expect, it } from 'bun:test';
import app from '../../src/index';
import { createTestUser, createDueCard } from '../utils';
import { db } from '../../src/db/client';
import { reviewLogs, cards } from '../../src/db/schema';
import { eq, desc } from 'drizzle-orm';

describe('FSRS Review Loop Integration', () => {
    it('should submit a review and update card stability/due date', async () => {
        // 1. Setup
        const { user, token } = await createTestUser();
        const card = await createDueCard(user.id);

        console.log(`Testing FSRS with User: ${user.id}, Card: ${card.id}`);

        // 2. Action: Submit Review (Good - 3)
        const response = await app.handle(
            new Request(`http://localhost/study/review`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cardId: card.id,
                    rating: 3, // Good
                    studyMode: 'review',
                    responseTime: 3000
                })
            })
        );

        expect(response.status).toBe(200);
        const data = await response.json();


        // 3. Assertions: Response
        expect(data.message).toBe('Review submitted');
        expect(data.interval).toBeGreaterThan(0);
        expect(data.newState).toBeDefined();

        // 4. Assertions: Database State (Card)
        const updatedCard = await db.query.cards.findFirst({
            where: eq(cards.id, card.id)
        });

        expect(updatedCard).toBeTruthy();
        expect(updatedCard!.stability).toBeGreaterThan(card.stability); // Stability should increase
        expect(new Date(updatedCard!.due).getTime()).toBeGreaterThan(new Date().getTime()); // Due date should be in future

        // 5. Assertions: Database State (Review Log)
        const log = await db.query.reviewLogs.findFirst({
            where: eq(reviewLogs.cardId, card.id),
            orderBy: desc(reviewLogs.reviewedAt)
        });

        expect(log).toBeTruthy();
        expect(log!.rating).toBe(3);
        expect(log!.userId).toBe(user.id);
    });
});

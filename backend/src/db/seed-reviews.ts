import { db } from './client';
import { users, cards, reviewLogs } from './schema';
import { eq } from 'drizzle-orm';
import { nanoid } from '../utils/nanoid';

async function seedReviewLogs() {
    console.log('🌱 Starting review logs seed for test user...');

    // Find test user
    const testUser = await db.query.users.findFirst({
        where: eq(users.email, 'test@gmail.com'),
    });

    if (!testUser) {
        console.log('❌ Test user not found. Please create test@gmail.com first.');
        return;
    }

    console.log(`👤 Found user: ${testUser.name || testUser.email} (${testUser.id})`);

    // Get user's cards
    const userCards = await db.query.cards.findMany({
        where: eq(cards.userId, testUser.id),
    });

    if (userCards.length === 0) {
        console.log('❌ No cards found for test user.');
        return;
    }

    console.log(`📚 Found ${userCards.length} cards`);

    // Generate review logs for the past 60 days
    const now = new Date();
    const reviewLogsToInsert = [];

    for (let daysAgo = 60; daysAgo >= 0; daysAgo--) {
        // Random chance to have reviews on this day (70%)
        if (Math.random() > 0.7 && daysAgo !== 0) continue;

        const reviewDate = new Date(now);
        reviewDate.setDate(reviewDate.getDate() - daysAgo);
        reviewDate.setHours(10 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);

        // Random number of reviews (1-10)
        const numReviews = Math.floor(Math.random() * 10) + 1;

        for (let i = 0; i < numReviews && i < userCards.length; i++) {
            const card = userCards[i % userCards.length];
            const rating = Math.floor(Math.random() * 4) + 1; // 1-4

            reviewLogsToInsert.push({
                id: nanoid(),
                cardId: card.id,
                userId: testUser.id,
                rating,
                state: card.state,
                studyMode: ['reading', 'typing', 'listening'][Math.floor(Math.random() * 3)],
                responseTime: Math.floor(Math.random() * 5000) + 1000,
                stability: Math.random() * 10,
                difficulty: Math.random() * 10,
                elapsedDays: daysAgo,
                scheduledDays: Math.floor(Math.random() * 10) + 1,
                reviewedAt: reviewDate,
            });
        }
    }

    console.log(`📝 Generating ${reviewLogsToInsert.length} review logs...`);

    // Insert in batches
    const batchSize = 50;
    for (let i = 0; i < reviewLogsToInsert.length; i += batchSize) {
        const batch = reviewLogsToInsert.slice(i, i + batchSize);
        await db.insert(reviewLogs).values(batch);
        console.log(`✅ Inserted ${Math.min(i + batchSize, reviewLogsToInsert.length)}/${reviewLogsToInsert.length}`);
    }

    console.log('🎉 Review logs seed completed!');
}

seedReviewLogs()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ Seed failed:', err);
        process.exit(1);
    });

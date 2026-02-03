
import { db } from '../src/db/client';
import { users, nodes, vocabulary, cards } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

import { nanoid } from '../src/utils/nanoid';

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function createTestUser() {
    const email = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

    // Insert user
    const [user] = await db.insert(users).values({
        id: nanoid(),
        email,
        passwordHash: '$2a$10$dummyhash', // We generate token directly, so hash doesn't matter for login
        name: 'Test User',
        createdAt: new Date(),
    }).returning();

    // Create a gamification stats entry
    // (Assuming trigger or service creates it, but if manual insert, we might need to create it manually depending on implementation)
    // Checking previous steps, `getUserStats` returns default if not found, but updates usually traverse services.
    // safer to rely on lazy creation if implemented, or insert explicitly locally
    // logic in gamification.ts handles creation if missing? "const stats = await getUserStats... if !stats return default".
    // But `processNodeCompletion` likely updates.

    // Generate token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);

    return { user, token };
}

export async function getFirstNode() {
    // Get the first lesson node from the DB (assuming seeded)
    const node = await db.query.nodes.findFirst({
        where: eq(nodes.type, 'lesson'),
        orderBy: (nodes, { asc }) => [asc(nodes.order)],
        with: {
            nodeVocabulary: {
                limit: 1,
                with: {
                    vocabulary: true
                }
            }
        }
    });

    if (!node) {
        throw new Error('No nodes found. Did you run seed:path?');
    }

    return node;
}

export async function createDueCard(userId: string) {
    // 1. Get a vocabulary
    const vocab = await db.query.vocabulary.findFirst();
    if (!vocab) throw new Error('No vocabulary found');

    // 2. Create a card for this user
    // Set due date to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [card] = await db.insert(cards).values({
        id: nanoid(),
        userId,
        vocabularyId: vocab.id,
        state: 1, // Learning
        learningSteps: 0,
        due: yesterday,
        stability: 1,
        difficulty: 5,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        createdAt: new Date(),
    }).returning();

    return card;
}

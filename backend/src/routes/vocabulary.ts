import { Elysia, t } from 'elysia';
import { db } from '../db/client';
import { vocabulary } from '../db/schema';
import { eq, like, or, sql } from 'drizzle-orm';

const vocabularyRoutes = new Elysia({ prefix: '/vocabulary' })

    // ==================== GET ALL VOCABULARY (paginated) ====================
    .get('/', async ({ query }) => {
        const page = parseInt(query.page || '1');
        const limit = parseInt(query.limit || '50');
        const cefr = query.cefr;
        const deck = query.deck; // Filter by deck tag (oxford3000, oxford5000, Toeic, etc.)
        const offset = (page - 1) * limit;

        // Build where conditions
        const conditions = [];
        if (cefr) {
            conditions.push(eq(vocabulary.cefr, cefr));
        }
        if (deck) {
            // Match deck in comma-separated tag field (e.g., "oxford3000,Toeic")
            conditions.push(like(vocabulary.tag, `%${deck}%`));
        }

        let dbQuery = db.select().from(vocabulary);
        if (conditions.length > 0) {
            dbQuery = dbQuery.where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`) as typeof dbQuery;
        }

        const items = await dbQuery.limit(limit).offset(offset);

        // Get total count with same filters
        let countQuery = db.select({ count: sql<number>`count(*)` }).from(vocabulary);
        if (conditions.length > 0) {
            countQuery = countQuery.where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`) as typeof countQuery;
        }

        const total = await countQuery;

        return {
            items,
            pagination: {
                page,
                limit,
                total: total[0]?.count || 0,
                totalPages: Math.ceil((total[0]?.count || 0) / limit),
            },
        };
    }, {
        query: t.Object({
            page: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            cefr: t.Optional(t.String()),
            deck: t.Optional(t.String()),
        })
    })

    // ==================== SEARCH VOCABULARY ====================
    .get('/search', async ({ query, set }) => {
        const q = query.q;
        const limit = parseInt(query.limit || '20');

        if (!q || q.length < 2) {
            set.status = 400;
            return { error: 'Query must be at least 2 characters' };
        }

        const searchPattern = `%${q}%`;

        const results = await db
            .select()
            .from(vocabulary)
            .where(or(
                like(vocabulary.word, searchPattern),
                like(vocabulary.defEn, searchPattern),
                like(vocabulary.defTh, searchPattern)
            ))
            .limit(limit);

        return { results };
    }, {
        query: t.Object({
            q: t.Optional(t.String()),
            limit: t.Optional(t.String()),
        })
    })

    // ==================== GET CEFR STATISTICS ====================
    .get('/stats/cefr', async () => {
        const stats = await db
            .select({
                cefr: vocabulary.cefr,
                count: sql<number>`count(*)`,
            })
            .from(vocabulary)
            .groupBy(vocabulary.cefr);

        return { stats };
    })

    // ==================== GET DECK STATISTICS ====================
    .get('/stats/decks', async () => {
        // Get counts for main decks
        const decks = ['oxford3000', 'oxford5000', 'Toeic'];
        const stats = [];

        for (const deck of decks) {
            const result = await db
                .select({ count: sql<number>`count(*)` })
                .from(vocabulary)
                .where(like(vocabulary.tag, `%${deck}%`));

            stats.push({
                deck,
                count: result[0]?.count || 0,
            });
        }

        return { stats };
    })

    // ==================== GET AVAILABLE DECKS ====================
    .get('/decks', async () => {
        // Return predefined decks with metadata
        const decks = [
            { id: 'oxford3000', name: 'Oxford 3000', description: 'Most important 3000 words for learners', color: 'emerald' },
            { id: 'oxford5000', name: 'Oxford 5000', description: 'Extended vocabulary for advanced learners', color: 'blue' },
            { id: 'Toeic', name: 'TOEIC', description: 'Essential vocabulary for TOEIC exam', color: 'purple' },
        ];

        // Get counts for each deck
        const deckStats = await Promise.all(
            decks.map(async (deck) => {
                const result = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(vocabulary)
                    .where(like(vocabulary.tag, `%${deck.id}%`));

                return {
                    ...deck,
                    wordCount: result[0]?.count || 0,
                };
            })
        );

        return { decks: deckStats };
    })

    // ==================== GET RANDOM VOCABULARY FOR QUIZ ====================
    .get('/random/:count', async ({ params, query }) => {
        const count = parseInt(params.count);
        const cefr = query.cefr;
        const exclude = query.exclude?.split(',').map(Number) || [];

        let dbQuery = db.select().from(vocabulary);

        if (cefr) {
            dbQuery = dbQuery.where(eq(vocabulary.cefr, cefr)) as typeof dbQuery;
        }

        // Random selection using SQL
        const items = await dbQuery
            .orderBy(sql`RANDOM()`)
            .limit(Math.min(count, 10));

        // Filter out excluded IDs if any
        const filtered = exclude.length > 0
            ? items.filter(v => !exclude.includes(v.id))
            : items;

        return { items: filtered };
    }, {
        params: t.Object({
            count: t.String(),
        }),
        query: t.Object({
            cefr: t.Optional(t.String()),
            exclude: t.Optional(t.String()),
        })
    })

    // ==================== GET SINGLE VOCABULARY ====================
    .get('/:id', async ({ params, set }) => {
        const id = parseInt(params.id);

        const vocab = await db.query.vocabulary.findFirst({
            where: eq(vocabulary.id, id),
        });

        if (!vocab) {
            set.status = 404;
            return { error: 'Vocabulary not found' };
        }

        return { vocabulary: vocab };
    }, {
        params: t.Object({
            id: t.String(),
        })
    });

export default vocabularyRoutes;

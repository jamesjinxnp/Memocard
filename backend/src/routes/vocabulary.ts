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
        const offset = (page - 1) * limit;

        let dbQuery = db.select().from(vocabulary);

        if (cefr) {
            dbQuery = dbQuery.where(eq(vocabulary.cefr, cefr)) as typeof dbQuery;
        }

        const items = await dbQuery.limit(limit).offset(offset);

        // Get total count
        const countQuery = cefr
            ? db.select({ count: sql<number>`count(*)` }).from(vocabulary).where(eq(vocabulary.cefr, cefr))
            : db.select({ count: sql<number>`count(*)` }).from(vocabulary);

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

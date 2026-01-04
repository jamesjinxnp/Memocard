import { Hono } from 'hono';
import { db } from '../db/client';
import { vocabulary } from '../db/schema';
import { eq, like, or, sql } from 'drizzle-orm';

const vocabularyRoutes = new Hono();

// ==================== GET ALL VOCABULARY (paginated) ====================
vocabularyRoutes.get('/', async (c) => {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const cefr = c.req.query('cefr'); // Filter by CEFR level
    const offset = (page - 1) * limit;

    let query = db.select().from(vocabulary);

    if (cefr) {
        query = query.where(eq(vocabulary.cefr, cefr)) as typeof query;
    }

    const items = await query.limit(limit).offset(offset);

    // Get total count
    const countQuery = cefr
        ? db.select({ count: sql<number>`count(*)` }).from(vocabulary).where(eq(vocabulary.cefr, cefr))
        : db.select({ count: sql<number>`count(*)` }).from(vocabulary);

    const total = await countQuery;

    return c.json({
        items,
        pagination: {
            page,
            limit,
            total: total[0]?.count || 0,
            totalPages: Math.ceil((total[0]?.count || 0) / limit),
        },
    });
});

// ==================== SEARCH VOCABULARY ====================
vocabularyRoutes.get('/search', async (c) => {
    const query = c.req.query('q');
    const limit = parseInt(c.req.query('limit') || '20');

    if (!query || query.length < 2) {
        return c.json({ error: 'Query must be at least 2 characters' }, 400);
    }

    const searchPattern = `%${query}%`;

    const results = await db
        .select()
        .from(vocabulary)
        .where(or(
            like(vocabulary.word, searchPattern),
            like(vocabulary.defEn, searchPattern),
            like(vocabulary.defTh, searchPattern)
        ))
        .limit(limit);

    return c.json({ results });
});

// ==================== GET SINGLE VOCABULARY ====================
vocabularyRoutes.get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'));

    const vocab = await db.query.vocabulary.findFirst({
        where: eq(vocabulary.id, id),
    });

    if (!vocab) {
        return c.json({ error: 'Vocabulary not found' }, 404);
    }

    return c.json({ vocabulary: vocab });
});

// ==================== GET CEFR STATISTICS ====================
vocabularyRoutes.get('/stats/cefr', async (c) => {
    const stats = await db
        .select({
            cefr: vocabulary.cefr,
            count: sql<number>`count(*)`,
        })
        .from(vocabulary)
        .groupBy(vocabulary.cefr);

    return c.json({ stats });
});

// ==================== GET RANDOM VOCABULARY FOR QUIZ ====================
vocabularyRoutes.get('/random/:count', async (c) => {
    const count = parseInt(c.req.param('count'));
    const cefr = c.req.query('cefr');
    const exclude = c.req.query('exclude')?.split(',').map(Number) || [];

    let query = db.select().from(vocabulary);

    if (cefr) {
        query = query.where(eq(vocabulary.cefr, cefr)) as typeof query;
    }

    // Random selection using SQL
    const items = await query
        .orderBy(sql`RANDOM()`)
        .limit(Math.min(count, 10));

    // Filter out excluded IDs if any
    const filtered = exclude.length > 0
        ? items.filter(v => !exclude.includes(v.id))
        : items;

    return c.json({ items: filtered });
});

export default vocabularyRoutes;

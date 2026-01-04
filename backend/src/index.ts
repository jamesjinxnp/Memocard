import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import authRoutes from './routes/auth';
import studyRoutes from './routes/study';
import vocabularyRoutes from './routes/vocabulary';

// Create Hono app
const app = new Hono();

// ==================== MIDDLEWARE ====================
app.use('*', logger());
app.use('*', cors({
    origin: ['http://localhost:5173', 'https://memocard.vercel.app'],
    credentials: true,
}));

// ==================== ROUTES ====================
app.route('/auth', authRoutes);
app.route('/study', studyRoutes);
app.route('/vocabulary', vocabularyRoutes);

// ==================== HEALTH CHECK ====================
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// ==================== ROOT ====================
app.get('/', (c) => {
    return c.json({
        name: 'Memocard API',
        version: '1.0.0',
        endpoints: {
            auth: '/auth',
            study: '/study',
            vocabulary: '/vocabulary',
            health: '/health',
        },
    });
});

// ==================== 404 HANDLER ====================
app.notFound((c) => {
    return c.json({ error: 'Not Found' }, 404);
});

// ==================== ERROR HANDLER ====================
app.onError((err, c) => {
    console.error('Server error:', err);
    return c.json({ error: 'Internal Server Error' }, 500);
});

// ==================== START SERVER ====================
const port = parseInt(process.env.PORT || '3000');

console.log(`🚀 Memocard API server running on http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch,
};

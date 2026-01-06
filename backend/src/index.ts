import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';

import authRoutes from './routes/auth';
import studyRoutes from './routes/study';
import vocabularyRoutes from './routes/vocabulary';
import userRoutes from './routes/user';

// Create Elysia app
const app = new Elysia()
    // ==================== MIDDLEWARE ====================
    .use(cors({
        origin: /^http:\/\/localhost:\d+$/,
        credentials: true,
    }))
    .onRequest(({ request }) => {
        console.log(`${request.method} ${new URL(request.url).pathname}`);
    })

    // ==================== HEALTH CHECK ====================
    .get('/health', () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    }))

    // ==================== ROOT ====================
    .get('/', () => ({
        name: 'Memocard API',
        version: '1.0.0',
        endpoints: {
            auth: '/auth',
            study: '/study',
            vocabulary: '/vocabulary',
            health: '/health',
        },
    }))

    // ==================== ROUTES ====================
    .use(authRoutes)
    .use(studyRoutes)
    .use(vocabularyRoutes)
    .use(userRoutes)

    // ==================== ERROR HANDLER ====================
    .onError(({ error }) => {
        console.error('Server error:', error);
        return { error: 'Internal Server Error' };
    });

// ==================== START SERVER ====================
const port = parseInt(process.env.PORT || '3000');

app.listen(port);
console.log(`🚀 Memocard API server running on http://localhost:${port}`);

export default app;

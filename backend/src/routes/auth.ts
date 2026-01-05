import { Elysia, t } from 'elysia';
import bcrypt from 'bcryptjs';
import { nanoid } from '../utils/nanoid';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateToken, getUserFromHeader, JWTPayload } from '../middleware/auth';

const auth = new Elysia({ prefix: '/auth' })
    .derive(({ headers }) => {
        const user = getUserFromHeader(headers);
        return { user };
    })

    // ==================== REGISTER ====================
    .post('/register', async ({ body, set }) => {
        const { email, password, name } = body;

        // Check if user already exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (existingUser) {
            set.status = 400;
            return { error: 'Email already registered' };
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const userId = nanoid();
        const now = new Date();

        await db.insert(users).values({
            id: userId,
            email,
            passwordHash,
            name,
            createdAt: now,
        });

        // Generate token
        const token = generateToken({ userId, email });

        set.status = 201;
        return {
            message: 'User registered successfully',
            user: { id: userId, email, name },
            token,
        };
    }, {
        body: t.Object({
            email: t.String(),
            password: t.String({ minLength: 6 }),
            name: t.Optional(t.String()),
        })
    })

    // ==================== LOGIN ====================
    .post('/login', async ({ body, set }) => {
        const { email, password } = body;

        // Find user
        const dbUser = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (!dbUser) {
            set.status = 401;
            return { error: 'Invalid email or password' };
        }

        // Verify password
        const isValid = await bcrypt.compare(password, dbUser.passwordHash);

        if (!isValid) {
            set.status = 401;
            return { error: 'Invalid email or password' };
        }

        // Generate token
        const token = generateToken({ userId: dbUser.id, email: dbUser.email });

        return {
            message: 'Login successful',
            user: { id: dbUser.id, email: dbUser.email, name: dbUser.name },
            token,
        };
    }, {
        body: t.Object({
            email: t.String(),
            password: t.String(),
        })
    })

    // ==================== GET CURRENT USER ====================
    .get('/me', async ({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const dbUser = await db.query.users.findFirst({
            where: eq(users.id, user.userId),
            columns: {
                id: true,
                email: true,
                name: true,
                preferences: true,
                createdAt: true,
            },
        });

        if (!dbUser) {
            set.status = 404;
            return { error: 'User not found' };
        }

        return { user: dbUser };
    })

    // ==================== UPDATE PREFERENCES ====================
    .patch('/me/preferences', async ({ body, user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        // Get current preferences
        const dbUser = await db.query.users.findFirst({
            where: eq(users.id, user.userId),
            columns: { preferences: true },
        });

        // Merge with existing preferences
        const currentPrefs = dbUser?.preferences ? JSON.parse(dbUser.preferences) : {};
        const mergedPrefs = { ...currentPrefs, ...body };

        // Update user preferences
        await db.update(users)
            .set({
                preferences: JSON.stringify(mergedPrefs),
                updatedAt: new Date(),
            })
            .where(eq(users.id, user.userId));

        return {
            message: 'Preferences updated',
            preferences: mergedPrefs,
        };
    }, {
        body: t.Object({
            dailyGoal: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
            soundEnabled: t.Optional(t.Boolean()),
            autoPlayAudio: t.Optional(t.Boolean()),
            showIPA: t.Optional(t.Boolean()),
            theme: t.Optional(t.Union([
                t.Literal('light'),
                t.Literal('dark'),
                t.Literal('system'),
            ])),
        })
    });

export default auth;

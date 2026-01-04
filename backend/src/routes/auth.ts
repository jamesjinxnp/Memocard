import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { nanoid } from '../utils/nanoid';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateToken, authMiddleware, getCurrentUser } from '../middleware/auth';

const auth = new Hono();

// Validation schemas
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

// ==================== REGISTER ====================
auth.post('/register', zValidator('json', registerSchema), async (c) => {
    const { email, password, name } = c.req.valid('json');

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
    });

    if (existingUser) {
        return c.json({ error: 'Email already registered' }, 400);
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

    return c.json({
        message: 'User registered successfully',
        user: { id: userId, email, name },
        token,
    }, 201);
});

// ==================== LOGIN ====================
auth.post('/login', zValidator('json', loginSchema), async (c) => {
    const { email, password } = c.req.valid('json');

    // Find user
    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
    });

    if (!user) {
        return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
        return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    return c.json({
        message: 'Login successful',
        user: { id: user.id, email: user.email, name: user.name },
        token,
    });
});

// ==================== GET CURRENT USER ====================
auth.get('/me', authMiddleware, async (c) => {
    const { userId } = getCurrentUser(c);

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
            id: true,
            email: true,
            name: true,
            preferences: true,
            createdAt: true,
        },
    });

    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user });
});

// ==================== UPDATE PREFERENCES ====================
const preferencesSchema = z.object({
    dailyGoal: z.number().min(1).max(100).optional(),
    soundEnabled: z.boolean().optional(),
    autoPlayAudio: z.boolean().optional(),
    showIPA: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
});

auth.patch('/me/preferences', authMiddleware, zValidator('json', preferencesSchema), async (c) => {
    const { userId } = getCurrentUser(c);
    const newPrefs = c.req.valid('json');

    // Get current preferences
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { preferences: true },
    });

    // Merge with existing preferences
    const currentPrefs = user?.preferences ? JSON.parse(user.preferences) : {};
    const mergedPrefs = { ...currentPrefs, ...newPrefs };

    // Update user preferences
    await db.update(users)
        .set({
            preferences: JSON.stringify(mergedPrefs),
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

    return c.json({
        message: 'Preferences updated',
        preferences: mergedPrefs,
    });
});

export default auth;


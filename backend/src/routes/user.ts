import { Elysia, t } from 'elysia';
import bcrypt from 'bcryptjs';
import { db } from '../db/client';
import { users, cards, reviewLogs, studySessions } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserFromHeader } from '../middleware/auth';

const user = new Elysia({ prefix: '/user' })
    .derive(({ headers }) => {
        const authUser = getUserFromHeader(headers);
        return { authUser };
    })

    // ==================== UPDATE PROFILE (NAME) ====================
    .put('/profile', async ({ authUser, body, set }) => {
        if (!authUser) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { name } = body;

        await db.update(users)
            .set({ name, updatedAt: new Date() })
            .where(eq(users.id, authUser.userId));

        const updatedUser = await db.query.users.findFirst({
            where: eq(users.id, authUser.userId),
            columns: { id: true, email: true, name: true, preferences: true },
        });

        return { message: 'Profile updated', user: updatedUser };
    }, {
        body: t.Object({
            name: t.String({ minLength: 1 }),
        })
    })

    // ==================== UPDATE EMAIL ====================
    .put('/email', async ({ authUser, body, set }) => {
        if (!authUser) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { email, password } = body;

        // Verify current password
        const dbUser = await db.query.users.findFirst({
            where: eq(users.id, authUser.userId),
        });

        if (!dbUser) {
            set.status = 404;
            return { error: 'User not found' };
        }

        const isValid = await bcrypt.compare(password, dbUser.passwordHash);
        if (!isValid) {
            set.status = 400;
            return { error: 'Invalid password' };
        }

        // Check if email already exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (existingUser && existingUser.id !== authUser.userId) {
            set.status = 400;
            return { error: 'Email already in use' };
        }

        await db.update(users)
            .set({ email, updatedAt: new Date() })
            .where(eq(users.id, authUser.userId));

        return { message: 'Email updated', email };
    }, {
        body: t.Object({
            email: t.String({ format: 'email' }),
            password: t.String(),
        })
    })

    // ==================== UPDATE PASSWORD ====================
    .put('/password', async ({ authUser, body, set }) => {
        if (!authUser) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { currentPassword, newPassword } = body;

        // Verify current password
        const dbUser = await db.query.users.findFirst({
            where: eq(users.id, authUser.userId),
        });

        if (!dbUser) {
            set.status = 404;
            return { error: 'User not found' };
        }

        const isValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
        if (!isValid) {
            set.status = 400;
            return { error: 'Current password is incorrect' };
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await db.update(users)
            .set({ passwordHash, updatedAt: new Date() })
            .where(eq(users.id, authUser.userId));

        return { message: 'Password updated successfully' };
    }, {
        body: t.Object({
            currentPassword: t.String(),
            newPassword: t.String({ minLength: 6 }),
        })
    })

    // ==================== UPDATE PREFERENCES (THEME) ====================
    .put('/preferences', async ({ authUser, body, set }) => {
        if (!authUser) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { preferences } = body;

        await db.update(users)
            .set({ preferences: JSON.stringify(preferences), updatedAt: new Date() })
            .where(eq(users.id, authUser.userId));

        return { message: 'Preferences updated', preferences };
    }, {
        body: t.Object({
            preferences: t.Object({
                theme: t.Optional(t.Union([t.Literal('dark'), t.Literal('light')])),
                dailyNewCards: t.Optional(t.Number()),
            })
        })
    })

    // ==================== RESET LEARNING ====================
    .post('/reset-learning', async ({ authUser, set }) => {
        if (!authUser) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        // Delete all cards for this user (review logs will cascade)
        await db.delete(cards).where(eq(cards.userId, authUser.userId));

        // Delete all study sessions
        await db.delete(studySessions).where(eq(studySessions.userId, authUser.userId));

        return { message: 'All learning progress has been reset' };
    })

    // ==================== DELETE ACCOUNT ====================
    .delete('/', async ({ authUser, body, set }) => {
        if (!authUser) {
            set.status = 401;
            return { error: 'Unauthorized' };
        }

        const { password } = body;

        // Verify password
        const dbUser = await db.query.users.findFirst({
            where: eq(users.id, authUser.userId),
        });

        if (!dbUser) {
            set.status = 404;
            return { error: 'User not found' };
        }

        const isValid = await bcrypt.compare(password, dbUser.passwordHash);
        if (!isValid) {
            set.status = 400;
            return { error: 'Invalid password' };
        }

        // Delete user (cascades to cards, review_logs, study_sessions)
        await db.delete(users).where(eq(users.id, authUser.userId));

        return { message: 'Account deleted successfully' };
    }, {
        body: t.Object({
            password: t.String(),
        })
    });

export default user;

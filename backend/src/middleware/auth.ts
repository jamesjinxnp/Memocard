import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

export interface JWTPayload {
    userId: string;
    email: string;
}

export type AuthContext = Context & {
    user?: JWTPayload;
};

/**
 * Generate JWT access token
 */
export function generateToken(payload: JWTPayload, expiresIn: string = '7d'): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
        return null;
    }
}

/**
 * Auth middleware - protects routes requiring authentication
 */
export async function authMiddleware(c: Context, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized - Missing token' }, 401);
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    const payload = verifyToken(token);

    if (!payload) {
        return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    // Attach user info to context
    c.set('user', payload);

    await next();
}

/**
 * Get current user from context
 */
export function getCurrentUser(c: Context): JWTPayload {
    return c.get('user') as JWTPayload;
}

import { Elysia } from 'elysia';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

export interface JWTPayload {
    userId: string;
    email: string;
}

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
 * Get user from authorization header
 */
export function getUserFromHeader(headers: Record<string, string | undefined>): JWTPayload | null {
    const authHeader = headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    return verifyToken(token);
}

/**
 * Auth plugin - adds user info to context via derive
 */
export const authPlugin = new Elysia({ name: 'auth-plugin' })
    .derive(({ headers }) => {
        const user = getUserFromHeader(headers);
        return { user };
    });

/**
 * Create unauthorized response with proper status
 */
export function unauthorizedError(set: { status?: number }) {
    set.status = 401;
    return { error: 'Unauthorized - Missing or invalid token' };
}

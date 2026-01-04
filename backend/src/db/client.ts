import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Create LibSQL client for Turso
const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

// Export for type inference
export type Database = typeof db;

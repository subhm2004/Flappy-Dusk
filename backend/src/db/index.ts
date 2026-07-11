import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

// Neon needs TLS; the local docker-compose Postgres doesn't have it.
const client = postgres(env.DATABASE_URL, {
  max: 5,
  ssl: env.DATABASE_URL.includes('localhost') ? false : 'require',
});

export const db = drizzle(client, { schema });
export { schema };

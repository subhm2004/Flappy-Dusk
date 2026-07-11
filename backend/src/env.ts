// Loads backend/.env when it exists. In Docker and on Render the values come
// from the real environment instead, and this quietly does nothing.
import 'dotenv/config';
import { z } from 'zod';

/**
 * Every secret this service needs, validated once at boot. A missing value
 * fails the process immediately rather than at the first request.
 */
const schema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production']).default('development'),

  /** Postgres. Neon in production; the docker-compose one locally. */
  DATABASE_URL: z.string().url(),

  /** Signs our own session tokens. Any long random string. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  /** From the Google Cloud console — an OAuth "Web application" client. */
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  /** This service's own public URL — Google redirects back here. */
  API_URL: z.string().url(),

  /** Where to send the browser once sign-in succeeds. */
  WEB_APP_URL: z.string().url(),

  /** Custom scheme that hands the session back to the installed Android app. */
  APP_SCHEME: z.string().default('com.subhm2004.flappydusk'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

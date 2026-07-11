import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env';
import { authRoutes } from './routes/auth';
import { runRoutes } from './routes/runs';
import { leaderboardRoutes } from './routes/leaderboard';

const app = Fastify({
  logger: { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
  trustProxy: true, // Render sits behind a proxy
});

await app.register(cors, {
  origin: (origin, cb) => {
    // Same-origin and non-browser callers (curl, the APK's fetch) send no Origin.
    if (!origin) return cb(null, true);

    // The Android WebView serves the game from https://localhost.
    if (origin === env.WEB_APP_URL || origin === 'https://localhost') return cb(null, true);

    // Any localhost port in development: Next quietly moves to 3001 when 3000 is
    // taken, and a hard-coded port turns that into a silent CORS failure.
    if (env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
      return cb(null, true);
    }

    return cb(new Error('origin not allowed'), false);
  },
});

app.get('/health', async () => ({ ok: true }));

await app.register(authRoutes);
await app.register(runRoutes);
await app.register(leaderboardRoutes);

await app.listen({ port: env.PORT, host: '0.0.0.0' });

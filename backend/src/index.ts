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
  origin: [
    env.WEB_APP_URL,
    // The Android WebView serves the game from this origin (androidScheme: https).
    'https://localhost',
    'http://localhost:3000',
  ],
});

app.get('/health', async () => ({ ok: true }));

await app.register(authRoutes);
await app.register(runRoutes);
await app.register(leaderboardRoutes);

await app.listen({ port: env.PORT, host: '0.0.0.0' });

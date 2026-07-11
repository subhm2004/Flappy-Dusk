import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { env } from '../env';
import { consentUrl, exchangeCode } from '../auth/google';
import { signSession, signState, readState } from '../auth/jwt';
import { requireUser } from './guard';

export async function authRoutes(app: FastifyInstance) {
  /**
   * Starts sign-in. The Android app opens this in the *system browser*, not the
   * WebView — Google refuses OAuth inside embedded browsers.
   */
  app.get('/auth/google', async (req, reply) => {
    const platform = (req.query as { platform?: string }).platform === 'app' ? 'app' : 'web';
    return reply.redirect(consentUrl(await signState(platform)));
  });

  /**
   * Google sends the user back here. We finish the exchange, upsert the player,
   * then hand our own token to whichever client started the flow.
   */
  app.get('/auth/google/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) return reply.code(400).send({ error: 'missing code or state' });

    const platform = await readState(state);
    if (!platform) return reply.code(400).send({ error: 'bad state' });

    const profile = await exchangeCode(code);

    const [user] = await db
      .insert(schema.users)
      .values({ googleSub: profile.sub, name: profile.name, avatarUrl: profile.picture })
      .onConflictDoUpdate({
        target: schema.users.googleSub,
        set: { name: profile.name, avatarUrl: profile.picture },
      })
      .returning();

    const token = await signSession({ userId: user.id, name: user.name });

    // The browser can just take a query string. The app can't — it only ever
    // sees this because Android routes the custom scheme back into it.
    return reply.redirect(
      platform === 'app'
        ? `${env.APP_SCHEME}://auth?token=${encodeURIComponent(token)}`
        : `${env.WEB_APP_URL}/auth/callback#token=${encodeURIComponent(token)}`,
    );
  });

  /** Who am I? Used by the game to show the signed-in name. */
  app.get('/me', async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    const [user] = await db
      .select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
      .from(schema.users)
      .where(eq(schema.users.id, session.userId));

    if (!user) return reply.code(404).send({ error: 'user not found' });
    return user;
  });
}

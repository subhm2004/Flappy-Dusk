import type { FastifyInstance } from 'fastify';
import { desc, max, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { requireUser } from './guard';

const DEFAULT_LIMIT = 50;

export async function leaderboardRoutes(app: FastifyInstance) {
  /** Top players, one row each — a player's best run, not every run. */
  app.get('/leaderboard', async (req) => {
    const limit = Math.min(Number((req.query as { limit?: string }).limit) || DEFAULT_LIMIT, 100);

    const rows = await db
      .select({
        name: schema.users.name,
        avatarUrl: schema.users.avatarUrl,
        best: max(schema.runs.score),
      })
      .from(schema.runs)
      .innerJoin(schema.users, sql`${schema.users.id} = ${schema.runs.userId}`)
      .groupBy(schema.users.id, schema.users.name, schema.users.avatarUrl)
      .orderBy(desc(max(schema.runs.score)))
      .limit(limit);

    return rows.map((r, i) => ({ rank: i + 1, name: r.name, avatarUrl: r.avatarUrl, best: r.best ?? 0 }));
  });

  /** Where the signed-in player sits, even if they're nowhere near the top. */
  app.get('/leaderboard/me', async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    const [row] = await db.execute<{ best: number; rank: number }>(sql`
      with bests as (
        select user_id, max(score) as best from runs group by user_id
      )
      select best, rank from (
        select user_id, best, rank() over (order by best desc) as rank from bests
      ) ranked
      where user_id = ${session.userId}
    `);

    if (!row) return { best: 0, rank: null };
    return { best: Number(row.best), rank: Number(row.rank) };
  });
}

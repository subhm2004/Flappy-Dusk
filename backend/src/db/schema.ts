import { integer, pgTable, real, serial, text, timestamp, index } from 'drizzle-orm/pg-core';

/** One row per Google account that has signed in. */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  /** Google's stable subject id. Emails can change; this doesn't. */
  googleSub: text('google_sub').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * One row per finished run — but only after the server has replayed it and
 * worked out the score itself. Nothing here is taken from the client.
 */
export const runs = pgTable(
  'runs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    score: integer('score').notNull(),
    coins: integer('coins').notNull(),
    keys: integer('keys').notNull(),
    seconds: real('seconds').notNull(),

    /** The inputs the score was derived from — kept so a run can be re-checked. */
    seed: integer('seed').notNull(),
    baseSpeed: real('base_speed').notNull(),
    steps: integer('steps').notNull(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    byScore: index('runs_score_idx').on(t.score),
    byUser: index('runs_user_idx').on(t.userId),
  }),
);

export type User = typeof users.$inferSelect;
export type Run = typeof runs.$inferSelect;

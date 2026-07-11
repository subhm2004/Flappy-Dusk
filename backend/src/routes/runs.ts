import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { replayRun, MAX_REVIVES, MAX_STEPS } from '@flappy/core';
import { db, schema } from '../db';
import { requireUser } from './guard';

/**
 * What the client is allowed to tell us: the inputs of a run, never its score.
 * `replayRun` turns these into a score by re-simulating the run server-side.
 */
const submission = z.object({
  seed: z.number().int().min(0).max(0xffffffff),
  baseSpeed: z.number().finite(),
  steps: z.number().int().min(1).max(MAX_STEPS),
  flaps: z.array(z.number().int().min(0)).max(MAX_STEPS),
  // Continues bought with keys. The replay checks the bird was actually dead at
  // each one, so this can't be used as a mid-flight reset.
  revives: z.array(z.number().int().min(0)).max(MAX_REVIVES).default([]),
});

export async function runRoutes(app: FastifyInstance) {
  app.post('/runs', async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    const parsed = submission.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'malformed run', detail: parsed.error.issues });
    }

    // The whole point: we do not believe the client, we replay it.
    const result = replayRun(parsed.data);
    if (!result.ok) {
      req.log.warn({ userId: session.userId, reason: result.reason }, 'rejected run');
      return reply.code(422).send({ error: 'run rejected', reason: result.reason });
    }

    const [row] = await db
      .insert(schema.runs)
      .values({
        userId: session.userId,
        score: result.score,
        coins: result.coins,
        keys: result.keys,
        seconds: result.seconds,
        seed: parsed.data.seed,
        baseSpeed: parsed.data.baseSpeed,
        steps: parsed.data.steps,
      })
      .returning();

    return reply.code(201).send({
      score: row.score,
      coins: row.coins,
      keys: row.keys,
    });
  });
}

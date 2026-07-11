import type { FastifyReply, FastifyRequest } from 'fastify';
import { readSession, type Session } from '../auth/jwt';

/**
 * Pulls the session off the Authorization header. Replies 401 and returns null
 * when there isn't a valid one, so callers can just `if (!session) return;`.
 */
export async function requireUser(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<Session | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'sign in first' });
    return null;
  }

  const session = await readSession(header.slice('Bearer '.length));
  if (!session) {
    reply.code(401).send({ error: 'session expired' });
    return null;
  }
  return session;
}

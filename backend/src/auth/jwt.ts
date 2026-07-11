import { SignJWT, jwtVerify } from 'jose';
import { env } from '../env';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface Session {
  userId: number;
  name: string;
}

/** Signs the session the game holds on to. 30 days — it's a leaderboard, not a bank. */
export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ name: session.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(session.userId))
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

export async function readSession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) return null;
    return { userId, name: String(payload.name ?? '') };
  } catch {
    return null;
  }
}

/**
 * The OAuth `state` parameter, signed so the callback can trust which platform
 * started the flow — and so a stranger can't forge one.
 */
export async function signState(platform: 'web' | 'app'): Promise<string> {
  return new SignJWT({ platform })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret);
}

export async function readState(state: string): Promise<'web' | 'app' | null> {
  try {
    const { payload } = await jwtVerify(state, secret);
    return payload.platform === 'app' ? 'app' : 'web';
  } catch {
    return null;
  }
}

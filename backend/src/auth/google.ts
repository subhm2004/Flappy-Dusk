import { decodeJwt } from 'jose';
import { env } from '../env';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const REDIRECT_URI = `${env.API_URL}/auth/google/callback`;

/** Where to send the user to pick a Google account. */
export function consentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile',
    state,
    prompt: 'select_account',
  });
  return `${AUTH_URL}?${params}`;
}

export interface GoogleProfile {
  sub: string;
  name: string;
  picture?: string;
}

/**
 * Trades the one-time code for the user's profile.
 *
 * The id_token comes straight back from Google over TLS on a request only we
 * could have made (it carries our client secret), so it is trusted as-is —
 * that is exactly what the authorization-code flow buys you. It would need
 * signature verification only if it had been handed to us by the client.
 */
export async function exchangeCode(code: string): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    throw new Error(`google token exchange failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error('google returned no id_token');

  const claims = decodeJwt(body.id_token);
  const sub = String(claims.sub ?? '');
  if (!sub) throw new Error('google returned no subject');

  return {
    sub,
    name: String(claims.name ?? 'Player'),
    picture: typeof claims.picture === 'string' ? claims.picture : undefined,
  };
}

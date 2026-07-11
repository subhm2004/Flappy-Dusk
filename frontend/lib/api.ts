/**
 * The leaderboard API client.
 *
 * Everything here is optional: with no NEXT_PUBLIC_API_URL the game is exactly
 * what it was before — offline, local progress, no sign-in — and the leaderboard
 * UI simply doesn't appear. That keeps the APK and the web build working even
 * when the backend is asleep or hasn't been deployed.
 */
import type { RunSubmission } from '@flappy/core';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

/** Whether the build was given a backend to talk to at all. */
export const apiEnabled = API_URL.length > 0;

const TOKEN_KEY = 'sunsetFlapToken';

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage may be unavailable */
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage may be unavailable */
  }
}

export interface Me {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  avatarUrl: string | null;
  best: number;
}

export interface MyRank {
  best: number;
  rank: number | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    // The session expired or the server's secret changed — either way, stale.
    clearToken();
    throw new Error('signed out');
  }
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  me: () => call<Me>('/me'),
  leaderboard: () => call<LeaderboardRow[]>('/leaderboard'),
  myRank: () => call<MyRank>('/leaderboard/me'),

  /**
   * Submits the *inputs* of a run. The server replays them and decides the
   * score; whatever we thought we scored is never sent and wouldn't be believed.
   */
  submitRun: (run: RunSubmission) =>
    call<{ score: number; coins: number; keys: number }>('/runs', {
      method: 'POST',
      body: JSON.stringify(run),
    }),
};

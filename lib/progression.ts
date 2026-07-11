/**
 * Progression: player level + XP, daily missions, and achievements.
 * Pure and deterministic (missions are seeded by the date), so it's testable
 * without a browser. React owns the persistence and wiring.
 */

import { makeRng } from './gameLogic';

/* ---------------- levels ---------------- */

/** XP needed to go from `level` to the next. */
export function xpToNext(level: number): number {
  return 100 + (level - 1) * 60;
}

/** Base pipe speed for a given level (slightly faster each level, capped). */
export function levelBaseSpeed(level: number, speed0: number): number {
  return speed0 + Math.min(2.5, (level - 1) * 0.25);
}

/** Adds XP and rolls over into levels. Returns the new level/xp and how many
 *  levels were gained (for a toast). */
export function addXp(
  level: number,
  xp: number,
  gained: number,
): { level: number; xp: number; leveledUp: number } {
  let lv = level;
  let cur = xp + gained;
  let ups = 0;
  while (cur >= xpToNext(lv)) {
    cur -= xpToNext(lv);
    lv += 1;
    ups += 1;
  }
  return { level: lv, xp: cur, leveledUp: ups };
}

/* ---------------- run + lifetime stats ---------------- */

/** Totals for a single completed run, reported by the engine. */
export interface RunStats {
  score: number;
  coins: number;
  keys: number;
  powerups: number;
}

/** Lifetime stats used by achievements. */
export interface LifetimeStats {
  runs: number;
  earnedCoins: number;
  totalKeys: number;
  totalPowerups: number;
  bestScore: number;
}

export const EMPTY_STATS: LifetimeStats = {
  runs: 0,
  earnedCoins: 0,
  totalKeys: 0,
  totalPowerups: 0,
  bestScore: 0,
};

export function foldRun(stats: LifetimeStats, run: RunStats): LifetimeStats {
  return {
    runs: stats.runs + 1,
    earnedCoins: stats.earnedCoins + run.coins,
    totalKeys: stats.totalKeys + run.keys,
    totalPowerups: stats.totalPowerups + run.powerups,
    bestScore: Math.max(stats.bestScore, run.score),
  };
}

/* ---------------- daily missions ---------------- */

export type Metric = 'coins' | 'score' | 'keys' | 'powerups' | 'runs';

interface MissionTemplate {
  id: string;
  metric: Metric;
  min: number;
  max: number;
  /** true = progress is the best single-run value; false = cumulative sum. */
  single?: boolean;
  label: (t: number) => string;
}

const TEMPLATES: MissionTemplate[] = [
  { id: 'coins', metric: 'coins', min: 25, max: 70, label: (t) => `Collect ${t} coins` },

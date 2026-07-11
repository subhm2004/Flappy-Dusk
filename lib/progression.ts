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
  { id: 'score', metric: 'score', min: 10, max: 25, single: true, label: (t) => `Score ${t} in one run` },
  { id: 'keys', metric: 'keys', min: 1, max: 2, label: (t) => `Collect ${t} key${t > 1 ? 's' : ''}` },
  { id: 'powerups', metric: 'powerups', min: 3, max: 8, label: (t) => `Grab ${t} power-ups` },
  { id: 'runs', metric: 'runs', min: 4, max: 10, label: (t) => `Play ${t} games` },
];

export interface Mission {
  id: string;
  metric: Metric;
  single: boolean;
  target: number;
  label: string;
  progress: number;
  done: boolean;
  claimed: boolean;
  rewardCoins: number;
  rewardXp: number;
}

/** A stable seed for a given date (defaults to today). */
export function dateSeed(d = new Date()): number {
  const s = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** `YYYY-MM-DD` key for today (used to detect a new day). */
export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Generates the day's 3 missions, deterministic for a given seed. */
export function generateDailyMissions(seed: number): Mission[] {
  const rng = makeRng(seed);
  const pool = [...TEMPLATES];
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3).map((t) => {
    const target = t.min + Math.floor(rng() * (t.max - t.min + 1));
    return {
      id: t.id,
      metric: t.metric,
      single: !!t.single,
      target,
      label: t.label(target),
      progress: 0,
      done: false,
      claimed: false,
      rewardCoins: 15 + target * 2,
      rewardXp: 30 + target * 3,
    };
  });
}

/** Applies a completed run to the missions, marking any newly finished. */
export function advanceMissions(missions: Mission[], run: RunStats): Mission[] {
  return missions.map((m) => {
    if (m.done) return m;
    let progress = m.progress;
    if (m.metric === 'coins') progress += run.coins;

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

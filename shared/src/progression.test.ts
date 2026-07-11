import { describe, it, expect } from 'vitest';
import { C } from './gameLogic.js';
import {
  addXp,
  advanceMissions,
  ACHIEVEMENTS,
  dateSeed,
  EMPTY_STATS,
  foldRun,
  generateDailyMissions,
  levelBaseSpeed,
  newlyUnlocked,
  todayKey,
  xpToNext,
  type RunStats,
} from './progression.js';

describe('levels / xp', () => {
  it('needs more xp for higher levels', () => {
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1));
  });

  it('rolls xp over into levels', () => {
    const r = addXp(1, 0, xpToNext(1));
    expect(r.level).toBe(2);
    expect(r.xp).toBe(0);
    expect(r.leveledUp).toBe(1);
  });

  it('can gain multiple levels from a big xp grant', () => {
    const r = addXp(1, 0, xpToNext(1) + xpToNext(2) + 5);
    expect(r.level).toBe(3);
    expect(r.xp).toBe(5);
    expect(r.leveledUp).toBe(2);
  });

  it('raises base speed with level, capped', () => {
    expect(levelBaseSpeed(1, C.SPEED0)).toBe(C.SPEED0);
    expect(levelBaseSpeed(3, C.SPEED0)).toBeGreaterThan(C.SPEED0);
    expect(levelBaseSpeed(100, C.SPEED0)).toBeLessThanOrEqual(C.SPEED0 + 2.5 + 1e-9);
  });
});

describe('daily missions', () => {
  it('is deterministic for a given date seed', () => {
    const a = generateDailyMissions(dateSeed(new Date(2026, 6, 11)));
    const b = generateDailyMissions(dateSeed(new Date(2026, 6, 11)));
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
  });

  it('differs across days', () => {
    const a = generateDailyMissions(dateSeed(new Date(2026, 6, 11)));
    const b = generateDailyMissions(dateSeed(new Date(2026, 6, 12)));
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it('todayKey formats as YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('advances progress and eventually marks completion', () => {
    // one big run finishes coins/keys/powerups/score missions; the "runs"
    // mission (metric = games played) needs several runs, so advance enough.
    const big: RunStats = { score: 999, coins: 999, keys: 999, powerups: 999 };
    let cur = generateDailyMissions(1);
    for (let i = 0; i < 12; i++) cur = advanceMissions(cur, big);
    expect(cur.every((m) => m.done)).toBe(true);
    expect(cur.every((m) => m.progress <= m.target)).toBe(true);
  });

  it('does not regress a completed mission', () => {
    const big: RunStats = { score: 999, coins: 999, keys: 999, powerups: 999 };
    let done = generateDailyMissions(2);
    for (let i = 0; i < 12; i++) done = advanceMissions(done, big);
    expect(done.every((m) => m.done)).toBe(true);
    const again = advanceMissions(done, { score: 0, coins: 0, keys: 0, powerups: 0 });
    expect(again).toEqual(done);
  });
});

describe('stats + achievements', () => {
  it('folds a run into lifetime stats', () => {
    const s1 = foldRun(EMPTY_STATS, { score: 12, coins: 5, keys: 1, powerups: 2 });
    expect(s1.runs).toBe(1);
    expect(s1.earnedCoins).toBe(5);
    expect(s1.totalKeys).toBe(1);
    expect(s1.totalPowerups).toBe(2);
    expect(s1.bestScore).toBe(12);
    const s2 = foldRun(s1, { score: 8, coins: 3, keys: 0, powerups: 1 });
    expect(s2.bestScore).toBe(12); // keeps the higher
    expect(s2.earnedCoins).toBe(8);
  });

  it('unlocks the first-flight achievement after one run', () => {
    const stats = foldRun(EMPTY_STATS, { score: 3, coins: 0, keys: 0, powerups: 0 });
    const unlocks = newlyUnlocked([], stats, 1, 1);
    expect(unlocks.map((a) => a.id)).toContain('first');
  });

  it('does not re-unlock an already-unlocked achievement', () => {
    const stats = foldRun(EMPTY_STATS, { score: 3, coins: 0, keys: 0, powerups: 0 });
    const unlocks = newlyUnlocked(['first'], stats, 1, 1);
    expect(unlocks.map((a) => a.id)).not.toContain('first');
  });

  it('unlocks level and collector achievements from level / ownership', () => {
    const level5 = newlyUnlocked([], EMPTY_STATS, 5, 1).map((a) => a.id);
    expect(level5).toContain('level5');
    const collector = newlyUnlocked([], EMPTY_STATS, 1, 6).map((a) => a.id);
    expect(collector).toContain('collector');
  });

  it('every achievement has a positive reward', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.rewardCoins + a.rewardXp).toBeGreaterThan(0);
    }
  });
});

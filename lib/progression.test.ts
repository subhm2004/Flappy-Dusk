import { describe, it, expect } from 'vitest';
import { C } from './gameLogic';
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
} from './progression';

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

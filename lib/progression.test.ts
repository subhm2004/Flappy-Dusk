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

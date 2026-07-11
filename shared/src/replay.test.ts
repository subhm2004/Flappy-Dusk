import { describe, it, expect } from 'vitest';
import { C, createState, flap, step } from './gameLogic.js';
import { levelBaseSpeed } from './progression.js';
import { MAX_STEPS, allowedBaseSpeeds, replayRun, type RunSubmission } from './replay.js';

/**
 * Plays a run the way the browser does — fixed steps, flap between them — and
 * records exactly what the client would send. Whatever this returns, replaying
 * it on the server must reproduce.
 */
function playRun(
  seed: number,
  baseSpeed: number = C.SPEED0,
): { sub: RunSubmission; score: number; coins: number } {
  const state = createState(seed, baseSpeed);
  const flaps: number[] = [];
  let steps = 0;

  for (let i = 0; i < MAX_STEPS; i++) {
    // a dumb autopilot: flap whenever it sinks below the middle
    if (state.birdY < C.CEIL_Y / 2) {
      flap(state);
      flaps.push(i);
    }
    steps = i + 1;
    const ev = step(state, C.DT);
    if (ev.died) break;
  }

  return {
    sub: { seed, baseSpeed, steps, flaps },
    score: state.score,
    coins: state.coins,
  };
}

describe('replayRun', () => {
  it('reproduces a real run exactly', () => {
    const { sub, score, coins } = playRun(12345);
    const result = replayRun(sub);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score).toBe(score);
    expect(result.coins).toBe(coins);
    expect(result.seconds).toBeCloseTo(sub.steps * C.DT, 6);
  });

  it('is deterministic — the same submission always scores the same', () => {
    const { sub } = playRun(999);
    const a = replayRun(sub);
    const b = replayRun(sub);
    expect(a).toEqual(b);
  });

  it('gives different runs for different seeds', () => {
    const a = playRun(1);
    const b = playRun(2);
    // the pipe fields differ, so the autopilot cannot last exactly as long
    expect(a.sub.steps).not.toBe(b.sub.steps);
  });

  it('ignores whatever the client thinks it scored — the score comes from the inputs', () => {
    const { sub, score } = playRun(4242);
    // a "cheater" sends the same inputs but that is all they control
    const result = replayRun({ ...sub });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score).toBe(score);
  });

  it('rejects a run that has not ended in death', () => {
    const { sub } = playRun(7);
    // stop one step short: the bird is still alive
    const result = replayRun({ ...sub, steps: sub.steps - 1, flaps: sub.flaps.filter((f) => f < sub.steps - 1) });
    expect(result).toEqual({ ok: false, reason: 'run did not end in death' });
  });

  it('rejects a run padded with steps after death', () => {
    const { sub } = playRun(8);
    const result = replayRun({ ...sub, steps: sub.steps + 500 });
    expect(result).toEqual({ ok: false, reason: 'died before the last step' });
  });

  it('rejects a base speed the game could never produce', () => {
    const { sub } = playRun(11);
    // a slow run would be far easier, so this is the obvious thing to forge
    expect(replayRun({ ...sub, baseSpeed: 1 })).toEqual({ ok: false, reason: 'bad base speed' });
    expect(replayRun({ ...sub, baseSpeed: 5.3 })).toEqual({ ok: false, reason: 'bad base speed' });
  });

  it('accepts every base speed a level can actually give', () => {
    for (const speed of allowedBaseSpeeds()) {
      const { sub } = playRun(21, speed);
      expect(replayRun(sub).ok).toBe(true);
    }
    expect(allowedBaseSpeeds()).toContain(levelBaseSpeed(1, C.SPEED0));
    expect(allowedBaseSpeeds()).toContain(levelBaseSpeed(11, C.SPEED0));
  });

  it('rejects malformed flap lists', () => {
    const { sub } = playRun(31);
    expect(replayRun({ ...sub, flaps: [5, 5] }).ok).toBe(false);
    expect(replayRun({ ...sub, flaps: [9, 2] }).ok).toBe(false);
    expect(replayRun({ ...sub, flaps: [-1] }).ok).toBe(false);
    expect(replayRun({ ...sub, flaps: [sub.steps] }).ok).toBe(false);
    expect(replayRun({ ...sub, flaps: [1.5] }).ok).toBe(false);
  });

  it('rejects absurd step counts', () => {
    const { sub } = playRun(41);
    expect(replayRun({ ...sub, steps: 0 }).ok).toBe(false);
    expect(replayRun({ ...sub, steps: MAX_STEPS + 1 }).ok).toBe(false);
  });

  it('rejects a bad seed', () => {
    const { sub } = playRun(51);
    expect(replayRun({ ...sub, seed: -1 }).ok).toBe(false);
    expect(replayRun({ ...sub, seed: 1.5 }).ok).toBe(false);
  });
});

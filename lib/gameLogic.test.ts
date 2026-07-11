import { describe, it, expect } from 'vitest';
import {
  C,
  makeRng,
  nextGapY,
  createState,
  flap,
  revive,
  collide,
  collectsCoin,
  collectsKey,
  collectsPower,
  step,
  type State,
  type Pipe,
} from './gameLogic';

/** A bare pipe with no pickups, for collision-style tests. */
function mkPipe(over: Partial<Pipe> = {}): Pipe {
  return {
    x: C.BIRD_X,
    gapY: 5,
    scored: false,
    coin: false,
    coinY: 5,
    coinTaken: false,
    key: false,
    keyY: 5,
    keyTaken: false,
    power: false,
    powerType: 'shield',
    powerY: 5,
    powerTaken: false,
    ...over,
  };
}

/** Runs the sim to `seconds`, flapping every `flapEvery` steps, returns totals. */
function simulate(seed: number, seconds: number, flapEvery: number) {
  const s = createState(seed);
  const steps = Math.round(seconds / C.DT);
  let scored = 0;
  let coined = 0;
  let died = false;
  for (let i = 0; i < steps; i++) {
    if (i % flapEvery === 0) flap(s);
    const ev = step(s, C.DT);
    scored += ev.scored;
    coined += ev.coined;
    if (ev.died) died = true;
  }
  return { s, scored, coined, died };
}

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(123);
    const b = makeRng(123);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('produces different streams for different seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a()).not.toBe(b());
  });

  it('returns values in [0, 1)', () => {
    const r = makeRng(999);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('nextGapY', () => {
  it('stays within the global gap bounds', () => {
    const rng = makeRng(7);
    let gy = 5.1;
    for (let i = 0; i < 500; i++) {
      gy = nextGapY(gy, rng);
      expect(gy).toBeGreaterThanOrEqual(C.GAP_MIN);
      expect(gy).toBeLessThanOrEqual(C.GAP_MAX);
    }
  });

  it('never moves more than GAP_MAX_STEP from the previous gap', () => {
    const rng = makeRng(11);
    let prev = 5.1;
    for (let i = 0; i < 500; i++) {
      const next = nextGapY(prev, rng);
      expect(Math.abs(next - prev)).toBeLessThanOrEqual(C.GAP_MAX_STEP + 1e-9);
      prev = next;
    }
  });
});

describe('createState', () => {
  it('starts ready, centred, and not scored', () => {
    const s = createState(1);
    expect(s.status).toBe('ready');
    expect(s.birdY).toBe(C.READY_Y);
    expect(s.birdVY).toBe(0);
    expect(s.score).toBe(0);
    expect(s.coins).toBe(0);
    expect(s.keys).toBe(0);
    expect(s.baseSpeed).toBe(C.SPEED0);
    expect(s.shield).toBe(false);
    expect(s.magnetT).toBe(0);
    expect(s.slowT).toBe(0);
    expect(s.fastT).toBe(0);
    expect(s.pipes.length).toBeGreaterThan(0);
    expect(
      s.pipes.every((p) => !p.scored && !p.coinTaken && !p.keyTaken && !p.powerTaken),
    ).toBe(true);
  });

  it('is fully deterministic given a seed (including coins)', () => {
    const a = createState(42);
    const b = createState(42);
    const strip = (s: State) => s.pipes.map((p) => ({ ...p }));
    expect(strip(a)).toEqual(strip(b));
  });

  it('places every pickup inside its pipe gap', () => {
    const s = createState(2024);
    for (const p of s.pipes) {
      const top = p.gapY + C.GAP / 2;
      const bot = p.gapY - C.GAP / 2;
      if (p.coin) {
        expect(p.coinY - C.COIN_R).toBeGreaterThanOrEqual(bot - 1e-9);
        expect(p.coinY + C.COIN_R).toBeLessThanOrEqual(top + 1e-9);
      }
      if (p.key) {
        expect(p.keyY - C.KEY_R).toBeGreaterThanOrEqual(bot - 1e-9);
        expect(p.keyY + C.KEY_R).toBeLessThanOrEqual(top + 1e-9);
      }
    }
  });

  it('gives each pipe at most one pickup (coin / key / power)', () => {
    // sweep several seeds so we exercise all pickup types
    for (let seed = 0; seed < 40; seed++) {
      const s = createState(seed);
      for (const p of s.pipes) {
        const n = (p.coin ? 1 : 0) + (p.key ? 1 : 0) + (p.power ? 1 : 0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('flap', () => {
  it('transitions ready -> playing and applies upward velocity', () => {
    const s = createState(1);
    flap(s);
    expect(s.status).toBe('playing');
    expect(s.birdVY).toBe(C.FLAP_VY);
  });

  it('does nothing once dead', () => {
    const s = createState(1);
    s.status = 'dead';
    s.birdVY = -3;
    flap(s);
    expect(s.status).toBe('dead');
    expect(s.birdVY).toBe(-3);
  });
});

describe('collide', () => {
  const pipe: Pipe = mkPipe();

  it('is false when the bird is centred in the gap', () => {
    expect(collide(5, pipe)).toBe(false);
  });

  it('is true when the bird hits the top of the gap', () => {
    expect(collide(5 + C.GAP / 2, pipe)).toBe(true);
  });

  it('is true when the bird hits the bottom of the gap', () => {
    expect(collide(5 - C.GAP / 2, pipe)).toBe(true);
  });

  it('is false when the pipe is horizontally far away', () => {
    expect(collide(20, { ...pipe, x: C.BIRD_X + 10 })).toBe(false);
  });
});

describe('collectsCoin', () => {
  const base: Pipe = mkPipe({ coin: true });

  it('collects when the bird overlaps the coin', () => {
    expect(collectsCoin(5, base)).toBe(true);
  });

  it('does not collect an already-taken coin', () => {
    expect(collectsCoin(5, { ...base, coinTaken: true })).toBe(false);
  });

  it('does not collect a pipe without a coin', () => {
    expect(collectsCoin(5, { ...base, coin: false })).toBe(false);
  });

  it('does not collect when vertically out of reach', () => {
    expect(collectsCoin(5 + C.COIN_R + C.BIRD_R + 0.5, base)).toBe(false);
  });
});

describe('collectsKey', () => {
  const base: Pipe = mkPipe({ key: true });

  it('collects when the bird overlaps the key', () => {
    expect(collectsKey(5, base)).toBe(true);
  });

  it('does not collect an already-taken key', () => {
    expect(collectsKey(5, { ...base, keyTaken: true })).toBe(false);
  });

  it('does not collect a pipe without a key', () => {
    expect(collectsKey(5, { ...base, key: false })).toBe(false);
  });

  it('does not collect when vertically out of reach', () => {
    expect(collectsKey(5 + C.KEY_R + C.BIRD_R + 0.5, base)).toBe(false);
  });
});

describe('collectsPower', () => {
  const base: Pipe = mkPipe({ power: true, powerType: 'magnet' });

  it('collects when the bird overlaps the power-up', () => {
    expect(collectsPower(5, base)).toBe(true);
  });

  it('does not collect an already-taken power-up', () => {
    expect(collectsPower(5, { ...base, powerTaken: true })).toBe(false);
  });

  it('does not collect a pipe without a power-up', () => {
    expect(collectsPower(5, { ...base, power: false })).toBe(false);
  });
});

describe('power-ups', () => {
  it('a shield absorbs one otherwise-fatal hit', () => {
    const s = createState(1);
    s.status = 'playing';
    s.shield = true;
    // a pipe whose gap sits well below the bird, so the bird hits its top
    s.birdY = 8;
    s.pipes = [mkPipe({ x: C.BIRD_X, gapY: 3 })];
    const ev = step(s, C.DT);
    expect(ev.shieldUsed).toBe(true);
    expect(ev.died).toBe(false);
    expect(s.status).toBe('playing');
    expect(s.shield).toBe(false);
    expect(s.invT).toBeGreaterThan(0);
  });

  it('slow-mo moves pipes slower than normal', () => {
    const normal = createState(1);
    normal.status = 'playing';
    const slow = createState(1);
    slow.status = 'playing';
    slow.slowT = C.SLOW_TIME;
    const x0 = normal.pipes[0].x;
    step(normal, C.DT);
    step(slow, C.DT);
    const movedNormal = x0 - normal.pipes[0].x;
    const movedSlow = x0 - slow.pipes[0].x;
    expect(movedSlow).toBeLessThan(movedNormal);
  });

  it('fast-mo moves pipes faster than normal', () => {
    const normal = createState(1);
    normal.status = 'playing';
    const fast = createState(1);
    fast.status = 'playing';
    fast.fastT = C.FAST_TIME;
    const x0 = normal.pipes[0].x;
    step(normal, C.DT);
    step(fast, C.DT);
    expect(x0 - fast.pipes[0].x).toBeGreaterThan(x0 - normal.pipes[0].x);
  });

  it('power-up timers count down and expire', () => {
    const s = createState(1);
    s.status = 'playing';
    s.magnetT = 2 * C.DT;
    step(s, C.DT);
    expect(s.magnetT).toBeGreaterThan(0);
    step(s, C.DT);
    expect(s.magnetT).toBe(0);
  });
});

describe('baseSpeed / level', () => {
  it('defaults to SPEED0', () => {
    const s = createState(1);
    expect(s.baseSpeed).toBe(C.SPEED0);
    expect(s.speed).toBe(C.SPEED0);
  });

  it('accepts a raised base speed and ramps from it', () => {
    const s = createState(1, 7);
    expect(s.baseSpeed).toBe(7);
    expect(s.speed).toBe(7);
    s.status = 'playing';
    // force a score by placing a pipe just past the bird
    s.pipes = [mkPipe({ x: C.BIRD_X - C.PIPE_R - C.BIRD_R - 0.1, gapY: C.READY_Y })];
    s.birdY = C.READY_Y;
    step(s, C.DT);
    expect(s.score).toBe(1);
    expect(s.speed).toBeGreaterThanOrEqual(7);
  });
});

describe('revive', () => {
  it('returns to playing, recentres the bird, and keeps score/coins/keys', () => {
    const s = createState(3);
    s.status = 'dead';
    s.score = 12;
    s.coins = 7;
    s.keys = 2;
    s.speed = C.SPEED_MAX;
    revive(s);
    expect(s.status).toBe('playing');
    expect(s.birdY).toBe(C.READY_Y);
    expect(s.birdVY).toBe(0);
    expect(s.score).toBe(12);
    expect(s.coins).toBe(7);
    expect(s.keys).toBe(2);
    expect(s.speed).toBe(C.SPEED_MAX);
    expect(s.baseSpeed).toBe(C.SPEED0);
    expect(s.invT).toBeGreaterThan(0); // brief grace after revive
    expect(s.pipes.length).toBeGreaterThan(0);
    // the fresh field gives breathing room before the first pipe
    expect(Math.min(...s.pipes.map((p) => p.x))).toBeGreaterThanOrEqual(C.FIRST_PIPE_X);
  });
});

describe('step', () => {
  it('applies gravity while playing', () => {
    const s = createState(1);
    s.status = 'playing';
    const before = s.birdVY;
    step(s, C.DT);
    expect(s.birdVY).toBeLessThan(before);
  });

  it('clamps the bird at the ceiling', () => {
    const s = createState(1);
    s.status = 'playing';
    s.birdY = C.CEIL_Y;
    s.birdVY = C.FLAP_VY;
    step(s, C.DT);
    expect(s.birdY + C.BIRD_R).toBeLessThanOrEqual(C.CEIL_Y + 1e-9);
  });

  it('kills the bird on the ground', () => {
    const s = createState(1);
    s.status = 'playing';
    s.birdY = C.GROUND_Y;
    s.birdVY = -5;
    const ev = step(s, C.DT);
    expect(ev.died).toBe(true);
    expect(s.status).toBe('dead');
  });

  it('does not score or move pipes once dead', () => {
    const s = createState(1);
    s.status = 'dead';
    const xs = s.pipes.map((p) => p.x);
    const ev = step(s, C.DT);
    expect(ev.scored).toBe(0);
    expect(s.pipes.map((p) => p.x)).toEqual(xs);
  });

  it('produces identical results for identical seeds and inputs', () => {
    const a = simulate(77, 6, 24);
    const b = simulate(77, 6, 24);
    expect(a.scored).toBe(b.scored);

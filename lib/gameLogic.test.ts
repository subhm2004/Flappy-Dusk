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

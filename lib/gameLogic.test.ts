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

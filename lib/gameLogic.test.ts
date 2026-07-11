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

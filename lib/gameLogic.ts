/**
 * Pure game logic: no DOM, no THREE.
 * Deterministic given a seed, so this exact code can be unit-tested headlessly.
 * The Flappy Dusk game core: extended with coins, rare keys, and power-ups
 * (shield / magnet / slow-mo / fast-mo), plus a level-driven base speed.
 */

export type PowerType = 'shield' | 'magnet' | 'slow' | 'fast';
export const POWER_TYPES: PowerType[] = ['shield', 'magnet', 'slow', 'fast'];

export interface Pipe {
  x: number;
  gapY: number;
  scored: boolean;
  coin: boolean;
  coinY: number;
  coinTaken: boolean;
  key: boolean;
  keyY: number;
  keyTaken: boolean;
  power: boolean;
  powerType: PowerType;
  powerY: number;
  powerTaken: boolean;
}

export type Status = 'ready' | 'playing' | 'dead';

export interface State {
  status: Status;
  time: number;
  birdY: number;
  birdVY: number;
  pipes: Pipe[];
  /** Current pipe speed (ramps up with score from `baseSpeed`). */
  speed: number;
  /** Starting speed for this run (raised by the player's level). */
  baseSpeed: number;
  score: number;
  coins: number;
  keys: number;
  /** Active power-up state. */
  shield: boolean;
  invT: number;
  magnetT: number;
  slowT: number;
  fastT: number;
  rng: () => number;
}

/** Events emitted by a single simulation step, consumed by the renderer/UI. */
export interface StepEvent {
  scored: number;
  coined: number;
  keyed: number;
  powered: number;
  power: PowerType | null;
  shieldUsed: boolean;
  died: boolean;
}

export const C = {
  GRAVITY: -23,
  FLAP_VY: 7.6,
  MAX_FALL: -13,
  BIRD_X: -3,
  BIRD_R: 0.42,
  PIPE_R: 1.05,
  GAP: 4.0,
  PIPE_SPACING: 6.8,
  SPAWN_X: 24,
  DESPAWN_X: -16,
  FIRST_PIPE_X: 14,
  GAP_MIN: 2.9,
  GAP_MAX: 7.4,
  GAP_MAX_STEP: 2.6,
  GROUND_Y: 0,
  CEIL_Y: 10.4,
  SPEED0: 5.2,
  SPEED_RAMP: 0.07,
  SPEED_MAX: 9,
  READY_Y: 4.6,
  DT: 1 / 120,
  COIN_R: 0.34,
  KEY_R: 0.34,
  POWER_R: 0.42,
  /** Probability a pipe spawns a rare key (keys are meant to be scarce). */
  KEY_CHANCE: 0.02,
  /** Probability a (non-key) pipe spawns a power-up. */
  POWER_CHANCE: 0.09,
  /** Probability a (non-key, non-power) pipe spawns a coin. */
  COIN_CHANCE: 0.68,
  MAGNET_TIME: 6,
  SLOW_TIME: 5,
  FAST_TIME: 5,
  SLOW_FACTOR: 0.55,
  FAST_FACTOR: 1.6,
  INV_TIME: 0.7,
  MAGNET_REACH_X: 2.3,
  MAGNET_REACH_Y: 3.2,
} as const;

/** Mulberry32 — a tiny, fast, seedable PRNG. */
export function makeRng(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function nextGapY(prevGapY: number, rng: () => number): number {
  const lo = Math.max(C.GAP_MIN, prevGapY - C.GAP_MAX_STEP);
  const hi = Math.min(C.GAP_MAX, prevGapY + C.GAP_MAX_STEP);
  return lo + (hi - lo) * rng();
}

/**
 * Builds one pipe (plus at most one pickup) from the gap centre. A pipe carries
 * at most one of: a rare key, a power-up, or a coin — checked in that priority.
 * Always consumes exactly five rng values so the stream stays stable.
 */
function makePipe(x: number, gapY: number, rng: () => number): Pipe {
  const keyRoll = rng();
  const powerRoll = rng();
  const coinRoll = rng();
  const typeRoll = rng();
  const spread = Math.max(0, C.GAP / 2 - C.COIN_R - 0.22);
  const y = gapY + (rng() * 2 - 1) * spread;

  const key = keyRoll < C.KEY_CHANCE;
  const power = !key && powerRoll < C.POWER_CHANCE;
  const coin = !key && !power && coinRoll < C.COIN_CHANCE;
  const powerType =
    POWER_TYPES[Math.min(POWER_TYPES.length - 1, Math.floor(typeRoll * POWER_TYPES.length))];

  return {
    x,
    gapY,
    scored: false,
    coin,
    coinY: y,
    coinTaken: false,
    key,
    keyY: y,
    keyTaken: false,
    power,
    powerType,
    powerY: y,
    powerTaken: false,
  };
}

function buildField(rng: () => number): Pipe[] {
  const pipes: Pipe[] = [];
  let gy = 5.1;
  for (let x = C.FIRST_PIPE_X; x <= C.SPAWN_X; x += C.PIPE_SPACING) {
    gy = nextGapY(gy, rng);
    pipes.push(makePipe(x, gy, rng));
  }
  return pipes;
}

export function createState(seed?: number, baseSpeed?: number): State {
  const rng = makeRng(seed === undefined ? Date.now() & 0xffffffff : seed);
  const bs = baseSpeed === undefined ? C.SPEED0 : baseSpeed;
  return {
    status: 'ready',
    time: 0,
    birdY: C.READY_Y,
    birdVY: 0,
    pipes: buildField(rng),
    speed: bs,
    baseSpeed: bs,
    score: 0,
    coins: 0,
    keys: 0,
    shield: false,
    invT: 0,
    magnetT: 0,
    slowT: 0,
    fastT: 0,
    rng,
  };
}

export function flap(s: State): void {
  if (s.status === 'ready') s.status = 'playing';
  if (s.status !== 'playing') return;
  s.birdVY = C.FLAP_VY;
}

/**
 * Revives a dead run: keeps score, coins, keys, and base speed, but drops the
 * bird back to centre with a fresh field and a brief grace window. Active
 * power-ups are cleared.
 */
export function revive(s: State): void {
  s.status = 'playing';
  s.birdY = C.READY_Y;
  s.birdVY = 0;
  s.pipes = buildField(s.rng);

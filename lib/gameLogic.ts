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


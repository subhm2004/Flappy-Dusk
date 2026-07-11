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


/**
 * Bird cosmetics. Purely presentational — the game logic never sees these.
 * Costs are paid from lifetime coins. The first skin is free and always owned.
 */

export interface Skin {
  id: string;
  name: string;
  /** Cost in lifetime coins. 0 = free / default. */
  cost: number;
  body: number;
  wing: number;
  belly: number;
  beak: number;
  tail: number;
}

export const SKINS: Skin[] = [

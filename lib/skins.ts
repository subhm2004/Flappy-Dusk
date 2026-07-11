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
  {
    id: 'coral',
    name: 'Coral',
    cost: 0,
    body: 0xff6f59,
    wing: 0xe4543f,
    belly: 0xffe7cc,
    beak: 0xffb13d,
    tail: 0xe4543f,
  },
  {
    id: 'sky',
    name: 'Bluebird',
    cost: 30,
    body: 0x5ba8ff,
    wing: 0x3e7fd0,
    belly: 0xe9f3ff,
    beak: 0xffb13d,

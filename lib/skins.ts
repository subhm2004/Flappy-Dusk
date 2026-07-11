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
    tail: 0x3e7fd0,
  },
  {
    id: 'mint',
    name: 'Mint',
    cost: 60,
    body: 0x57d9a3,
    wing: 0x39b487,
    belly: 0xeafff5,
    beak: 0xffc94d,
    tail: 0x39b487,
  },
  {
    id: 'grape',
    name: 'Grape',
    cost: 100,
    body: 0x9b6be0,
    wing: 0x7b4bd0,
    belly: 0xf0e7ff,
    beak: 0xffb13d,
    tail: 0x7b4bd0,
  },
  {
    id: 'sunny',
    name: 'Sunny',
    cost: 150,
    body: 0xffc94d,
    wing: 0xf0a81f,
    belly: 0xfff3d0,
    beak: 0xff8a3d,
    tail: 0xf0a81f,
  },
  {
    id: 'ember',
    name: 'Ember',
    cost: 250,
    body: 0x3a2e3a,
    wing: 0xff5a3c,
    belly: 0xffb199,
    beak: 0xffc94d,
    tail: 0xff5a3c,
  },
];

export const DEFAULT_SKIN = SKINS[0].id;

export function skinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

/** CSS hex string for a numeric color, handy for DOM swatches. */
export function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

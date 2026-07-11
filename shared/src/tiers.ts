/**
 * Pipe tiers.
 *
 * The pipes change colour as the run goes on, so a long run *looks* like a long
 * run — you can tell at a glance roughly how far someone got. Purely cosmetic:
 * the physics never reads any of this, which is why it can live next to the
 * game core without the replay having to care about it.
 */

export interface PipeTier {
  /** Score at which this tier takes over. */
  from: number;
  name: string;
  /** Pipe body. */
  body: number;
  /** The rim at the mouth of each pipe. */
  rim: number;
}

export const PIPE_TIERS: PipeTier[] = [
  // The first tier is the game's original green — nothing changes until 50.
  { from: 0, name: 'Grove', body: 0x62c88f, rim: 0x3fa070 },
  { from: 50, name: 'Amber', body: 0xe8a94e, rim: 0xc07f2c },
  { from: 100, name: 'Orchid', body: 0xa87ce0, rim: 0x7f52b8 },
  { from: 150, name: 'Ember', body: 0xe4695f, rim: 0xb8453d },
];

/** The tier a given score is in. Scores below the first threshold get the first tier. */
export function tierFor(score: number): PipeTier {
  let tier = PIPE_TIERS[0];
  for (const t of PIPE_TIERS) {
    if (score >= t.from) tier = t;
  }
  return tier;
}

/**
 * True when crossing from `prev` to `next` moves the player into a new tier —
 * the moment to recolour the pipes and say so.
 */
export function crossedTier(prev: number, next: number): boolean {
  return tierFor(prev) !== tierFor(next);
}

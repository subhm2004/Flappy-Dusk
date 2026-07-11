/**
 * The coin economy.
 *
 * Keys are the scarce currency — they only drop from about 2% of pipes, and the
 * best skins are gated behind them. These bundles give a player who has coins
 * but no luck a way through, at a rate that gets better the more you buy.
 */

export interface KeyBundle {
  id: string;
  keys: number;
  cost: number;
  /** Shown on the card so the discount is obvious. */
  label: string;
}

export const KEY_BUNDLES: KeyBundle[] = [
  { id: 'key1', keys: 1, cost: 1000, label: 'Single key' },
  { id: 'key3', keys: 3, cost: 1700, label: 'Key trio' },
  { id: 'key5', keys: 5, cost: 2200, label: 'Key hoard' },
];

export function bundleById(id: string): KeyBundle | undefined {
  return KEY_BUNDLES.find((b) => b.id === id);
}

/** Coins per key, so the UI can point at the best deal rather than making people work it out. */
export function coinsPerKey(bundle: KeyBundle): number {
  return bundle.cost / bundle.keys;
}

/** The bundle with the lowest coins-per-key. */
export function bestValueBundle(): KeyBundle {
  return KEY_BUNDLES.reduce((best, b) => (coinsPerKey(b) < coinsPerKey(best) ? b : best));
}

export interface Purse {
  coins: number;
  keys: number;
}

export type BuyResult = { ok: true; purse: Purse } | { ok: false; reason: 'unknown bundle' | 'not enough coins' };

/**
 * Buys a bundle. Returns a new purse and never mutates the old one, so a failed
 * purchase can't leave the player half-charged.
 */
export function buyKeyBundle(purse: Purse, bundleId: string): BuyResult {
  const bundle = bundleById(bundleId);
  if (!bundle) return { ok: false, reason: 'unknown bundle' };
  if (purse.coins < bundle.cost) return { ok: false, reason: 'not enough coins' };

  return {
    ok: true,
    purse: {
      coins: purse.coins - bundle.cost,
      keys: purse.keys + bundle.keys,
    },
  };
}

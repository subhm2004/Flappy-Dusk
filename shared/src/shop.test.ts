import { describe, it, expect } from 'vitest';
import { KEY_BUNDLES, bestValueBundle, buyKeyBundle, coinsPerKey } from './shop.js';
import { PIPE_TIERS, crossedTier, tierFor } from './tiers.js';

describe('key bundles', () => {
  it('charges coins and hands over keys', () => {
    const result = buyKeyBundle({ coins: 1200, keys: 2 }, 'key1');
    expect(result).toEqual({ ok: true, purse: { coins: 200, keys: 3 } });
  });

  it('refuses a purchase the player cannot afford, leaving the purse untouched', () => {
    const purse = { coins: 999, keys: 0 };
    const result = buyKeyBundle(purse, 'key1');
    expect(result).toEqual({ ok: false, reason: 'not enough coins' });
    expect(purse).toEqual({ coins: 999, keys: 0 });
  });

  it('refuses an unknown bundle', () => {
    expect(buyKeyBundle({ coins: 99999, keys: 0 }, 'key99')).toEqual({
      ok: false,
      reason: 'unknown bundle',
    });
  });

  it('gets cheaper per key the more you buy', () => {
    const rates = KEY_BUNDLES.map(coinsPerKey);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeLessThan(rates[i - 1]);
    }
    expect(bestValueBundle().id).toBe('key5');
  });

  it('spends exactly the advertised cost', () => {
    for (const bundle of KEY_BUNDLES) {
      const result = buyKeyBundle({ coins: bundle.cost, keys: 0 }, bundle.id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.purse).toEqual({ coins: 0, keys: bundle.keys });
    }
  });
});

describe('pipe tiers', () => {
  it('starts on the first tier', () => {
    expect(tierFor(0)).toBe(PIPE_TIERS[0]);
    expect(tierFor(49)).toBe(PIPE_TIERS[0]);
  });

  it('changes at 50, 100 and 150', () => {
    expect(tierFor(50).name).toBe('Amber');
    expect(tierFor(99).name).toBe('Amber');
    expect(tierFor(100).name).toBe('Orchid');
    expect(tierFor(149).name).toBe('Orchid');
    expect(tierFor(150).name).toBe('Ember');
    expect(tierFor(9999).name).toBe('Ember');
  });

  it('flags exactly the score that crosses a boundary', () => {
    expect(crossedTier(49, 50)).toBe(true);
    expect(crossedTier(50, 51)).toBe(false);
    expect(crossedTier(99, 100)).toBe(true);
    expect(crossedTier(149, 150)).toBe(true);
    expect(crossedTier(150, 151)).toBe(false);
  });

  it('gives every tier a distinct colour', () => {
    const bodies = new Set(PIPE_TIERS.map((t) => t.body));
    expect(bodies.size).toBe(PIPE_TIERS.length);
  });
});

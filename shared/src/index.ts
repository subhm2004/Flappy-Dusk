/**
 * The game core, shared by the browser game and the backend.
 *
 * Everything here is pure and deterministic: given the same seed and the same
 * sequence of flaps, `step()` produces the same run every time. That is what
 * lets the backend replay a submitted run and compute the score itself instead
 * of trusting whatever the client claims.
 */
export * from './gameLogic.js';
export * from './progression.js';
export * from './replay.js';
export * from './shop.js';
export * from './tiers.js';

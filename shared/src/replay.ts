/**
 * Run replay — the reason the leaderboard can be trusted.
 *
 * The game never tells the server what it scored. It sends the *inputs*: the
 * seed the run was generated from, the base speed, how many physics steps it
 * lasted, and the step index of every flap. The server then replays the run
 * through the very same `step()` the browser used and works out the score
 * itself. A client that claims 999999 gets whatever its inputs actually earn.
 *
 * This only works because the core is deterministic: `C.DT` is a fixed
 * timestep, the RNG is seeded, and `step()` reads nothing but its arguments.
 *
 * It is not bot-proof — a program that genuinely plays well still scores well —
 * but a score can no longer be invented out of thin air.
 */
import { C, createState, flap, step } from './gameLogic.js';
import { levelBaseSpeed } from './progression.js';

/** What the client sends after a run ends. */
export interface RunSubmission {
  /** The seed the pipe field was generated from. */
  seed: number;
  /** Base pipe speed, which the player's level fixes. */
  baseSpeed: number;
  /** How many fixed steps the run lasted, death included. */
  steps: number;
  /** Step indices where the player flapped, ascending and unique. */
  flaps: number[];
}

export interface ReplayOk {
  ok: true;
  score: number;
  coins: number;
  keys: number;
  /** Wall-clock length of the run, derived from the step count. */
  seconds: number;
}

export interface ReplayFailed {
  ok: false;
  reason: string;
}

export type ReplayResult = ReplayOk | ReplayFailed;

/** 30 minutes at 120Hz. Long enough for any real run; short enough to replay cheaply. */
export const MAX_STEPS = 120 * 60 * 30;

/** Highest level that still changes the speed — beyond this `levelBaseSpeed` is capped. */
const MAX_SPEED_LEVEL = 11;

/**
 * The only base speeds the game can actually produce. A cheater who asks for a
 * slow, easy run is rejected here; asking for a fast one only makes it harder.
 */
export function allowedBaseSpeeds(): number[] {
  const out: number[] = [];
  for (let level = 1; level <= MAX_SPEED_LEVEL; level++) {
    const s = levelBaseSpeed(level, C.SPEED0);
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

function isAllowedBaseSpeed(speed: number): boolean {
  return allowedBaseSpeeds().some((s) => Math.abs(s - speed) < 1e-9);
}

/** Rejects anything that isn't a well-formed, physically possible submission. */
function check(sub: RunSubmission): string | null {
  const { seed, baseSpeed, steps, flaps } = sub;

  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return 'bad seed';
  if (!Number.isFinite(baseSpeed) || !isAllowedBaseSpeed(baseSpeed)) return 'bad base speed';
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_STEPS) return 'bad step count';
  if (!Array.isArray(flaps) || flaps.length > steps) return 'bad flaps';

  let prev = -1;
  for (const f of flaps) {
    if (!Number.isInteger(f) || f < 0 || f >= steps) return 'flap out of range';
    if (f <= prev) return 'flaps must be ascending and unique';
    prev = f;
  }
  return null;
}

/**
 * Replays a submitted run and returns what it *actually* scored.
 *
 * The run must end in death on its final step — you cannot submit a run still
 * in progress, and you cannot pad a short run with extra steps.
 */
export function replayRun(sub: RunSubmission): ReplayResult {
  const bad = check(sub);
  if (bad) return { ok: false, reason: bad };

  const state = createState(sub.seed, sub.baseSpeed);
  let next = 0;

  for (let i = 0; i < sub.steps; i++) {
    // The game applies a flap immediately, before the next fixed step runs, so
    // a flap recorded at step i is applied here, ahead of step i.
    while (next < sub.flaps.length && sub.flaps[next] === i) {
      flap(state);
      next++;
    }

    const ev = step(state, C.DT);

    if (ev.died) {
      // Death has to land on the last step: the client stops counting the
      // moment it dies, so anything after that is padding.
      if (i !== sub.steps - 1) return { ok: false, reason: 'died before the last step' };
    }
  }

  if (state.status !== 'dead') return { ok: false, reason: 'run did not end in death' };

  return {
    ok: true,
    score: state.score,
    coins: state.coins,
    keys: state.keys,
    seconds: sub.steps * C.DT,
  };
}

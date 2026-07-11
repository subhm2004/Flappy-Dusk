<p align="center">
  <img src="docs/banner.svg" alt="Flappy Dusk — a cozy 3D flappy adventure" width="100%">
</p>

<h1 align="center">Flappy Dusk</h1>

<p align="center">
  A pretty, playable <b>3D flappy-bird</b> game — coins, power-ups, rare keys,
  daily missions, levels, and a bird shop.<br>
  Built with <b>Next.js</b>, <b>TypeScript</b>, and <b>Three.js</b>.
</p>

<p align="center">
  <a href="https://github.com/subhm2004/Flappy-Dusk/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/subhm2004/Flappy-Dusk/actions/workflows/ci.yml/badge.svg">
  </a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-r160-000000?logo=threedotjs&logoColor=white">
  <img alt="Tests" src="https://img.shields.io/badge/tests-73%20passing-3FA070">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-FF6F59">
</p>

<p align="center">
  <a href="https://flappy-dusk.vercel.app">
    <img alt="Play now" src="https://img.shields.io/badge/▶%20Play%20now-in%20your%20browser-FF6F59?style=for-the-badge">
  </a>
  &nbsp;
  <a href="https://github.com/subhm2004/Flappy-Dusk/releases/latest/download/flappy-dusk.apk">
    <img alt="Download APK" src="https://img.shields.io/badge/⬇%20Download-Android%20APK-3FA070?style=for-the-badge&logo=android&logoColor=white">
  </a>
</p>

---

## Demo

<p align="center">
  <img src="docs/demo.gif" alt="Flappy Dusk gameplay" width="640">
</p>

> The GIF above is a **stylized preview** of the game loop. To drop in a real
> screen recording, see [Recording your own demo](#recording-your-own-demo).

---

## Download & play

**🌐 In the browser** — [flappy-dusk.vercel.app](https://flappy-dusk.vercel.app).
Nothing to install; your progress is saved locally in the browser.

**🤖 On Android** — grab
[**flappy-dusk.apk**](https://github.com/subhm2004/Flappy-Dusk/releases/latest/download/flappy-dusk.apk)
from the [latest release](https://github.com/subhm2004/Flappy-Dusk/releases/latest).
It's the same game running in a native shell, so it works fully offline.

<details>
<summary>Installing the APK on your phone</summary>

<br>

1. Open the download link above on the phone (or copy the `.apk` across).
2. Tap the file. Android will ask you to allow **Install unknown apps** for
   whichever app you opened it from — Chrome, Files, whatever. Allow it.
3. Play Protect will warn you as well. Tap **Install anyway**.

Both prompts are expected. The APK is **debug-signed**, not distributed through
the Play Store — fine for playing yourself and sharing with friends. See
[DEPLOYMENT.md](DEPLOYMENT.md#release-signing) for what a store-grade build
would need.

</details>

---

## Table of contents

- [About](#about)
- [Features](#features)
- [Controls](#controls)
- [How to play](#how-to-play)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [How it works](#how-it-works)
- [Testing](#testing)
- [Deploying](#deploying)
- [Recording your own demo](#recording-your-own-demo)
- [Roadmap](#roadmap)
- [License](#license)

---

## About

**Flappy Dusk** reimagines tap-to-fly gameplay as a warm, papercraft 3D scene at
sunset: a round little finch, drifting clouds, violet dunes, and a glowing sun on
the horizon — all rendered in real time with Three.js.

Under the pretty surface, it's built like a real game:

- The **game core is pure** — no DOM, no Three.js, fully deterministic given a
  seed. It runs headlessly in unit tests.
- The **renderer is imperative** and runs a fixed-timestep loop at 120 Hz, so the
  animation never triggers a React re-render.
- **React owns the meta-game** — currencies, shop, missions, levels, settings —
  and talks to the engine through a small ref bridge.

---

## Features

### 🎮 Core gameplay
- Fixed-timestep physics (120 Hz) with smooth rendering at display rate
- Procedurally generated pipes from a seeded PRNG — runs are fully reproducible
- Bird tilt, wing flapping, flap puffs, and a death tumble

### 🪙 Coins & the bird shop
- Coins float **inside the pipe gaps** — the edge ones make you fly close to a pipe
- Spend lifetime coins in the **shop** to unlock 6 bird skins; the bird recolours live

### 🔑 Rare blue keys & continues
- Very rarely (~2% of pipes) a glowing **blue key** floats in a gap
- On death, spend keys to **continue the same run** instead of ending it
- The cost **escalates within a run**: `1 → 4 → 8 → 18 → 32 …`, so repeated saves hurt

### ⚡ Power-ups

| | Power-up | Effect |
|---|---|---|
| 🛡 | **Shield** | Absorbs one otherwise-fatal hit, plus a brief grace window |
| 🧲 | **Magnet** | Pulls nearby coins toward the bird for 6s |
| 🐢 | **Slow-mo** | Slows the world to 55% for 5s |
| ⚡ | **Fast-mo** | Speeds the world to 160% for 5s — risk/reward |

A live HUD shows active effects and their countdown.

### 📈 Levels, missions & achievements
- **Daily missions** — three date-seeded goals (collect coins, score N in a run,
  grab power-ups, play N games …), each rewarding coins + XP
- **Achievements** — 11 milestone unlocks (First Flight, High Flyer, Coin Hoarder,
  Locksmith, Rising Star, Fashionista …)
- **Levels** — missions and achievements grant XP; filling the bar levels you up,
  and **each level nudges the base speed up**, so the game grows with you

### 🏆 Global leaderboard

- Sign in with Google — your name comes straight from your account
- Every run you finish without a revive is ranked
- **Scores are verified, not trusted.** The game sends the *inputs* of a run —
  seed, base speed, and the step index of every flap — and the server replays
  them through the same physics to work out the score itself. `{"score": 999999}`
  isn't a cheat the protocol can express; there's no such field to forge.
- Optional. With no API configured the game is exactly what it was: offline,
  local, no sign-in.

### 🎨 Pipe tiers

The pipes change colour as you climb — **Grove** green, then **Amber** at 50,
**Orchid** at 100, **Ember** at 150 — so a long run looks like one.

### ✨ Polish
- Medals on game over — Bronze / Silver / Gold / Platinum
- Screen-shake, death flash, and coloured tints while slow/fast-mo is active
- Mobile **haptics** on flap, coin, key, power-up, and death
- Procedural audio via Web Audio oscillators — **zero audio assets**
- Pause (auto-pauses when the tab loses focus) and a settings menu
- Everything honours `prefers-reduced-motion`
- All progress persists in `localStorage`

---

## Controls

| Action | Input |
|---|---|
| Flap | **Tap** / **Click** / `Space` / `↑` / `W` |
| Pause | `P` / `Esc` / the ⏸ button |
| Mute | `M` / the 🔊 button |

---

## How to play

1. The **home screen** shows your best score, level, coins, and keys. Hit **▶ Play**.
2. Flap to thread the gaps. Every pipe you pass is **+1**.
3. Grab **coins** for the shop, **power-ups** for an edge, and **keys** to buy
   yourself a second chance.
4. When you die you can **Continue** with keys — or take the medal and go again.
5. Finish **daily missions** and **achievements** to earn XP and level up.
   Careful: higher levels start faster.

---

## Getting started

**Requirements:** Node.js 18+

```bash
cd flappy-dusk
npm install
npm run dev
```

Open **http://localhost:3000**.

---

## Scripts

Run from the repo root — one `npm install` wires up all three workspaces.

| Script | Does |
|---|---|
| `npm run dev` | The game, on http://localhost:3000 |
| `npm run api` | The leaderboard API, on http://localhost:8080 |
| `npm run build` | Static export → `frontend/out` |
| `npm test` | 73 tests (all of them live in `shared/`) |
| `npm run typecheck` | `tsc --noEmit` across every workspace |

---

## Project structure

One repo, three workspaces. The game core sits in the middle because *both*
sides need it — the browser to play a run, the server to replay it.

```
shared/                   @flappy/core — pure, deterministic, DOM-free
  src/gameLogic.ts          physics, pipes, collisions, scoring
  src/progression.ts        levels/XP, daily missions, achievements
  src/replay.ts             re-runs a submitted run to verify its score
  src/shop.ts               key bundles and the coin economy
  src/tiers.ts              pipe colours at 50 / 100 / 150
  src/*.test.ts             73 tests — the whole suite lives here

frontend/                 the game
  app/                      layout, page, favicon, OAuth callback
  components/FlappyDusk.tsx Three.js scene, game loop, every panel
  lib/skins.ts              bird skins
  lib/api.ts                leaderboard client
  lib/auth.ts               Google sign-in (system browser + deep link)
  capacitor.config.ts       wraps the static export in the Android WebView
  scripts/android-deeplink.mjs  registers the sign-in deep link

backend/                  the leaderboard API
  src/routes/runs.ts        scores a run by replaying it, never by trusting it
  src/routes/leaderboard.ts ranks players by their best run
  src/routes/auth.ts        Google OAuth for both the web and the app
  src/db/schema.ts          users + runs (Postgres, Drizzle)
  Dockerfile                built from the repo root — it needs shared/
  docker-compose.yml        Postgres + API, for when you want them locally

.github/workflows/        CI, and the APK builder
DEPLOYMENT.md             Vercel, Neon, Render, Google Cloud, the APK
```

> Neither `frontend/android/` nor `frontend/out/` is committed — Capacitor and
> Next regenerate them on every build.

---

## How it works

### The pure core — `shared/src/gameLogic.ts`

No DOM. No Three.js. No unseeded randomness. The entire simulation is:

```ts
const state = createState(seed, baseSpeed);
flap(state);
const event = step(state, 1 / 120);
// event -> { scored, coined, keyed, powered, power, shieldUsed, died }
```

Because it's pure and deterministic, the exact code that ships is the code the
tests exercise — collision math, pickup placement, power-up timers, and the
shield/revive rules included.

### The renderer — `frontend/components/FlappyDusk.tsx`

A single `useEffect` builds the scene, runs the loop, and tears everything down on
unmount (cancels the animation frame, removes listeners, disposes the WebGL
renderer) — so it survives React Strict Mode's dev-time double-mount cleanly.

The loop steps the pure core at a fixed `1/120s` and renders at display rate:

```
accumulator += dt
while (accumulator >= 1/120) { step(state, 1/120); accumulator -= 1/120 }
renderer.render(scene, camera)
```

### The React ↔ engine bridge

The 120 Hz loop must **never** cause a re-render, so React and the engine talk
through refs:

| Direction | What flows |
|---|---|
| **React → engine** | selected skin, player level (→ base speed), sound / haptics / effects settings |
| **Engine → React** | phase changes, and a run-end report (score + coin/key/power-up **deltas**) |

Run stats are reported as **deltas** since the last report, so continuing a run
with a key can't double-count coins or mission progress.

---

## Testing

The game core and progression system are pure, so they're tested headlessly — no
browser, no DOM:

```bash
npm test
```

**53 tests** covering:

- the seeded PRNG and gap-generation bounds
- collision, and coin / key / power-up pickup math
- power-up effects (shield absorption, slow/fast speed factors, timer expiry)
- scoring, death conditions, and level-driven base speed
- full-run determinism (same seed + inputs → identical result)
- XP curves, level roll-over, daily-mission generation, achievement unlocks

---

## Deploying

```
shared/  ──┬──▶ frontend/ ──▶ static bundle ──┬──▶ Vercel     the website
           │                                  └──▶ Capacitor  the APK
           └──▶ backend/  ──▶ Docker image  ─────▶ Render     the API
                                                   Neon       the database
```

The game runs fine with no backend at all — local progress, no sign-in, and the
leaderboard button simply isn't there.

**[DEPLOYMENT.md](DEPLOYMENT.md)** has the whole thing: Vercel (note the
**Root Directory must be `frontend`**), the Neon database, the Render service,
the Google Cloud OAuth client, the APK, and why the leaderboard can't be lied to.

---

## Recording your own demo

`docs/demo.gif` ships as a stylized preview. To replace it with real gameplay:

**macOS**

```bash
# 1. record a clip (Cmd+Shift+5, or QuickTime screen recording) -> demo.mov
# 2. convert to a looping gif
ffmpeg -i demo.mov \
  -vf "fps=20,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" \
  -loop 0 docs/demo.gif
```

**Anything else:** [Kap](https://getkap.co), [Peek](https://github.com/phw/peek),
or ScreenToGif export a GIF directly. Save it to `docs/demo.gif` and the README
picks it up automatically.

---

## Roadmap

Not built yet:

- [ ] PWA — installable + offline play
- [ ] Daily challenge (date-seeded run, same pipes for everyone)
- [ ] Background music
- [ ] Difficulty modes (easy / normal / hard)
- [ ] Moving pipes at high scores

---

## License

MIT — do whatever you like with it.

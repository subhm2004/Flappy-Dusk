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
  <img alt="Tests" src="https://img.shields.io/badge/tests-53%20passing-3FA070">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-FF6F59">
</p>

---

## Demo

<p align="center">
  <img src="docs/demo.gif" alt="Flappy Dusk gameplay" width="640">
</p>

> The GIF above is a **stylized preview** of the game loop. To drop in a real
> screen recording, see [Recording your own demo](#recording-your-own-demo).

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

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server (hot reload) |
| `npm run build` | Production build — also type-checks the whole project |
| `npm run start` | Serve the production build |
| `npm test` | Run the game-logic + progression unit tests |
| `npm run test:watch` | Run tests in watch mode |

---

## Project structure

```
app/
  layout.tsx              Root layout, metadata, viewport

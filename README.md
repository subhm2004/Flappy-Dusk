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

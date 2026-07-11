'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  C,
  createState,
  flap,
  revive,
  step,
  type PowerType,
  type State,
} from '@/lib/gameLogic';
import { DEFAULT_SKIN, SKINS, skinById, hex, type Skin } from '@/lib/skins';
import {
  ACHIEVEMENTS,
  addXp,
  advanceMissions,
  dateSeed,
  EMPTY_STATS,
  foldRun,
  generateDailyMissions,
  levelBaseSpeed,
  newlyUnlocked,
  todayKey,
  xpToNext,
  type LifetimeStats,
  type Mission,
  type RunStats,
} from '@/lib/progression';
import styles from './FlappyDusk.module.css';

const K = {
  best: 'sunsetFlapBest',
  coins: 'sunsetFlapCoins',
  keys: 'sunsetFlapKeys',
  owned: 'sunsetFlapOwned',
  skin: 'sunsetFlapSkin',
  level: 'sunsetFlapLevel',
  xp: 'sunsetFlapXp',
  stats: 'sunsetFlapStats',
  ach: 'sunsetFlapAch',
  missions: 'sunsetFlapMissions',
  missionsDate: 'sunsetFlapMissionsDate',
  sound: 'sunsetFlapSound',
  haptics: 'sunsetFlapHaptics',
  effects: 'sunsetFlapEffects',
};

type Phase = 'home' | 'ready' | 'playing' | 'dead';

interface Medal {
  min: number;
  name: string;
  a: string;
  b: string;
}
const MEDALS: Medal[] = [
  { min: 50, name: 'PLATINUM', a: '#BFF6F0', b: '#59C7BD' },
  { min: 30, name: 'GOLD', a: '#FFE07A', b: '#E0A22B' },
  { min: 15, name: 'SILVER', a: '#EDEDED', b: '#A9B0B8' },
  { min: 5, name: 'BRONZE', a: '#F0C08A', b: '#B26B33' },
];
function medalFor(score: number): Medal | null {
  for (const m of MEDALS) if (score >= m.min) return m;
  return null;
}

const REVIVE_COSTS = [1, 4, 8, 18, 32];
function reviveCostFor(n: number): number {
  if (n < REVIVE_COSTS.length) return REVIVE_COSTS[n];
  return REVIVE_COSTS[REVIVE_COSTS.length - 1] * 2 ** (n - REVIVE_COSTS.length + 1);
}

interface EngineApi {
  applySkin: (skin: Skin) => void;
  revive: () => void;
  restart: () => void;
  refreshBaseSpeed: () => void;
}

interface RunEndInfo {
  score: number;
  runCoins: number;
  runKeys: number;
  dCoins: number;
  dKeys: number;
  dPowerups: number;
}

function lsSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {

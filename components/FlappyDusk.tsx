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
    /* storage may be unavailable */
  }
}
const persistNum = (k: string, n: number) => lsSet(k, String(n));
const persistJSON = (k: string, v: unknown) => lsSet(k, JSON.stringify(v));

export default function FlappyDusk() {
  /* ---------- shared state (React owns; engine reads via refs) ---------- */
  const [best, setBest] = useState(0);
  const [coins, setCoins] = useState(0);
  const [keys, setKeys] = useState(0);
  const [owned, setOwned] = useState<string[]>([DEFAULT_SKIN]);
  const [selected, setSelected] = useState<string>(DEFAULT_SKIN);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [stats, setStats] = useState<LifetimeStats>(EMPTY_STATS);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [effectsOn, setEffectsOn] = useState(true);

  const [phase, setPhase] = useState<Phase>('home');
  const [runStats, setRunStats] = useState({ score: 0, coins: 0, keys: 0 });
  const [reviveCount, setReviveCount] = useState(0);
  const [panel, setPanel] = useState<'none' | 'shop' | 'missions' | 'settings'>('none');
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);

  /* ---------- DOM + bridge refs ---------- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const coinCountRef = useRef<HTMLSpanElement>(null);
  const pauseBtnRef = useRef<HTMLButtonElement>(null);
  const muteBtnRef = useRef<HTMLButtonElement>(null);
  const pauseOverlayRef = useRef<HTMLDivElement>(null);
  const powerHudRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const fatalRef = useRef<HTMLDivElement>(null);
  const fatalMsgRef = useRef<HTMLDivElement>(null);

  const engineApiRef = useRef<EngineApi | null>(null);
  const skinRef = useRef<Skin>(skinById(selected));
  const levelRef = useRef(level);
  const soundRef = useRef(soundOn);
  const hapticsRef = useRef(hapticsOn);
  const effectsRef = useRef(effectsOn);
  const uiBlockRef = useRef(false);
  const onPhaseRef = useRef<(p: Phase) => void>(() => {});
  const onRunEndRef = useRef<(info: RunEndInfo) => void>(() => {});
  const onToggleSoundRef = useRef<() => void>(() => {});

  const toastId = useRef(0);
  function pushToast(text: string) {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }

  /* keep bridge refs fresh every render */
  skinRef.current = skinById(selected);
  levelRef.current = level;
  soundRef.current = soundOn;
  hapticsRef.current = hapticsOn;
  effectsRef.current = effectsOn;
  uiBlockRef.current = panel !== 'none';
  onPhaseRef.current = (p) => setPhase(p);
  onToggleSoundRef.current = () => toggleSound();

  onRunEndRef.current = (info) => {
    const run: RunStats = {
      score: info.score,
      coins: info.dCoins,
      keys: info.dKeys,
      powerups: info.dPowerups,
    };
    let bonusCoins = 0;
    let bonusXp = 0;

    const after = advanceMissions(missions, run);
    after.forEach((m, i) => {
      if (m.done && !missions[i].done) {
        bonusCoins += m.rewardCoins;
        bonusXp += m.rewardXp;
        pushToast(`✅ ${m.label}`);
      }
    });

    const newStats = foldRun(stats, run);

    const unlocks = newlyUnlocked(unlocked, newStats, level, owned.length);
    unlocks.forEach((a) => {
      bonusCoins += a.rewardCoins;

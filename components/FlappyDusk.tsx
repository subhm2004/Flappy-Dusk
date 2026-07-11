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
      bonusXp += a.rewardXp;
      pushToast(`🏆 ${a.label}`);
    });
    let allUnlocked = unlocks.length ? [...unlocked, ...unlocks.map((a) => a.id)] : unlocked;

    const lv = addXp(level, xp, bonusXp);
    if (lv.leveledUp > 0) pushToast(`⭐ Level ${lv.level}!`);

    // achievements that trigger on the new level
    const lvlUnlocks = newlyUnlocked(allUnlocked, newStats, lv.level, owned.length);
    lvlUnlocks.forEach((a) => {
      bonusCoins += a.rewardCoins;
      pushToast(`🏆 ${a.label}`);
    });
    if (lvlUnlocks.length) allUnlocked = [...allUnlocked, ...lvlUnlocks.map((a) => a.id)];

    const newCoins = coins + info.dCoins + bonusCoins;
    const newKeys = keys + info.dKeys;

    setCoins(newCoins);
    persistNum(K.coins, newCoins);
    setKeys(newKeys);
    persistNum(K.keys, newKeys);
    setBest(newStats.bestScore);
    persistNum(K.best, newStats.bestScore);
    setStats(newStats);
    persistJSON(K.stats, newStats);
    setMissions(after);
    persistJSON(K.missions, after);
    setUnlocked(allUnlocked);
    persistJSON(K.ach, allUnlocked);
    setLevel(lv.level);
    persistNum(K.level, lv.level);
    setXp(lv.xp);
    persistNum(K.xp, lv.xp);

    setRunStats({ score: info.score, coins: info.runCoins, keys: info.runKeys });
    setPhase('dead');
  };

  /* ---------- load persisted values once ---------- */
  useEffect(() => {
    try {
      const ls = window.localStorage;
      const num = (k: string) => parseInt(ls.getItem(k) || '0', 10) || 0;
      setBest(num(K.best));
      setCoins(num(K.coins));
      setKeys(num(K.keys));
      setLevel(Math.max(1, num(K.level) || 1));
      setXp(num(K.xp));
      const rawOwned = ls.getItem(K.owned);
      if (rawOwned) {
        const arr = JSON.parse(rawOwned);
        if (Array.isArray(arr)) setOwned(Array.from(new Set<string>([DEFAULT_SKIN, ...arr])));
      }
      const sel = ls.getItem(K.skin);
      if (sel) setSelected(sel);
      const rawStats = ls.getItem(K.stats);
      if (rawStats) setStats({ ...EMPTY_STATS, ...JSON.parse(rawStats) });
      const rawAch = ls.getItem(K.ach);
      if (rawAch) {
        const arr = JSON.parse(rawAch);
        if (Array.isArray(arr)) setUnlocked(arr);
      }
      const today = todayKey();
      const savedDate = ls.getItem(K.missionsDate);
      const rawM = ls.getItem(K.missions);
      if (savedDate === today && rawM) {
        setMissions(JSON.parse(rawM));
      } else {
        const m = generateDailyMissions(dateSeed());
        setMissions(m);
        persistJSON(K.missions, m);
        lsSet(K.missionsDate, today);
      }
      setSoundOn(ls.getItem(K.sound) !== '0');
      setHapticsOn(ls.getItem(K.haptics) !== '0');
      setEffectsOn(ls.getItem(K.effects) !== '0');
    } catch {
      /* defaults */
    }
  }, []);

  /* ---------- react → engine effects ---------- */
  useEffect(() => {
    engineApiRef.current?.applySkin(skinById(selected));
  }, [selected]);
  useEffect(() => {
    engineApiRef.current?.refreshBaseSpeed();
  }, [level]);

  /* ---------- settings ---------- */
  function toggleSound() {
    setSoundOn((v) => {
      const n = !v;
      lsSet(K.sound, n ? '1' : '0');
      return n;
    });
  }
  function toggleHaptics() {
    setHapticsOn((v) => {
      const n = !v;
      lsSet(K.haptics, n ? '1' : '0');
      return n;
    });
  }
  function toggleEffects() {
    setEffectsOn((v) => {
      const n = !v;
      lsSet(K.effects, n ? '1' : '0');
      return n;
    });
  }
  function resetProgress() {
    if (typeof window !== 'undefined' && !window.confirm('Reset all progress?')) return;
    [
      K.best, K.coins, K.keys, K.stats, K.missions, K.missionsDate,
      K.ach, K.level, K.xp, K.owned, K.skin,
    ].forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
    setBest(0);
    setCoins(0);
    setKeys(0);
    setStats(EMPTY_STATS);
    setUnlocked([]);
    setLevel(1);
    setXp(0);
    setOwned([DEFAULT_SKIN]);
    setSelected(DEFAULT_SKIN);
    const m = generateDailyMissions(dateSeed());
    setMissions(m);
    persistJSON(K.missions, m);
    lsSet(K.missionsDate, todayKey());
    engineApiRef.current?.applySkin(skinById(DEFAULT_SKIN));
    pushToast('Progress reset');
  }

  /* ---------- shop ---------- */
  function selectSkin(id: string) {
    setSelected(id);
    lsSet(K.skin, id);
  }
  function buySkin(skin: Skin) {
    if (owned.includes(skin.id) || coins < skin.cost) return;
    const nc = coins - skin.cost;
    setCoins(nc);
    persistNum(K.coins, nc);
    const no = Array.from(new Set([...owned, skin.id]));
    setOwned(no);
    persistJSON(K.owned, no);
    selectSkin(skin.id);
  }

  /* ---------- navigation ---------- */
  function play() {
    // start from a clean field, then reveal the "tap to flap" prompt
    engineApiRef.current?.restart();
    setReviveCount(0);
    setPhase('ready');
  }
  function goHome() {
    engineApiRef.current?.restart();
    setReviveCount(0);
    setPhase('home');
  }

  /* ---------- game-over ---------- */
  function playAgain() {
    setReviveCount(0);
    engineApiRef.current?.restart();
    setPhase('ready');
  }
  function useKeyContinue() {
    const cost = reviveCostFor(reviveCount);
    if (keys < cost) return;
    const nk = keys - cost;
    setKeys(nk);
    persistNum(K.keys, nk);
    setReviveCount((n) => n + 1);
    engineApiRef.current?.revive();
  }

  /* ================= the engine ================= */
  useEffect(() => {
    const canvas = canvasRef.current;
    const scoreEl = scoreRef.current;
    const coinCountEl = coinCountRef.current;
    const pauseBtnEl = pauseBtnRef.current;
    const muteBtnEl = muteBtnRef.current;
    const pauseOverlayEl = pauseOverlayRef.current;
    const powerHudEl = powerHudRef.current;
    const fxEl = fxRef.current;
    const flashEl = flashRef.current;
    const fatalEl = fatalRef.current;
    const fatalMsgEl = fatalMsgRef.current;
    if (
      !canvas || !scoreEl || !coinCountEl || !pauseBtnEl || !muteBtnEl ||
      !pauseOverlayEl || !powerHudEl || !fxEl || !flashEl || !fatalEl || !fatalMsgEl
    ) {
      return;
    }

    let disposed = false;
    let rafId = 0;

    function showFatal(msg: string) {
      fatalMsgEl!.textContent = msg;
      fatalEl!.style.display = 'flex';
    }

    const anyTHREE = THREE as unknown as { SRGBColorSpace?: unknown; sRGBEncoding?: unknown };
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function vibrate(pattern: number | number[]) {
      if (!hapticsRef.current) return;
      try {
        if ('vibrate' in navigator) navigator.vibrate(pattern);
      } catch {
        /* optional */
      }
    }
    function effectsOK() {
      return effectsRef.current && !reduceMotion;
    }

    const CAM_X = -2.2;

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
    const CAM_Y = 4.3;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      showFatal(
        'WebGL is unavailable in this browser, so the 3D scene cannot start. ' +
          'Try a current version of Chrome, Edge, Firefox, or Safari.',
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const anyRenderer = renderer as unknown as Record<string, unknown>;
    if ('outputColorSpace' in renderer && anyTHREE.SRGBColorSpace) {
      anyRenderer.outputColorSpace = anyTHREE.SRGBColorSpace;
    } else if (anyTHREE.sRGBEncoding !== undefined) {
      anyRenderer.outputEncoding = anyTHREE.sRGBEncoding;
    }
    function markSRGB(tex: THREE.Texture) {
      const at = tex as unknown as Record<string, unknown>;
      if (anyTHREE.SRGBColorSpace) at.colorSpace = anyTHREE.SRGBColorSpace;
      else if (anyTHREE.sRGBEncoding !== undefined) at.encoding = anyTHREE.sRGBEncoding;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf2a087, 26, 72);
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(CAM_X, CAM_Y, 13.5);
    camera.lookAt(new THREE.Vector3(1.6, 4.4, 0));

    /* sky */
    {
      const c = document.createElement('canvas');
      c.width = 2;
      c.height = 512;
      const g = c.getContext('2d')!;
      const grad = g.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0.0, '#6D5BD0');
      grad.addColorStop(0.45, '#E98AA0');
      grad.addColorStop(0.78, '#FFB48C');
      grad.addColorStop(1.0, '#FFD9A6');
      g.fillStyle = grad;
      g.fillRect(0, 0, 2, 512);
      const tex = new THREE.CanvasTexture(c);
      markSRGB(tex);
      scene.background = tex;
    }

    /* lights */
    scene.add(new THREE.HemisphereLight(0xffe2c4, 0xb87a96, 0.85));
    const sun = new THREE.DirectionalLight(0xffd9b0, 1.15);
    sun.position.set(-9, 13, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 34;
    sun.shadow.camera.top = 24;
    sun.shadow.camera.bottom = -6;
    scene.add(sun);
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(4.6, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xffeec2, fog: false }),
    );
    sunDisc.position.set(-24, 9, -46);
    scene.add(sunDisc);

    function mat(color: number) {
      return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0 });
    }

    /* ground */
    let groundTex: THREE.CanvasTexture;
    {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 64;
      const g = c.getContext('2d')!;
      g.fillStyle = '#F6DFAF';
      g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#EBC894';
      g.fillRect(0, 0, 128, 64);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(120, 0, 8, 64);
      groundTex = new THREE.CanvasTexture(c);
      markSRGB(groundTex);
      groundTex.wrapS = THREE.RepeatWrapping;
      groundTex.wrapT = THREE.RepeatWrapping;
      groundTex.repeat.set(10, 1);
      const ground = new THREE.Mesh(
        new THREE.BoxGeometry(70, 1.2, 12),
        new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, metalness: 0 }),
      );
      ground.position.set(4, C.GROUND_Y - 0.6, -1);
      ground.receiveShadow = true;
      scene.add(ground);
    }

    /* dunes */
    {
      const colors = [0xb79bd8, 0xa88ac9, 0xc4a9e3];
      for (let i = 0; i < 6; i++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(8 + (i % 3) * 3, 10, 8), mat(colors[i % 3]));
        d.scale.y = 0.35;
        d.position.set(-26 + i * 13, 0.4, -26 - (i % 2) * 9);
        scene.add(d);
      }
    }

    /* clouds */
    const clouds: THREE.Group[] = [];
    {
      const cmat = new THREE.MeshStandardMaterial({ color: 0xfff4e3, flatShading: true, roughness: 1 });
      for (let i = 0; i < 7; i++) {
        const grp = new THREE.Group();
        const n = 3 + (i % 2);
        for (let k = 0; k < n; k++) {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(0.9 + 0.5 * Math.abs(Math.sin(i * 3 + k * 5)), 8, 7),
            cmat,
          );
          puff.position.set(k * 1.1 - n * 0.5, (k % 2) * 0.35, 0);
          puff.castShadow = true;
          grp.add(puff);
        }
        const z = -5 - (i % 4) * 4.5;
        grp.position.set(-20 + i * 8, 7.4 + (i % 3) * 1.2, z);
        grp.userData.speed = (reduceMotion ? 0.12 : 0.45) * (1 - Math.abs(z) / 30);
        clouds.push(grp);
        scene.add(grp);
      }
    }

    /* bird */
    const bird = new THREE.Group();
    let wingL: THREE.Mesh;
    let wingR: THREE.Mesh;
    const initSkin = skinRef.current;
    const bodyMat = mat(initSkin.body);
    const bellyMat = mat(initSkin.belly);
    const beakMat = mat(initSkin.beak);
    const wingMatL = mat(initSkin.wing);
    const wingMatR = mat(initSkin.wing);
    const tailMat = mat(initSkin.tail);
    {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 10), bodyMat);
      body.castShadow = true;
      bird.add(body);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), bellyMat);
      belly.position.set(0.12, -0.13, 0);
      bird.add(belly);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 8), beakMat);
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.5, 0.02, 0);
      beak.castShadow = true;
      bird.add(beak);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2e2430, roughness: 0.4 });
      const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      [-1, 1].forEach((side) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeMat);
        eye.position.set(0.3, 0.16, 0.27 * side);
        bird.add(eye);
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), glintMat);
        glint.position.set(0.36, 0.2, 0.3 * side);
        bird.add(glint);
      });
      const wingGeo = new THREE.BoxGeometry(0.46, 0.08, 0.5);
      wingGeo.translate(0, 0, 0.28);
      wingL = new THREE.Mesh(wingGeo, wingMatL);
      wingL.position.set(-0.05, 0.05, 0.3);
      wingL.castShadow = true;
      bird.add(wingL);
      wingR = new THREE.Mesh(wingGeo.clone(), wingMatR);
      wingR.rotation.y = Math.PI;
      wingR.position.set(-0.05, 0.05, -0.3);
      wingR.castShadow = true;
      bird.add(wingR);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 6), tailMat);
      tail.rotation.z = Math.PI / 2;
      tail.position.set(-0.48, 0.05, 0);
      tail.castShadow = true;
      bird.add(tail);
      bird.position.set(C.BIRD_X, C.READY_Y, 0);

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
      scene.add(bird);
    }
    function applySkin(skin: Skin) {
      bodyMat.color.set(skin.body);
      bellyMat.color.set(skin.belly);
      beakMat.color.set(skin.beak);
      wingMatL.color.set(skin.wing);
      wingMatR.color.set(skin.wing);
      tailMat.color.set(skin.tail);
    }

    /* pipe pool */
    const POOL = 8;
    const pipePool: THREE.Group[] = [];
    {
      const bodyM = mat(0x62c88f);
      const lipM = mat(0x3fa070);
      for (let i = 0; i < POOL; i++) {
        const grp = new THREE.Group();
        const bottom = new THREE.Mesh(new THREE.CylinderGeometry(C.PIPE_R, C.PIPE_R, 1, 14), bodyM);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(C.PIPE_R, C.PIPE_R, 1, 14), bodyM);
        const lipB = new THREE.Mesh(
          new THREE.CylinderGeometry(C.PIPE_R * 1.24, C.PIPE_R * 1.24, 0.5, 14),
          lipM,
        );
        const lipT = lipB.clone();
        [bottom, top, lipB, lipT].forEach((m) => {
          m.castShadow = true;
          m.receiveShadow = true;
          grp.add(m);
        });
        grp.userData = { bottom, top, lipB, lipT, gapY: null as number | null };
        grp.visible = false;
        pipePool.push(grp);
        scene.add(grp);
      }
    }

    /* coin pool */
    const coinPool: THREE.Mesh[] = [];
    {
      const coinGeo = new THREE.CylinderGeometry(C.COIN_R, C.COIN_R, 0.09, 20);
      coinGeo.rotateX(Math.PI / 2);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xffd24d,
        metalness: 0.35,
        roughness: 0.35,
        emissive: 0x5a3d00,
        emissiveIntensity: 0.35,
      });
      for (let i = 0; i < POOL; i++) {
        const cm = new THREE.Mesh(coinGeo, coinMat);
        cm.castShadow = true;
        cm.visible = false;
        coinPool.push(cm);
        scene.add(cm);
      }
    }

    /* key pool (rare, blue) */
    const keyPool: THREE.Group[] = [];
    {
      const keyMat = new THREE.MeshStandardMaterial({
        color: 0x37b6ff,
        metalness: 0.5,
        roughness: 0.22,
        emissive: 0x0c3f70,
        emissiveIntensity: 0.55,
      });
      const ringGeo = new THREE.TorusGeometry(0.15, 0.055, 12, 22);
      const shaftGeo = new THREE.BoxGeometry(0.09, 0.42, 0.09);
      const toothGeo = new THREE.BoxGeometry(0.12, 0.07, 0.08);
      for (let i = 0; i < POOL; i++) {
        const grp = new THREE.Group();
        const ring = new THREE.Mesh(ringGeo, keyMat);
        ring.position.y = 0.2;
        const shaft = new THREE.Mesh(shaftGeo, keyMat);
        shaft.position.y = -0.06;
        const tooth1 = new THREE.Mesh(toothGeo, keyMat);
        tooth1.position.set(0.09, -0.16, 0);
        const tooth2 = new THREE.Mesh(toothGeo, keyMat);
        tooth2.position.set(0.09, -0.25, 0);
        [ring, shaft, tooth1, tooth2].forEach((m) => {
          m.castShadow = true;
          grp.add(m);
        });
        grp.visible = false;
        keyPool.push(grp);
        scene.add(grp);
      }
    }

    /* power-up pool (billboard sprites with drawn icons) */
    function powerTex(bg: string, emoji: string) {
      const cv = document.createElement('canvas');
      cv.width = 128;
      cv.height = 128;
      const g = cv.getContext('2d')!;
      g.beginPath();
      g.arc(64, 64, 56, 0, Math.PI * 2);
      g.fillStyle = bg;
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.stroke();
      g.font = '62px serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(emoji, 64, 72);
      const t = new THREE.CanvasTexture(cv);
      markSRGB(t);
      return t;
    }
    const powerMats: Record<PowerType, THREE.SpriteMaterial> = {
      shield: new THREE.SpriteMaterial({ map: powerTex('#38bdf8', '🛡'), transparent: true }),
      magnet: new THREE.SpriteMaterial({ map: powerTex('#ef4444', '🧲'), transparent: true }),
      slow: new THREE.SpriteMaterial({ map: powerTex('#22c55e', '🐢'), transparent: true }),
      fast: new THREE.SpriteMaterial({ map: powerTex('#f59e0b', '⚡'), transparent: true }),
    };
    const powerPool: THREE.Sprite[] = [];
    for (let i = 0; i < POOL; i++) {
      const sp = new THREE.Sprite(powerMats.shield);
      sp.scale.set(0.95, 0.95, 1);
      sp.visible = false;
      powerPool.push(sp);
      scene.add(sp);
    }

    function shapePipe(grp: THREE.Group, gapY: number) {
      const u = grp.userData;
      u.gapY = gapY;
      const gapTop = gapY + C.GAP / 2;
      const gapBot = gapY - C.GAP / 2;
      const bottomH = Math.max(0.2, gapBot - C.GROUND_Y);
      u.bottom.scale.set(1, bottomH, 1);
      u.bottom.position.y = C.GROUND_Y + bottomH / 2;
      const ceilExt = C.CEIL_Y + 4;
      const topH = Math.max(0.2, ceilExt - gapTop);
      u.top.scale.set(1, topH, 1);
      u.top.position.y = gapTop + topH / 2;
      u.lipB.position.y = gapBot - 0.27;
      u.lipT.position.y = gapTop + 0.27;
    }

    function syncPipes(s: State) {
      const magnetOn = s.magnetT > 0;
      for (let i = 0; i < pipePool.length; i++) {
        const grp = pipePool[i];
        const cm = coinPool[i];
        const km = keyPool[i];
        const sp = powerPool[i];
        if (i < s.pipes.length) {
          const p = s.pipes[i];
          grp.visible = true;
          grp.position.x = p.x;
          if (grp.userData.gapY !== p.gapY) shapePipe(grp, p.gapY);
          if (p.coin && !p.coinTaken) {
            cm.visible = true;
            if (magnetOn) {
              const dx = p.x - bird.position.x;
              const t = Math.max(0, Math.min(1, 1 - dx / 5));
              cm.position.set(
                p.x + (bird.position.x - p.x) * t * 0.85,
                p.coinY + (bird.position.y - p.coinY) * t * 0.85,
                0,
              );
            } else {
              cm.position.set(p.x, p.coinY, 0);
            }
          } else {
            cm.visible = false;
          }
          if (p.key && !p.keyTaken) {
            km.visible = true;
            km.position.set(p.x, p.keyY, 0);
          } else {
            km.visible = false;
          }
          if (p.power && !p.powerTaken) {
            sp.visible = true;
            sp.material = powerMats[p.powerType];
            sp.position.set(p.x, p.powerY, 0);
          } else {
            sp.visible = false;
          }
        } else {
          grp.visible = false;
          cm.visible = false;
          km.visible = false;
          sp.visible = false;
        }
      }
    }

    /* flap puffs */
    interface Puff {
      mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
      life: number;
    }
    const puffs: Puff[] = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
      );
      m.visible = false;
      puffs.push({ mesh: m, life: 0 });
      scene.add(m);
    }
    let puffIdx = 0;
    function spawnPuffs() {
      if (!effectsOK()) return;
      for (let k = 0; k < 3; k++) {
        const p = puffs[puffIdx];
        puffIdx = (puffIdx + 1) % puffs.length;
        p.life = 0.45;
        p.mesh.visible = true;
        p.mesh.material.opacity = 0.85;
        p.mesh.position.set(bird.position.x - 0.3, bird.position.y - 0.25, (k - 1) * 0.25);
        p.mesh.userData = { vx: -1.4 - k * 0.3, vy: -0.8 + k * 0.5 };
      }
    }
    function updatePuffs(d: number) {
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        if (p.life <= 0) continue;
        p.life -= d;
        p.mesh.position.x += p.mesh.userData.vx * d;
        p.mesh.position.y += p.mesh.userData.vy * d;
        p.mesh.material.opacity = Math.max(0, p.life / 0.45) * 0.85;
        if (p.life <= 0) p.mesh.visible = false;
      }
    }

    /* audio */
    const audio: { ctx: AudioContext | null } = { ctx: null };
    function audioInit() {
      if (audio.ctx) return;
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) audio.ctx = new AC();
      } catch {
        audio.ctx = null;
      }
    }
    function blip(freqA: number, freqB: number, dur: number, type: OscillatorType, gainV: number) {
      if (!soundRef.current || !audio.ctx) return;
      try {
        const t0 = audio.ctx.currentTime;
        const osc = audio.ctx.createOscillator();
        const gain = audio.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freqA, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqB), t0 + dur);
        gain.gain.setValueAtTime(gainV, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(audio.ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch {
        /* decorative */
      }
    }
    const sfx = {
      flap: () => blip(380, 640, 0.09, 'sine', 0.12),
      score: () => {
        blip(660, 660, 0.06, 'triangle', 0.14);
        setTimeout(() => blip(880, 880, 0.09, 'triangle', 0.14), 70);
      },
      coin: () => {
        blip(880, 1320, 0.07, 'sine', 0.12);
        setTimeout(() => blip(1320, 1760, 0.07, 'sine', 0.1), 55);
      },
      key: () => {
        blip(520, 780, 0.08, 'triangle', 0.14);
        setTimeout(() => blip(1040, 1560, 0.12, 'triangle', 0.12), 60);
      },
      power: () => {
        blip(500, 900, 0.09, 'square', 0.1);
        setTimeout(() => blip(900, 1400, 0.12, 'sine', 0.12), 60);
      },
      shield: () => blip(300, 520, 0.16, 'sawtooth', 0.12),
      hit: () => blip(180, 60, 0.22, 'square', 0.16),
    };

    /* HUD helpers */
    function pulse(el: HTMLElement) {
      el.classList.remove(styles.pulse);
      void el.offsetWidth;
      el.classList.add(styles.pulse);
    }
    function setScore(n: number) {
      scoreEl!.textContent = String(n);
      pulse(scoreEl!);
    }
    function setCoinsHud(n: number) {
      coinCountEl!.textContent = String(n);
      pulse(coinCountEl!);
    }

    /* state */
    let state = createState(undefined, levelBaseSpeed(levelRef.current, C.SPEED0));
    let paused = false;
    let wingPulse = 0;
    let acc = 0;
    let lastT = performance.now();
    let shakeAmt = 0;
    let runPowerups = 0;
    const reported = { coins: 0, keys: 0, powerups: 0 };
    let lastHud = '';
    let lastTint = '';
    let lastSoundIcon = '';
    syncPipes(state);
    scoreEl.textContent = '0';
    coinCountEl.textContent = '0';

    function resetRunReporting() {
      runPowerups = 0;
      reported.coins = 0;
      reported.keys = 0;
      reported.powerups = 0;
    }

    function triggerDeath() {
      sfx.hit();
      vibrate([0, 55, 40, 90]);
      if (effectsOK()) {
        shakeAmt = 0.55;
        flashEl!.classList.remove(styles.flashOn);
        void flashEl!.offsetWidth;
        flashEl!.classList.add(styles.flashOn);
      }
      const score = state.score;
      const runCoins = state.coins;
      const runKeys = state.keys;
      const dCoins = state.coins - reported.coins;
      const dKeys = state.keys - reported.keys;
      const dPowerups = runPowerups - reported.powerups;
      reported.coins = state.coins;
      reported.keys = state.keys;
      reported.powerups = runPowerups;
      setTimeout(() => {
        onRunEndRef.current({ score, runCoins, runKeys, dCoins, dKeys, dPowerups });
      }, 550);
    }

    /* pause / mute */
    function setPaused(p: boolean) {
      if (state.status !== 'playing') return;
      paused = p;
      pauseOverlayEl!.style.display = p ? 'flex' : 'none';
      pauseBtnEl!.textContent = p ? '▶' : '⏸';
      if (!p) {
        lastT = performance.now();
        if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      }
    }
    function togglePause() {
      setPaused(!paused);
    }

    /* engine API */
    function doRestart() {
      state = createState(undefined, levelBaseSpeed(levelRef.current, C.SPEED0));
      resetRunReporting();
      syncPipes(state);
      scoreEl!.textContent = '0';
      coinCountEl!.textContent = '0';
      pauseOverlayEl!.style.display = 'none';
      paused = false;
      bird.rotation.z = 0;
      shakeAmt = 0;
      camera.position.x = CAM_X;
      // React decides which menu to show after a restart (home vs ready)
    }
    function doRevive() {
      revive(state);
      syncPipes(state);
      bird.rotation.z = 0;
      shakeAmt = 0;
      paused = false;
      lastT = performance.now();
      onPhaseRef.current('playing');
    }
    function refreshBaseSpeed() {
      if (state.status === 'ready') {
        const bs = levelBaseSpeed(levelRef.current, C.SPEED0);
        state.baseSpeed = bs;
        state.speed = bs;
      }
    }
    engineApiRef.current = { applySkin, revive: doRevive, restart: doRestart, refreshBaseSpeed };
    applySkin(skinRef.current);

    /* input */
    function action() {
      if (paused || uiBlockRef.current) return;
      if (state.status === 'dead') return;
      audioInit();
      const wasReady = state.status === 'ready';
      if (wasReady) onPhaseRef.current('playing');
      flap(state);
      sfx.flap();
      spawnPuffs();
      vibrate(6);
      wingPulse = 1;
    }
    function onKey(e: KeyboardEvent) {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (state.status === 'playing') {
          e.preventDefault();
          togglePause();
        }
        return;
      }
      if (e.code === 'KeyM') {
        e.preventDefault();
        if (!e.repeat) onToggleSoundRef.current();
        return;
      }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (!e.repeat) action();
      }
    }
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    function onVisibility() {
      if (document.hidden && state.status === 'playing') setPaused(true);
    }
    function onErr(e: ErrorEvent) {
      if (e && e.message) showFatal('Something went wrong while running the game: ' + e.message);
    }
    function onPauseBtn(e: Event) {
      e.stopPropagation();
      togglePause();
    }
    function onMuteBtn(e: Event) {
      e.stopPropagation();
      onToggleSoundRef.current();
    }
    function onPauseOverlay(e: Event) {
      e.stopPropagation();
      setPaused(false);
    }
    window.addEventListener('pointerdown', action);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('error', onErr);
    document.addEventListener('visibilitychange', onVisibility);
    pauseBtnEl.addEventListener('pointerdown', onPauseBtn);
    muteBtnEl.addEventListener('pointerdown', onMuteBtn);
    pauseOverlayEl.addEventListener('pointerdown', onPauseOverlay);

    /* loop */
    function frame(now: number) {
      if (disposed) return;
      const d = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      pauseBtnEl!.style.display = state.status === 'playing' ? 'flex' : 'none';
      const soundIcon = soundRef.current ? '🔊' : '🔇';
      if (soundIcon !== lastSoundIcon) {
        muteBtnEl!.textContent = soundIcon;
        lastSoundIcon = soundIcon;
      }

      if (paused) {
        renderer.render(scene, camera);
        rafId = requestAnimationFrame(frame);
        return;
      }

      acc += d;
      while (acc >= C.DT) {
        const ev = step(state, C.DT);
        if (ev.scored > 0) {
          setScore(state.score);
          sfx.score();
        }
        if (ev.coined > 0) {
          setCoinsHud(state.coins);
          sfx.coin();
          vibrate(10);
        }
        if (ev.keyed > 0) {
          sfx.key();
          vibrate([0, 20, 30, 25]);
        }
        if (ev.powered > 0) {
          runPowerups += ev.powered;
          sfx.power();
          vibrate([0, 15, 20, 15]);
        }
        if (ev.shieldUsed) {
          sfx.shield();
          vibrate(30);
          if (effectsOK()) shakeAmt = Math.max(shakeAmt, 0.3);
        }
        if (ev.died) triggerDeath();
        acc -= C.DT;
      }

      /* bird */
      bird.position.y = state.birdY;
      if (state.status === 'dead') {
        if (state.birdY > C.GROUND_Y + C.BIRD_R + 0.01) bird.rotation.z -= 5.5 * d;
      } else {
        const targetTilt = Math.max(-0.55, Math.min(0.5, state.birdVY * 0.062));
        bird.rotation.z += (targetTilt - bird.rotation.z) * Math.min(1, d * 12);
      }
      wingPulse = Math.max(0, wingPulse - d * 2.2);
      const flapAmp = 0.25 + wingPulse * 0.9;
      const w = Math.sin(now * 0.001 * 22) * flapAmp - 0.15;
      wingL.rotation.x = -w;
      wingR.rotation.x = -w;

      /* world */
      syncPipes(state);
      for (let i = 0; i < coinPool.length; i++) {
        if (coinPool[i].visible) coinPool[i].rotation.y += d * 3.2;
        if (keyPool[i].visible) keyPool[i].rotation.y += d * 2.6;
      }
      if (state.status === 'playing') groundTex.offset.x += (state.speed * d) / 7;
      for (let i = 0; i < clouds.length; i++) {
        const cl = clouds[i];
        cl.position.x -= cl.userData.speed * d * (state.status === 'playing' ? 1.6 : 1);
        if (cl.position.x < -30) cl.position.x = 34;
      }
      updatePuffs(d);

      /* power-up HUD + tint */
      let hud = '';
      if (state.shield) hud += '🛡 ';
      if (state.magnetT > 0) hud += `🧲 ${state.magnetT.toFixed(1)}s `;
      if (state.slowT > 0) hud += `🐢 ${state.slowT.toFixed(1)}s `;
      if (state.fastT > 0) hud += `⚡ ${state.fastT.toFixed(1)}s `;
      hud = hud.trim();
      if (hud !== lastHud) {
        powerHudEl!.textContent = hud;
        powerHudEl!.style.display = hud ? 'flex' : 'none';
        lastHud = hud;
      }
      let tint = '';
      if (effectsRef.current) {
        if (state.slowT > 0) tint = 'rgba(60,120,255,0.12)';
        else if (state.fastT > 0) tint = 'rgba(255,140,40,0.12)';
      }
      if (tint !== lastTint) {
        fxEl!.style.background = tint || 'transparent';
        lastTint = tint;
      }

      /* camera */
      let camY = reduceMotion ? CAM_Y : CAM_Y + Math.sin(now * 0.0006) * 0.06;
      if (shakeAmt > 0) {
        camera.position.x = CAM_X + (Math.random() - 0.5) * shakeAmt;
        camY += (Math.random() - 0.5) * shakeAmt;
        shakeAmt = Math.max(0, shakeAmt - d * 2.2);
      } else {
        camera.position.x = CAM_X;
      }
      camera.position.y = camY;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointerdown', action);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('error', onErr);
      document.removeEventListener('visibilitychange', onVisibility);
      pauseBtnEl.removeEventListener('pointerdown', onPauseBtn);
      muteBtnEl.removeEventListener('pointerdown', onMuteBtn);
      pauseOverlayEl.removeEventListener('pointerdown', onPauseOverlay);
      engineApiRef.current = null;
      if (audio.ctx) {
        try {
          audio.ctx.close();
        } catch {
          /* ignore */
        }
      }
      scene.clear();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= overlays ================= */
  const medal = medalFor(runStats.score);
  const bestShown = Math.max(best, runStats.score);
  const reviveCost = reviveCostFor(reviveCount);
  const xpNeed = xpToNext(level);
  const doneMissions = missions.filter((m) => m.done).length;

  return (
    <>
      <canvas ref={canvasRef} className={styles.scene} />

      <div
        className={`${styles.layer} ${styles.hud}`}
        style={{ display: phase === 'home' ? 'none' : 'flex' }}
      >
        <div className={styles.score} ref={scoreRef}>
          0
        </div>
      </div>

      <div
        className={styles.coinHud}
        style={{ display: phase === 'home' ? 'none' : 'flex' }}
      >
        <span className={styles.coinIcon} />
        <span ref={coinCountRef}>0</span>
      </div>

      <div className={styles.powerHud} ref={powerHudRef} style={{ display: 'none' }} />

      <div className={styles.controls}>
        <button type="button" ref={muteBtnRef} className={styles.ctrlBtn} aria-label="Toggle sound">
          🔊
        </button>
        <button
          type="button"
          ref={pauseBtnRef}
          className={styles.ctrlBtn}
          aria-label="Pause"
          style={{ display: 'none' }}
        >
          ⏸
        </button>
      </div>

      {/* home / main menu */}
      {phase === 'home' && panel === 'none' && (
        <div
          className={`${styles.layer} ${styles.home}`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className={styles.homeInner}>
            <h1 className={styles.homeTitle}>Flappy Dusk</h1>
            <div className={styles.homeTag}>a cozy 3D flappy adventure</div>

            <div className={styles.statCards}>
              <div className={styles.statCard}>
                <div className={styles.statVal}>{best}</div>
                <div className={styles.statLbl}>BEST</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statVal}>LV {level}</div>
                <div className={styles.statLbl}>
                  {xp}/{xpNeed} XP
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statVal}>
                  <span className={styles.coinIcon} /> {coins}
                </div>
                <div className={styles.statLbl}>COINS</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statVal}>🔑 {keys}</div>
                <div className={styles.statLbl}>KEYS</div>
              </div>
            </div>

            <div className={styles.xpBar}>
              <div
                className={styles.xpFill}
                style={{ width: `${Math.min(100, (xp / xpNeed) * 100)}%` }}
              />
            </div>

            <button type="button" className={styles.playBtn} onClick={play}>
              ▶ Play
            </button>

            <div className={styles.menuBtns}>
              <button type="button" className={styles.shopBtn} onClick={() => setPanel('shop')}>
                🛍 Shop
              </button>
              <button type="button" className={styles.shopBtn} onClick={() => setPanel('missions')}>
                🎯 Missions{doneMissions > 0 ? ` (${doneMissions}/3)` : ''}
              </button>
              <button type="button" className={styles.shopBtn} onClick={() => setPanel('settings')}>
                ⚙ Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ready prompt (taps pass through to flap) */}
      {phase === 'ready' && panel === 'none' && (
        <div className={`${styles.layer} ${styles.titleCard}`}>
          <h1>Flappy Dusk</h1>
          <div className={styles.sub}>tap, click, or press space to flap</div>
        </div>
      )}

      {/* game over */}
      {phase === 'dead' && (
        <div
          className={styles.layer}
          style={{ pointerEvents: 'auto', zIndex: 8 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className={styles.panel}>
            {medal && (
              <>
                <div
                  className={styles.medal}
                  style={{ background: `radial-gradient(circle at 35% 30%, ${medal.a}, ${medal.b})` }}
                >
                  ★
                </div>
                <div className={styles.medalLabel}>{medal.name}</div>
              </>
            )}
            <div className={styles.head}>SCORE</div>
            <div className={styles.num}>{runStats.score}</div>
            <div className={styles.best}>best {bestShown}</div>
            <div className={styles.coins}>
              <span className={styles.coinIcon} />
              {runStats.coins}
              {runStats.keys > 0 && <span className={styles.keyRun}>🔑 {runStats.keys}</span>}
            </div>
          </div>
          <div className={styles.deadBtns}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnKey}`}
              disabled={keys < reviveCost}
              onClick={useKeyContinue}
            >
              {keys < reviveCost ? `Need ${reviveCost} 🔑 · have ${keys}` : `Continue · ${reviveCost} 🔑`}
            </button>
            <button type="button" className={styles.btn} onClick={playAgain}>
              Play again
            </button>
            <button type="button" className={styles.btnGhost} onClick={goHome}>
              Home
            </button>
          </div>
        </div>
      )}

      {/* shop */}
      {panel === 'shop' && (
        <div
          className={styles.layer}
          style={{ pointerEvents: 'auto', zIndex: 10, background: 'rgba(42,31,61,0.6)' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setPanel('none');
          }}
        >
          <div className={styles.shopPanel} onPointerDown={(e) => e.stopPropagation()}>
            <div className={styles.shopHead}>
              <span>Bird Shop</span>
              <span className={styles.chip}>
                <span className={styles.coinIcon} /> {coins}
              </span>
            </div>
            <div className={styles.skinGrid}>
              {SKINS.map((skin) => {
                const isOwned = owned.includes(skin.id);
                const isSel = selected === skin.id;
                const canBuy = !isOwned && coins >= skin.cost;
                return (
                  <div
                    key={skin.id}
                    className={`${styles.skinCard} ${isSel ? styles.skinCardSel : ''}`}
                  >
                    <span
                      className={styles.swatch}
                      style={{
                        background: `radial-gradient(circle at 35% 30%, ${hex(skin.belly)} 8%, ${hex(
                          skin.body,
                        )} 55%, ${hex(skin.wing)} 100%)`,
                      }}
                    />
                    <span className={styles.skinName}>{skin.name}</span>
                    {isOwned ? (
                      <button
                        type="button"
                        className={`${styles.smallBtn} ${isSel ? styles.smallBtnSel : ''}`}
                        disabled={isSel}
                        onClick={() => selectSkin(skin.id)}
                      >
                        {isSel ? 'Selected' : 'Select'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.smallBtn}
                        disabled={!canBuy}
                        onClick={() => buySkin(skin)}
                      >
                        <span className={styles.coinIcon} /> {skin.cost}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" className={styles.btn} onClick={() => setPanel('none')}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* missions + achievements */}
      {panel === 'missions' && (
        <div
          className={styles.layer}
          style={{ pointerEvents: 'auto', zIndex: 10, background: 'rgba(42,31,61,0.6)' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setPanel('none');
          }}
        >
          <div className={styles.shopPanel} onPointerDown={(e) => e.stopPropagation()}>
            <div className={styles.shopHead}>
              <span>Daily Missions</span>
              <span className={styles.chip}>LV {level}</span>
            </div>
            <div className={styles.missionList}>
              {missions.map((m) => (
                <div key={m.id} className={`${styles.mission} ${m.done ? styles.missionDone : ''}`}>
                  <div className={styles.missionTop}>
                    <span>{m.done ? '✅ ' : ''}{m.label}</span>
                    <span className={styles.missionReward}>
                      <span className={styles.coinIcon} /> {m.rewardCoins} · {m.rewardXp} XP
                    </span>
                  </div>
                  <div className={styles.missionBar}>
                    <div
                      className={styles.missionFill}
                      style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}
                    />
                  </div>
                  <div className={styles.missionProg}>
                    {Math.min(m.progress, m.target)}/{m.target}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.shopHead} style={{ marginTop: 4 }}>
              <span>Achievements</span>
              <span className={styles.chip}>
                {unlocked.length}/{ACHIEVEMENTS.length}
              </span>
            </div>
            <div className={styles.achList}>
              {ACHIEVEMENTS.map((a) => {
                const got = unlocked.includes(a.id);
                return (
                  <div key={a.id} className={`${styles.ach} ${got ? styles.achGot : ''}`}>
                    <span className={styles.achIcon}>{got ? '🏆' : '🔒'}</span>
                    <span className={styles.achText}>
                      <b>{a.label}</b>
                      <small>{a.desc}</small>
                    </span>
                  </div>
                );
              })}
            </div>

            <button type="button" className={styles.btn} onClick={() => setPanel('none')}>
              Close
            </button>
          </div>

/**
 * The two skies.
 *
 * Everything the scene paints — the gradient behind it, the haze, the two
 * lights, the disc on the horizon, the sand, the dunes, the clouds — is pulled
 * from here rather than hard-coded, so the whole world can be repainted at
 * runtime without rebuilding a single mesh.
 */

export type ThemeId = 'dusk' | 'night';

/** What the player picked. `auto` follows the clock. */
export type ThemeSetting = 'auto' | ThemeId;

export interface Theme {
  id: ThemeId;
  name: string;
  /** Vertical gradient stops, top to bottom. */
  sky: [offset: number, color: string][];
  /** Distance haze. */
  fog: number;
  /** Ambient bounce: sky colour, ground colour, strength. */
  hemi: { sky: number; ground: number; intensity: number };
  /** The key light — the sun, or the moon. */
  key: { color: number; intensity: number };
  /** The disc sitting on the horizon. */
  disc: number;
  /** The scrolling sand, painted into a canvas texture. */
  ground: { base: string; shade: string; stripe: string };
  dunes: [number, number, number];
  clouds: number;
  /** Page background, so the browser chrome matches. */
  pageBg: string;

  /**
   * How much the things you actually have to see give off their own light.
   *
   * Moonlight is weak by design — that's what makes night feel like night — but
   * the bird, the pipes and the pickups are the game, and a moody sky is no
   * excuse for losing them in the dark. They light themselves instead, so the
   * scenery stays dim while the gameplay stays legible.
   */
  glow: {
    /** Bird and pipes: emissive is their own colour at this strength. */
    actor: number;
    coin: { color: number; intensity: number };
    key: { color: number; intensity: number };
  };
}

export const THEMES: Record<ThemeId, Theme> = {
  dusk: {
    id: 'dusk',
    name: 'Dusk',
    sky: [
      [0.0, '#6D5BD0'],
      [0.45, '#E98AA0'],
      [0.78, '#FFB48C'],
      [1.0, '#FFD9A6'],
    ],
    fog: 0xf2a087,
    hemi: { sky: 0xffe2c4, ground: 0xb87a96, intensity: 0.85 },
    key: { color: 0xffd9b0, intensity: 1.15 },
    disc: 0xffeec2,
    ground: { base: '#F6DFAF', shade: '#EBC894', stripe: 'rgba(255,255,255,0.18)' },
    dunes: [0xb79bd8, 0xa88ac9, 0xc4a9e3],
    clouds: 0xfff4e3,
    pageBg: '#2a1f3d',
    // Daylight already does the work; these are the values the game shipped with.
    glow: {
      actor: 0,
      coin: { color: 0x5a3d00, intensity: 0.35 },
      key: { color: 0x0c3f70, intensity: 0.55 },
    },
  },

  night: {
    id: 'night',
    name: 'Night',
    sky: [
      [0.0, '#0B1030'],
      [0.45, '#1E1A46'],
      [0.78, '#372A5E'],
      [1.0, '#5A4478'],
    ],
    fog: 0x3b2d61,
    // Moonlight is cold and much weaker, and it bounces off the sand blue.
    hemi: { sky: 0x9fb2e8, ground: 0x2a2145, intensity: 0.72 },
    key: { color: 0xc3d6ff, intensity: 0.78 },
    disc: 0xf3f1e2,
    ground: { base: '#9B8768', shade: '#83705A', stripe: 'rgba(255,255,255,0.10)' },
    dunes: [0x554a7d, 0x453b68, 0x63578c],
    clouds: 0xcfc9e4,
    pageBg: '#0e0b1c',
    // The bird, the pipes and the pickups light themselves, so they read
    // against a dark sky without brightening the sky itself.
    glow: {
      actor: 0.42,
      coin: { color: 0xffb545, intensity: 0.95 },
      key: { color: 0x49c8ff, intensity: 1.0 },
    },
  },
};

/** Night from 7pm to 6am, local time. */
export function themeForHour(hour: number): ThemeId {
  return hour >= 19 || hour < 6 ? 'night' : 'dusk';
}

/** Turns what the player picked into the theme to actually paint. */
export function resolveTheme(setting: ThemeSetting, now = new Date()): Theme {
  if (setting === 'auto') return THEMES[themeForHour(now.getHours())];
  return THEMES[setting];
}

export const THEME_SETTINGS: { id: ThemeSetting; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'dusk', label: '🌇 Dusk' },
  { id: 'night', label: '🌙 Night' },
];

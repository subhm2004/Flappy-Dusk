import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.subhm2004.flappydusk',
  appName: 'Flappy Dusk',

  // Next.js static export lands here; Capacitor copies it into the APK.
  webDir: 'out',

  server: {
    // Serve the bundle over https://localhost so localStorage has a stable,
    // secure origin across reinstalls (file:// would drop saved progress).
    androidScheme: 'https',
  },
};

export default config;

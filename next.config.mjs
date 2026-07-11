// GitHub Pages serves this repo under /Flappy-Dusk, so the bundle needs a base
// path there. Vercel/Netlify and the Android APK serve from the root and leave
// this unset. See DEPLOYMENT.md.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The game is fully client-side (canvas + localStorage), so it exports to a
  // static bundle in out/. That same bundle is served by the web host and
  // bundled into the Capacitor Android WebView.
  output: 'export',

  // Static export has no image optimization server.
  images: { unoptimized: true },

  basePath,
  assetPrefix: basePath || undefined,
};

export default nextConfig;

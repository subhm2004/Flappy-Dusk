// GitHub Pages serves this repo under /Flappy-Dusk, so the bundle needs a base
// path there. Vercel/Netlify and the Android APK serve from the root and leave
// this unset. See DEPLOYMENT.md.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // @flappy/core is a workspace that ships raw TypeScript (the backend consumes
  // the same source to replay runs), so Next has to compile it.
  transpilePackages: ['@flappy/core'],

  // The game is fully client-side (canvas + localStorage), so it exports to a
  // static bundle in out/. That same bundle is served by the web host and
  // bundled into the Capacitor Android WebView.
  output: 'export',

  // Static export has no image optimization server.
  images: { unoptimized: true },

  basePath,
  assetPrefix: basePath || undefined,

  // @flappy/core is ESM, so its internal imports carry the required `.js`
  // extension — but the files on disk are `.ts`. Teach webpack the mapping.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;

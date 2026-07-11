# Deployment

Flappy Dusk is a fully client-side game — the canvas, physics, and saved
progress all live in the browser. There is no server and no database.

That means `next build` produces a **static bundle** in `out/`, and that one
bundle is everything that ships:

```
out/  ──┬──▶  a static web host (Vercel / Netlify / GitHub Pages)
        └──▶  a Capacitor WebView  ──▶  flappy-dusk.apk  ──▶  Android
```

---

## Local

```bash
npm install
npm run dev        # http://localhost:3000
```

Checks, same as CI runs them:

```bash
npm run typecheck  # tsc --noEmit
npm test           # vitest, 53 tests
npm run build      # static export -> out/
```

---

## Web

### Vercel (recommended)

Zero config — Vercel detects Next.js and honours `output: 'export'`.

1. https://vercel.com/new → import `subhm2004/Flappy-Dusk`
2. Framework preset: **Next.js**. Leave everything else alone.
3. Deploy.

No environment variables are needed. Do **not** set `NEXT_PUBLIC_BASE_PATH` —
Vercel serves from the root.

### Netlify

Same idea:

- Build command: `npm run build`
- Publish directory: `out`

### GitHub Pages

Pages serves a project repo from a subpath (`/Flappy-Dusk`), so the bundle must
be built with a matching base path or every asset 404s:

```bash
NEXT_PUBLIC_BASE_PATH=/Flappy-Dusk npm run build
```

Then publish `out/` to Pages (Settings → Pages → Source: GitHub Actions, or push
`out/` to a `gh-pages` branch).

`next.config.mjs` reads that variable and sets `basePath` + `assetPrefix`. It is
unset everywhere else — including the APK build, which serves from the root.

---

## Android APK

The APK is a [Capacitor](https://capacitorjs.com) shell: the exported `out/`
bundle runs inside an Android WebView. Three.js gets hardware-accelerated WebGL
there, and `localStorage` keeps your coins, skins, and level between sessions.

### Get an APK without installing anything

You don't need Android Studio or the Android SDK locally — CI has both.

**On demand:**

1. GitHub → **Actions** → **Android APK** → **Run workflow** → pick `main` → run.
2. When it goes green, open the run and download the **`flappy-dusk-apk`**
   artifact from the Artifacts section.
3. Unzip it → `flappy-dusk.apk`.


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

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

**As a release** (permanent download link, better for sharing):

```bash
git tag v1.0.0
git push origin v1.0.0
```

The same workflow attaches `flappy-dusk.apk` to a GitHub Release at
https://github.com/subhm2004/Flappy-Dusk/releases.

> Artifacts expire after 90 days; release assets don't. Tag it if you want the
> link to keep working.

### Install it on your phone

1. Copy `flappy-dusk.apk` to the device (USB, Drive, or just open the release
   link in the phone's browser).
2. Tap it. Android will block the install the first time — allow
   **Install unknown apps** for whichever app you opened it from
   (Settings → Apps → Special access → Install unknown apps).
3. Tap **Install anyway** on the Play Protect warning.

Both warnings are expected: this is a **debug-signed** APK, not one signed with
a release key and published through the Play Store. It is fine for playing it
yourself and handing it to friends. See *Release signing* below if you want to
go further.

### Build the APK locally (optional)

Only needed if you want to change native Android bits.

Requires JDK 17 and the Android SDK (easiest via Android Studio).

```bash
npm run build          # export -> out/
npx cap add android    # scaffold android/ (regenerated, not committed)
npx cap sync android   # copy out/ into the native project
cd android && ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

`android/` is in `.gitignore` on purpose. It is generated from
`capacitor.config.ts` every time, so there is no native project to drift out of
sync — change the config, not the generated folder.

### Release signing

The CI build produces a **debug-signed** APK. That's deliberate: a release key
must not live in the repo. To ship a Play-Store-grade build you would:

1. Generate a keystore (`keytool -genkey -v -keystore release.jks ...`).
2. Add it plus its passwords to GitHub → Settings → Secrets and variables →
   Actions (base64 the `.jks`).
3. Have the workflow decode the keystore, write `android/keystore.properties`,
   and run `./gradlew assembleRelease` instead of `assembleDebug`.

Not wired up here, since a debug APK is all you need to sideload and play.


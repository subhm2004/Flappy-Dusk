# Deployment

Three things ship, from one repo:

```
shared/    the game core — pure, deterministic, imported by both sides
   │
   ├── frontend/  Next.js → static bundle ──┬──▶ Vercel        flappy-dusk.vercel.app
   │                                        └──▶ Capacitor ──▶ flappy-dusk.apk
   │
   └── backend/   Fastify + Postgres ──────────▶ Render        the leaderboard API
                                                 Neon          the database
```

The game runs perfectly well with no backend at all — local progress, no
sign-in, and the leaderboard button simply isn't there. Everything below the
"Web" section is optional.

---

## Local

```bash
npm install          # one install wires up all three workspaces
npm run dev          # the game on http://localhost:3000
npm test             # 73 tests, all in shared/
npm run typecheck
npm run build        # static export -> frontend/out
```

To work on the leaderboard as well, give the backend a database and run it:

```bash
cp backend/.env.example backend/.env    # then fill it in — see below
npm run api                             # http://localhost:8080
```

`DATABASE_URL` can point straight at a free Neon database; you don't need
Postgres on your machine. If you'd rather run one locally, `backend/docker-compose.yml`
brings up Postgres and the API together — but Docker is not required for
day-to-day work.

Point the game at it with `NEXT_PUBLIC_API_URL=http://localhost:8080 npm run dev`.

---

## Web — Vercel

> **If you deployed this before the repo was split into workspaces, you must
> change one setting or the build will fail:** Vercel → Settings → Build and
> Deployment → **Root Directory** → `frontend`.

1. https://vercel.com/new → import `subhm2004/Flappy-Dusk`
2. **Root Directory: `frontend`**
3. Environment variables:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | your Render URL, e.g. `https://flappy-dusk-api.onrender.com` |

   Leave it unset to ship the game without the leaderboard.

4. Deploy. Every push to `main` redeploys.

Do **not** set `NEXT_PUBLIC_BASE_PATH` — that exists only for GitHub Pages,
which serves from a `/Flappy-Dusk` subpath. Setting it on Vercel 404s every asset.

---

## Database — Neon

Render's free Postgres is deleted after 30 days. Neon's free tier isn't, which
is the only reason it's here.

1. https://neon.tech → new project → copy the connection string
2. Keep it for `DATABASE_URL` below
3. Create the tables:

   ```bash
   cd backend
   DATABASE_URL='postgres://…neon…' npx drizzle-kit push
   ```

---

## Google sign-in — Google Cloud

The API needs an OAuth client. This is the one part nobody can do for you.

1. https://console.cloud.google.com → new project
2. **APIs & Services → OAuth consent screen**
   - User type: **External**, then **Publish** it (in Testing mode only accounts
     you list by hand can sign in)
   - Scopes: the defaults are enough — the app only reads `openid profile`
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application** ← not "Android"
   - Authorised redirect URI, exactly:
     ```
     https://<your-render-app>.onrender.com/auth/google/callback
     ```
     Add `http://localhost:8080/auth/google/callback` too, for local work.
4. Copy the **Client ID** and **Client secret**

> **Why a "Web application" client and not an Android one?** The APK never talks
> to Google directly. Google refuses OAuth inside embedded WebViews, so the app
> opens the *system browser*, the backend does the exchange, and the session
> comes back to the app over `com.subhm2004.flappydusk://auth?token=…`. Google
> only ever sees the backend's HTTPS callback — which also means the Android
> signing key's SHA-1 fingerprint is irrelevant, and CI can keep re-signing the
> debug APK with a fresh key without breaking sign-in.

---

## API — Render

1. https://render.com → **New → Web Service** → connect the repo
2. Settings:

   | Setting | Value |
   |---|---|
   | Runtime | **Docker** |
   | Dockerfile path | `backend/Dockerfile` |
   | Docker build context | `.` *(the repo root — the image needs `shared/`)* |
   | Health check path | `/health` |

3. Environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string |
   | `JWT_SECRET` | `openssl rand -base64 48` |
   | `GOOGLE_CLIENT_ID` | from Google Cloud |
   | `GOOGLE_CLIENT_SECRET` | from Google Cloud |
   | `API_URL` | this service's own URL, e.g. `https://flappy-dusk-api.onrender.com` |
   | `WEB_APP_URL` | `https://flappy-dusk.vercel.app` |
   | `APP_SCHEME` | `com.subhm2004.flappydusk` |

4. Deploy, then confirm: `curl https://<your-app>.onrender.com/health` → `{"ok":true}`

> **Render's free tier sleeps** after 15 minutes idle, so the first request after
> a quiet spell takes ~50 seconds. The game handles it — the leaderboard says the
> server is waking up rather than showing an empty board — but it's the reason a
> first load can feel slow.

The build context is the repo root on purpose: the API scores runs by replaying
them with the *same* `shared/` code the browser used, so the image has to carry
that workspace. Pointing Docker at `backend/` alone will fail.

---

## Android APK

CI builds it — no Android Studio, no SDK.

**On demand:** GitHub → Actions → **Android APK** → **Run workflow**. Download
the `flappy-dusk-apk` artifact when it goes green.

**As a release** (permanent link, and what the README's download button points at):

```bash
git tag v1.2.0
git push origin v1.2.0
```

For the APK to reach the leaderboard, set a repo **variable** (Settings →
Secrets and variables → Actions → *Variables*):

| Name | Value |
|---|---|
| `API_URL` | `https://<your-render-app>.onrender.com` |

Without it the APK still builds and plays; it just has no leaderboard.

### Installing it

1. Open the APK on the phone. Allow **Install unknown apps** for whichever app
   you opened it from, then **Install anyway** past Play Protect.
2. **Uninstall any older build first.** Each CI run signs with a fresh debug key,
   and Android refuses a differently-signed upgrade with "App not installed".

### Building it locally (optional)

```bash
npm run build                        # export -> frontend/out
cd frontend
npx cap add android                  # scaffolds android/ — not committed
npx @capacitor/assets generate --android
node scripts/android-deeplink.mjs    # registers com.subhm2004.flappydusk://
npx cap sync android
cd android && ./gradlew assembleDebug
```

`android/` is regenerated every time, which is why the icon and the deep-link
intent-filter are re-applied on every build rather than committed.

### Release signing

CI produces a **debug-signed** APK, deliberately: a release key must not live in
the repo. Shipping to the Play Store would mean generating a keystore, storing it
base64-encoded as an Actions secret, and running `assembleRelease`. Not wired up —
a debug APK is all you need to sideload and share.

---

## CI

- `ci.yml` — every push and PR: `npm ci` → typecheck → test → build, on Node 20 and 22
- `android.yml` — the APK, on demand or on a `v*` tag

---

## Is the leaderboard actually trustworthy?

The game never sends a score. It sends the *inputs* of a run: the seed, the base
speed, how many physics steps it lasted, and the step index of every flap. The
API replays those inputs through `shared/` — the very same `step()` the browser
ran — and works out the score itself.

So `{"score": 999999}` isn't a cheat the protocol can even express. It's not in
the request body, and if you add it, nothing reads it.

What this does **not** stop is a bot that genuinely plays well: a program that
produces a real, valid input sequence earns a real score. That's a much higher
bar than editing a number in DevTools, and it's the honest limit of this design.

Two smaller holes are closed on the way:

- **Base speed** must be one the game can actually produce (`5.2 + 0.25 × level`,
  capped). You can't ask for a slow, easy run — and asking for a fast one only
  makes it harder.
- **Padding** is rejected. The run has to die on its final step, so you can't
  claim to have survived longer than you did.

Revived runs are never submitted: a revive rebuilds the pipe field mid-run, so
the recorded inputs stop reproducing it and there'd be nothing to verify.

---

## Troubleshooting

**Vercel build fails after the workspace split.** Root Directory is still the
repo root. Set it to `frontend`.

**`redirect_uri_mismatch` from Google.** The URI in the Cloud console must match
`<API_URL>/auth/google/callback` character for character — scheme, host, no
trailing slash.

**Sign-in works on the web but not in the APK.** The deep link isn't registered.
Confirm the `android-deeplink.mjs` step ran in the workflow log, and that
`APP_SCHEME` on Render matches the app id in `frontend/capacitor.config.ts`.

**Leaderboard says it can't be reached.** Usually Render waking up — give it a
minute. If it persists, check `curl <API_URL>/health` and the CORS origins in
`backend/src/index.ts`.

**Runs are rejected with `bad base speed`.** The client and server disagree about
`shared/`. They must be the same commit — the whole design rests on both sides
running identical physics.

**Progress resets every launch on Android.** `localStorage` is scoped to the
origin. Keep `server.androidScheme: 'https'` in `frontend/capacitor.config.ts`.

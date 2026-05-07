# Athion Prime Web — Status & Handoff

This is a working journal for the Athion Prime web app. New session
opening this repo for the first time: read top-to-bottom, then jump to
**§ Picking Up** for what's next.

---

## What this is

A web view of **Athion Prime**, our family Jellyfin + IPTV media client.
Mirrors the experience of the existing tvOS app (`NoahSmiley/tvos`).

Forked from `trevorkerney/Waverunner` (the upstream is preserved as a
remote). Ships under "Powered by Waverunner" — Trevor approved the fork.

Stack: React 19 / Vite 7 / TypeScript / Tailwind 4 / shadcn-ui /
`@jellyfin/sdk` / `hls.js`. OpenAI Sans, monochrome `#060606`/`#c8c8c8`
palette to match athion.me.

**Plan file** (full design context, locked in via interview):
`/home/noah/.claude/plans/lets-do-some-interviews-mighty-quill.md`

---

## Topology

```
Browser (athion-prime-web SPA)
   │  athion auth_token cookie (Domain=.athion.me)
   ▼
athion.me Next.js (CT 109, /opt/athion/app)
   │   /api/prime/jellyfin-token  ─►  per-user Jellyfin access token
   │   /api/prime/xtream/*        ─►  proxy IPTV (Phase 6, not built)
   ▼
Jellyfin (VM 100, 192.168.0.159:8096)        Xtream provider (external)
                                              (creds server-side only)
```

The browser **never** sees Xtream credentials or the Jellyfin admin
token. It holds:
- An athion session cookie, identifying the user to athion.me.
- A scoped Jellyfin access token, returned by the SSO endpoint.

Future deploy lives at `prime.athion.me` on Proxmox CT 111
`prime-web` (already provisioned, empty Debian 13 — see Phase 8).

---

## Status by phase

| Phase | What | Status |
|---|---|---|
| 0 | Trevor's blessing + LXC scaffold (CT 111 `prime-web` 192.168.0.148) | ✅ |
| 1 | Strip Tauri, browser-bootable skeleton, `tauri-shim.ts` | ✅ |
| 2 | athion.me: drizzle table `jellyfin_users`, `src/lib/jellyfin/admin.ts`, `/api/prime/jellyfin-token`, middleware allowlist. SPA: `AuthProvider` + `useJellyfin()` | ✅ |
| 3 | Jellyfin data layer + Movies / TV Shows grids end-to-end | ✅ |
| 3c | "Waverunner DNA" — breadcrumbs + forward stack, saveable sort presets per scope, sub-tree sidebar (All/By Genre/Collections), polished poster cards, "Powered by Waverunner" footer w/ logo | ✅ |
| design pass | OpenAI Sans + athion `#060606`/`#c8c8c8` palette + monochrome Waverunner logo | ✅ (was Phase 7's design half) |
| 4 | Item detail panel, series detail with seasons + episodes, `hls.js` player overlay, PlaybackInfo round-trip, codec capability detection + force-h264 retry, playback reporting, Skip Intro / Next Episode chapter buttons, auto-advance on `ended` | ✅ |
| 5 | Home view (Continue Watching / Latest Movies / Latest Shows / Collections / Live TV row); Search view | ✅ |
| 6 | Live TV — Xtream proxy on athion.me, channel browser + EPG, channel playback through hls.js | ✅ |
| 7 leftover | Settings page rebuild (account info, quality preference, logout). Design system already shipped early. | ✅ |
| 8 | Deploy: nginx on CT 111, build/rsync script, `prime.athion.me` DNS + 443 port forward | ⏳ pending |

---

## Architecture map (where things live)

### `athion-prime-web` (this repo)

```
src/
├── App.tsx                          shell: holds Navigation + playback state
├── main.tsx                         force dark, mount AuthProvider
├── App.css                          OpenAI Sans + athion palette + scrollbars
├── types.ts                         View union, SIDEBAR_DESTINATIONS, viewLabel()
├── lib/
│   ├── auth/session.ts              fetch /api/prime/jellyfin-token
│   ├── nav.ts                       useNavigation() — crumbs + forward stack
│   ├── sort-presets.ts              per-scope localStorage presets
│   ├── tauri-shim.ts                browser stubs for the few @tauri-apps imports
│   │                                 still in shadcn/ui primitives
│   ├── utils.ts                     cn() helper from shadcn
│   └── jellyfin/
│       ├── client.ts                createJellyfinClient(): typed wrapper.
│       │                              • getViews / getLatestItems / getResumeItems
│       │                              • getItems / getItem / getSeasons / getEpisodes
│       │                              • search
│       │                              • imageUrl / hlsUrl (sync fallback)
│       │                              • getPlaybackUrl  (PlaybackInfo round trip,
│       │                                  detects HEVC/AV1/VP9 via
│       │                                  MediaSource.isTypeSupported, forces
│       │                                  Profile=high&Level=51 for h264, caps
│       │                                  forceH264 retries to 1080p)
│       │                              • reportPlaybackStart/Progress/Stopped
│       └── types.ts                 re-exports of @jellyfin/sdk model types
├── components/
│   ├── AuthProvider.tsx             blocks render until session resolved;
│   │                                 redirects to athion.me/login in prod;
│   │                                 dev override via VITE_PRIME_DEV_SESSION
│   ├── Sidebar.tsx                  6 destinations (Movies/TV expandable),
│   │                                 monochrome Waverunner footer link
│   ├── BreadcrumbHeader.tsx         back/forward arrows + clickable trail
│   ├── MainContent.tsx              dispatches on View, owns LibraryView /
│   │                                 GenresList / GenreView / ItemGrid
│   ├── PosterCard.tsx               hover treatment (scale + ring + shadow)
│   ├── SortControls.tsx             sort dropdown + saveable presets
│   ├── ui/*                         shadcn primitives, mostly untouched
│   ├── views/
│   │   ├── ItemDetail.tsx           backdrop hero + cast/genres/runtime + Play
│   │   └── SeriesDetail.tsx         season tabs + episode rows + Resume
│   └── player/
│       └── PrimePlayer.tsx          hls.js + native fallback, custom overlay,
│                                     reporting cadence, Skip Intro / Next chap
public/
├── fonts/OpenAISans-*.woff2         copied from athion.me
└── logo256.png                      Trevor's W-wave (rendered grayscale)
```

### `athion.me` (CT 109 `/opt/athion/app`, repo `NoahSmiley/athion`)

Files added/modified for Prime support:

```
src/lib/db/schema.ts                  + jellyfinUsers table
src/lib/jellyfin/admin.ts             new — admin client + ensureUser + issueUserToken
src/app/api/prime/jellyfin-token/
  route.ts                            new — GET + OPTIONS, CORS
src/middleware.ts                     /api/prime/ added to PUBLIC_PREFIXES
drizzle/0012_jellyfin_users.sql       new — applied to live DB
.env.production                       + JELLYFIN_URL / JELLYFIN_ADMIN_TOKEN
                                      / JELLYFIN_USER_PASSWORD_SECRET
```

Both repos' Phase 2 work is committed. **`NoahSmiley/athion` Phase 2
commit is local on CT 109; not yet pushed to GitHub** (no SSH key in
that LXC for github). Run from the CT to push:

```bash
ssh homelab 'pct exec 109 -- bash -c "cd /opt/athion/app && runuser -u athion -- git push"'
```

(Will prompt for credentials if no PAT in user's git config — see § Gotchas.)

---

## Local dev setup

### Prerequisites
- Node 25+, pnpm 10+, chromium for headless screenshots (`pacman -S chromium`)
- SSH access to `homelab` (Proxmox host) and `pct exec` for CT 109/111

### Run dev server

```bash
cd ~/code/athion-prime-web
pnpm install   # only on first checkout
pnpm dev       # serves on http://localhost:1420
```

### Auth in dev (cross-origin → cookies don't cross)

The SPA expects to fetch `/api/prime/jellyfin-token` from athion.me
with credentials. In production (`prime.athion.me`) the cookie is
shared via `Domain=.athion.me`. In dev (localhost) it can't be sent.

Workaround: the SPA reads `VITE_PRIME_DEV_SESSION` from `.env.local`
as a baked-in session JSON. Refresh anytime the token expires
(currently it's manual; an auto-refresh on 401 is a TODO):

```bash
JWT=$(ssh homelab 'pct exec 109 -- bash -c "set -a; . /opt/athion/app/.env.production; set +a; cd /opt/athion/app && runuser -u athion -- node -e \"(async()=>{const{SignJWT}=await import(\"jose\");const s=new TextEncoder().encode(process.env.JWT_SECRET);console.log(await new SignJWT({sub:\"790a4d56-0b9a-48be-bb02-7780d1d20c2e\"}).setProtectedHeader({alg:\"HS256\"}).setIssuedAt().setExpirationTime(\"30d\").sign(s));})()\""' | tail -1)
SESSION=$(ssh homelab "pct exec 109 -- curl -s -b 'auth_token=$JWT' http://localhost:3000/api/prime/jellyfin-token")
echo "VITE_PRIME_DEV_SESSION=$SESSION" > ~/code/athion-prime-web/.env.local
chmod 600 ~/code/athion-prime-web/.env.local
pkill -f vite; (cd ~/code/athion-prime-web && pnpm dev > /tmp/vite.log 2>&1 &)
```

The athion user `noah` has id `790a4d56-0b9a-48be-bb02-7780d1d20c2e`.
For another user, swap the `sub` value.

### Headless screenshot recipe

```bash
chromium --headless --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=1600,1000 --virtual-time-budget=10000 \
  --screenshot=/tmp/shot.png http://localhost:1420/
```

To capture a specific view, change the default in `src/lib/nav.ts`
(`initial: View = HOME`) temporarily, screenshot, then revert.

### Verifying changes against Jellyfin directly

The Jellyfin admin token + user's session token can be pulled from
`.env.local`:

```bash
SESSION=$(grep VITE_PRIME_DEV_SESSION ~/code/athion-prime-web/.env.local | sed 's/^[^=]*=//')
TOKEN=$(echo "$SESSION" | python3 -c "import json,sys; print(json.load(sys.stdin)['accessToken'])")
USERID=$(echo "$SESSION" | python3 -c "import json,sys; print(json.load(sys.stdin)['userId'])")
DEVID=$(echo "$SESSION" | python3 -c "import json,sys; print(json.load(sys.stdin)['deviceId'])")

# Example: list movies
curl -s "http://192.168.0.159:8096/Items?userId=$USERID&IncludeItemTypes=Movie&Recursive=true&Limit=5" \
  -H "Authorization: MediaBrowser Token=$TOKEN" | python3 -m json.tool | head -20
```

---

## Picking up — what's next, prioritized

### Phase 5 — Home view + Search   [DONE 2026-05-06]

Shipped:
- `src/components/views/HomeView.tsx` — horizontal-scrolling rows for
  Continue Watching, Latest Movies, Latest Shows, Collections, plus a
  Live TV placeholder card. Each row loads independently and hides
  itself on empty so the page stays terse. Embla carousel with
  per-row `‹ ›` controls that fade in on group hover.
- `src/components/views/SearchView.tsx` — debounced (220ms) input
  with auto-focus, stale-response guard via request-id, skeleton
  loading, empty/error states, and a "refreshing…" inline indicator
  while a new query is in flight.
- `src/components/MainContent.tsx` — dispatches `home` / `search` to
  the new views. The `livetv` case is still a placeholder until
  Phase 6.

### Phase 6 — Live TV (Xtream)   [DONE 2026-05-06]

Shipped:
- **athion.me** — server-side `src/lib/xtream/client.ts`,
  `src/lib/xtream/route-helpers.ts`, and four routes under
  `/api/prime/xtream/`: `categories`, `streams` (`?category=`),
  `epg/[streamId]` (5-min `Cache-Control`), and `play/[streamId]`
  (302 redirect to upstream HLS so credentials never leave the server).
  EPG title/description are base64-decoded server-side.
- **Auth** — added `resolveSession(req)` that prefers the cookie and
  falls back to `Authorization: Bearer <jwt>` (for fetch calls) or
  `?dev_token=<jwt>` (for the play redirect, since `<video>` and
  hls.js can't easily attach headers). Production uses the cookie via
  `Domain=.athion.me`.
- **SPA** — `src/lib/xtream/client.ts` is the typed wrapper, attaches
  `VITE_PRIME_DEV_JWT` as Bearer auth in dev. `LiveTvView` mirrors
  tvOS Prime's section model (Entertainment / Sports / News / Kids /
  Movies / Music / Lifestyle / 4K Ultra HD) using the same keyword
  heuristic over Xtream categories. Per-channel cards show their
  current EPG title; click opens a fullscreen `<video>` overlay
  driven by hls.js (or native HLS on Safari).
- **`.env.production`** on CT 109 has `XTREAM_BASE_URL`,
  `XTREAM_USERNAME`, `XTREAM_PASSWORD` — same creds as the tvOS app.

Verified end-to-end: 8 sections render, Entertainment lists 424 real
channels, A&E HD plays at 1280×720 in 4–5s.

### Phase 7 leftover — Settings page rebuild   [DONE 2026-05-06]

Shipped:
- `src/lib/settings.ts` — typed `PrimeSettings` (currently just `quality`),
  `loadSettings()` / `saveSettings()` against localStorage key
  `athion-prime:settings`, with defensive parsing that drops unknown
  keys instead of throwing. `maxBitrateFor(quality)` returns the cap.
- `src/components/views/SettingsView.tsx` — Account section reading from
  the live session (`username`, deviceId), Playback quality section with
  three click-to-save buttons (Local 4K Remux 80 Mbps / Remote 40 Mbps /
  Remote 10 Mbps) and a brief "Saved" flash, Session section with a
  Sign-out button, Credits section.
- `src/components/player/PrimePlayer.tsx` — `getPlaybackUrl()` now uses
  `maxBitrateFor(loadSettings().quality)` so the user's preference
  controls Jellyfin's transcode ceiling. forceH264 retries still go
  through getPlaybackUrl's own 1080p safety cap.
- `src/components/MainContent.tsx` — wires the new view; old in-file
  stub deleted.
- **athion.me** — `/api/auth/logout` now serves CORS for
  `prime.athion.me` and `localhost:1420` so the in-app sign-out works
  cross-origin. Production clears the shared `.athion.me` cookie so
  Prime / Press / athion.me all sign out together.

### Phase 8 — Deploy   [START HERE]

Two halves:

**athion.me side** (in `/opt/athion/app`):
- `src/lib/xtream/client.ts` — server-side Xtream client. Env:
  `XTREAM_BASE_URL`, `XTREAM_USERNAME`, `XTREAM_PASSWORD`.
  Methods: `getCategories`, `getLiveStreams(categoryId?)`, `getEPG(streamId)`.
- `src/app/api/prime/xtream/categories/route.ts`
- `src/app/api/prime/xtream/streams/route.ts` (`?category=`)
- `src/app/api/prime/xtream/epg/[streamId]/route.ts` (5-min cache header)
- `src/app/api/prime/xtream/play/[streamId]/route.ts` — returns a
  redirect (302) to `<base>/live/<u>/<p>/<streamId>.m3u8`. Browser
  follows; creds never see the client.
- All routes gate on `getSession()` and add the same CORS as
  jellyfin-token.

**SPA side**:
- `src/components/views/LiveTvView.tsx` — categories sidebar +
  channel grid (logo + name + current EPG title), reuse `PrimePlayer`
  with the proxied HLS URL.
- Port the category mapping from the tvOS `Prime/IPTV/` directory
  (Entertainment / Sports / News / Kids / Movies / Music / Lifestyle / 4K).

### Phase 7 leftover — Settings page rebuild (detail)

Now that the design system is live, build out a real settings page
under `src/components/views/SettingsView.tsx`:

- Account info: athion username + Jellyfin username (read from session)
- Playback quality preference: Local 4K Remux / Remote 40 Mbps /
  Remote 10 Mbps. Stored in `localStorage` as `athion-prime:settings`.
  `client.getPlaybackUrl()` already takes `maxBitrate` — wire from
  here.
- Logout button → POST athion.me /api/auth/logout (clears
  `auth_token`), then redirect to athion.me homepage.
- Footer credit (already in MainContent; could be styled nicer).

Wire into MainContent's dispatch (replace stub `SettingsView`).

### Phase 8 — Deploy (detail)

CT 111 `prime-web` (192.168.0.148) is provisioned but empty. Steps:

1. SSH in, install nginx: `ssh prime-web 'apt-get install -y nginx'`
2. Drop static build into `/var/www/prime-web/` via rsync:
   ```bash
   cd ~/code/athion-prime-web && pnpm build
   rsync -av --delete dist/ prime-web:/var/www/prime-web/
   ssh prime-web 'systemctl reload nginx'
   ```
3. nginx site config — SPA fallback (`try_files $uri /index.html`),
   `Cache-Control: immutable, max-age=31536000` for `/assets/*`,
   no-cache for `/index.html`.
4. DNS: `prime.athion.me` A record → home WAN IP → port forward
   443 → 192.168.0.148. TLS via Let's Encrypt (certbot on the LXC,
   or terminate at the existing reverse proxy if one exists).
5. Set `VITE_ATHION_API_BASE` and `VITE_ATHION_LOGIN_URL` at build
   time so the SPA hits production athion.me.
6. Add a deploy script at `scripts/deploy.sh` and a memory note.

---

## Known gotchas

### Auth / sessions
- **Dev session expires.** Refresh via the recipe in § Local dev setup.
  In prod the SPA can re-fetch on 401; in dev it can't, because cross-
  site cookies aren't sent.
- **TODO**: have `AuthProvider` retry once on 401 by re-calling
  `fetchJellyfinSession()`. Cheap to add in
  `src/components/AuthProvider.tsx`. Will self-heal prod sessions
  when Jellyfin invalidates a token.
- **The hidden `jellyfin` admin user has password `jellyfin`.** Real
  security concern — change in the Jellyfin web UI when convenient.
  Login as `jellyfin`/`jellyfin` → Account → Password.

### Player / quality
- **HEVC support varies by browser.** `detectCodecSupport()` probes
  via MSE; some Linux Chromiums *claim* HEVC support but actually
  fail (`manifestIncompatibleCodecsError`). The player auto-retries
  with `forceH264: true`, which strips HEVC/AV1/VP9 from the profile
  and caps to 1080p H.264 high-profile L5.1.
- **Original 4K HDR sources transcoded to H.264 SDR show banding.**
  This is fundamental — 10-bit HDR → 8-bit SDR loses precision.
  Mitigated by: (a) preferring codec-copy/remux when browser supports
  source codec, (b) bumping bitrate ceiling to 80 Mbps. The Phase 7
  Quality preference dropdown will let users pick.
- **Bundle size 875 KB** mostly because `hls.js` is ~370 KB. Code-
  splitting the player bundle is worth doing in Phase 8 polish.

### Jellyfin
- **DeviceId is bound to the athion user**, not per-tab. Multiple tabs
  open simultaneously will share a Jellyfin session. Probably fine for
  one user; revisit if it causes resume-position races.
- **JELLYFIN_ADMIN_TOKEN was minted via** `POST /Auth/Keys?App=Athion+Prime+Backend`
  and **persists in the Jellyfin DB** (`/var/lib/jellyfin/data/jellyfin.db`,
  table `ApiKeys`). Revoke from Dashboard → API Keys if needed.
- **JELLYFIN_USER_PASSWORD_SECRET is load-bearing.** Rotating it would
  invalidate every existing `jellyfin_users` row's effective password,
  so each athion user would lose access until manual re-provisioning.
  Don't rotate without a migration path.

### git
- The athion.me Phase 2 commit is local on CT 109. To push it to GitHub:
  ```bash
  ssh homelab 'pct exec 109 -- bash -c "cd /opt/athion/app && runuser -u athion -- git push origin main"'
  ```
  May prompt for GitHub PAT — credentials aren't cached in the LXC.

---

## Reference: the Jellyfin user mapping

The athion user `noah` is mapped to Jellyfin user `athion_noah`
(provisioned during Phase 2 testing). Visible in Jellyfin
Dashboard → Users.

| | |
|---|---|
| athion user id | `790a4d56-0b9a-48be-bb02-7780d1d20c2e` |
| Jellyfin user id | `546831e6e27d4a13aa72a94c61e61df3` |
| Jellyfin username | `athion_noah` |
| Jellyfin admin token name | "Athion Prime Backend" |

The **Harry Potter** library + **Breaking Bad** / **Severance** are
the test content for the dev session.

---

_Last updated: 2026-05-06 (Phase 7 shipped — Settings live with quality wired into player; ready for Phase 8 Deploy)._

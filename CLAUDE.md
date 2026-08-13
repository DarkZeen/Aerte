# Aerte

Single-file iOS-style fitness + meal tracking PWA. One `index.html` (~810 KB, ~6,700 lines), no build step, no framework, no backend. Hosted on GitHub Pages at `https://darkzeen.github.io/Aerte/` and installed to the home screen on iPhone.

Tabs: **Week · Training · Food · Shopping**, plus a hidden developer mode.

---

## Deploy loop

The repo root **is** the website. Files at root, no subfolders.

```
index.html          the entire app
manifest.json       PWA metadata
service-worker.js   offline cache
icon-192.png  icon-512.png  apple-touch-icon.png  favicon.png
```

**Every deploy, without exception:** bump `CACHE_VERSION` in `service-worker.js` (`'v1'` → `'v2'` → …). The cache key is derived from it. Skip the bump and devices keep serving the old shell — the change appears to have silently not happened. This is the single most common failure here.

Then: commit → push. Pages rebuilds in ~1 minute.

---

## Architecture

### Storage — one choke point, keep it that way

Every read and write goes through two functions:

```js
function gget(k){ ... localStorage.getItem(k) ... }   // -> {value} | null
function gset(k,v){ ... localStorage.setItem(k,v) ... } // -> true | false
```

`gset` returns a boolean and toasts on quota failure. **Do not add direct `localStorage` calls anywhere else.** Everything downstream — sync, namespacing, migration to IndexedDB — depends on this staying a single funnel.

### Keys

38 keys under two prefixes: `aerte5_` (fitness) and `meal_` (food), plus `aerte_schema`. `ALL_STORE_KEYS` is the authoritative list; `DEV_STORE_KEYS` is an alias of it. Export, import, and wipe all derive from that array.

**Never rename the `aerte5_` prefix.** Bumping it to `aerte6_` silently orphans every user's data. Migrate in place via the schema ladder.

### Schema ladder

`SCHEMA_KEY` + `SCHEMA_VERSION` + `MIGRATIONS[]`, run by `runMigrations()` at boot. v1 is a baseline that marks the app's five pre-existing ad-hoc migrations as done. Any structural change to stored data gets a new migration step — do not add another one-off `*_v3` / `*_migrated` key.

---

## Hard rules

**Never put a token, key, or secret in `index.html`.** The repo is public. Runtime-entered credentials go in `localStorage` via the settings UI, never in committed source.

**Muscle art fills live in the `fill` attribute, never in `style=`.** A style fill beats `setAttribute('fill', …)` and silently kills the body-map heat shading. There's a build assertion for this; keep it true.

**Map Studio and the Body Map binder are deliberately separate.** Map Studio writes cropped icons into `MSVG` and will overwrite the built-in anatomical artwork (it has a confirm guard). The Body Map binder writes only `data-m` tags into `BMAP`. Do not merge them.

**Rotation membership lives on the exercise, not the day.** `exTypes(e)` (`e.types || [e.type]`) decides which day types a move belongs to; `e.role` is `'core'` (every session) or `'secondary'` (shuffled pool). `CYCLE[i].exs` is only read when a slot is in `fixed` mode. Changing role or membership should call `offerReresolve()`, which re-resolves unstarted future days and leaves completed ones alone.

---

## Already built — don't rebuild

- **Muscle icons** — 25 anatomical SVGs in `MUSCLE_SVG`, defaults `MUSCLE_ART`, variants `MUSCLE_ALT`, user picks `MPICK`.
- **Body map** — full-body front/back figures in `BODY_ART`, regions tagged `data-m`, per-path `data-bi`, retags in `BMAP`. Both figures normalised to identical ink height.
- **Colour system** — CSS variables `--m-base` `--m-idle` `--m-line` `--m-prim` `--m-sec`; accent toggle (orange / mono) in Dev Studio → Muscles.
- **Rotation** — cycle editor, roll/fixed slots, role + multi-type membership editor, resolved-slot preview.
- **Exercise editor** — editable primary/secondary muscle chips with one-tap cross-role reassignment.
- **Streaks & achievements** — 7 tiers (`STREAK_TIERS`), `computeUnifiedStreak()`, 16 `ACHIEVEMENTS`, per-tier badge overrides + editor, dev reset, day-offset time travel.
- **PWA + backup** — manifest, service worker, schema ladder, full export/import.
- **Cross-device sync** — secret GitHub Gist as the blob. See below.

---

## Cross-device sync

A secret GitHub Gist holds one JSON blob (`aerte-data.json`). No new service, no new account.

```
boot / tab focus / online  ->  GET  gist  ->  apply if the blob is new to us
any gset() of a synced key ->  PATCH gist ->  debounced 3s
```

Both directions go through **`syncNow(reason)`**, which always does the GET first. That preflight is what makes "warn before overwriting newer remote data" possible: a PATCH only goes out once the remote blob is confirmed to be one we've already reconciled with.

Reachable from Profile → Cross-device sync, and from the dev bar (cloud icon) → also Data tools. Status shows as a chip bottom-left; it stays hidden while idle and appears for syncing / queued / waiting / conflict / error.

### The three rules that keep it correct

**1. Credentials never leave the device.** `aerte_sync_cfg` (gist ID + PAT) and `aerte_sync_state` are deliberately **not** in `ALL_STORE_KEYS`, so they're excluded from the blob and from export files. Never add them.

**2. Never compare two devices' clocks.** `localAt` and `pushedAt` are both stamped from *this* device's clock and compared only against each other (`localAt > pushedAt` means "unpushed edits"). Assigning either from a remote payload's `updatedAt` is how you get a `pushedAt` in the future, at which point `syncDirty()` can never be true again and the device silently stops pushing forever. A phone whose clock is two minutes ahead is enough to trigger it. `syncClearDirty()` exists for this; use it instead of assigning timestamps by hand. `remoteAt` is display-only.

`syncTouch` stamps `Math.max(Date.now(), pushedAt+1)` — an apply-then-edit inside one millisecond must still register as an edit.

**3. "Have I seen this blob?" is answered by signature, not timestamp.** `syncSig()` is `updatedAt|length`. A timestamp comparison would mix clock domains again: a lagging device's genuinely-new blob would read as older than one already seen and be skipped for good. The signature is also what stops an undated payload from being applied-and-reloaded in a loop.

### Behaviour worth not regressing

- Remote `schema` higher than `SCHEMA_VERSION` → refuse, surface, change nothing, and **don't store the ETag** (the same blob must be re-read after the app updates). Lower → applied, then `runMigrations()` ladders it up.
- Both sides changed since the last sync → conflict sheet with keep-local / take-remote / decide-later / export-first. Nothing is written until the user picks. While unresolved, background syncs are blocked entirely so they can't pre-empt the answer.
- A pull that lands while a bottom sheet is open is deferred (status `waiting`), then flushed by `closeSheet()` — applying reloads the page, which mid-edit would throw away what the user was typing.
- A key absent from the blob is unset locally (whole-blob semantics), except keys the sender listed in `omitted` — that's how the artwork opt-out avoids deleting the other device's artwork.
- A failed write during apply (quota) throws, so the blob is **not** marked reconciled — otherwise the next pull 304s and the half-applied state looks settled forever.
- The service worker skips cross-origin requests. Its static branch is cache-first, which for `api.github.com` would freeze the gist and make every pull look like "no change".

**Test before shipping:** export → wipe → import round-trips all 38 keys; a conflicting edit on two devices warns instead of silently discarding. Both clock-skew directions and the same-millisecond edit are the regressions that actually bit.

---

## Working style

- Lead with the answer, then detail. No filler, no hedging.
- Push back directly when something is a bad idea.
- Verify claims against the actual file rather than asserting from memory — assumptions have caused real bugs here (a duplicated function block once silently shadowed a working feature for weeks).
- Ship working increments over polished plans.

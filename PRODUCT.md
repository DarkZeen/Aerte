# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner (a calisthenics trainee who plans and cooks their own food) is the primary and near-only user, across two devices with genuinely different roles: a **computer at a desk**, where the real work happens — planning the week, building recipes, managing the exercise library — and an **iPhone** with the PWA installed to the home screen, carried into the gym and the grocery store.

A small second tier exists: a friend, partner, or training buddy may install it. That means a stranger's first run has to survive without the owner narrating it — empty states and labels must stand on their own — but the app is not designed for cold public arrival and owes nothing to an anonymous audience.

## Product Purpose

Aerte puts calisthenics training and meal tracking on one calendar. Its reason to exist is that training and eating are a single weekly plan, not two apps: the rotation decides what you train, the meal plan decides what you eat, and the shopping list falls out of both.

The three jobs it has to nail, in order:

1. **See what today is.** Open it and immediately know which session is up, what's planned to eat, what's left. *Both devices.*
2. **Plan the week ahead.** A longer, deliberate sitting: set the rotation, assign meals to days, build recipes. *Desk.*
3. **Shop from the plan.** In the store, working the generated list against what's already in the fridge. *Phone.*

Logging during a session is real and used — the full-screen sequence player with timers and cues is not decoration — but it is a secondary job, not the one the app is built around. *Phone.*

## Positioning

A neighbouring fitness app cannot truthfully copy the combination of: training rotation, meal plan, fridge inventory, and shopping list resolving against one week, with no account, no server, and no network requirement — where cross-device sync is a secret GitHub Gist the user owns, holding one JSON blob. There is no service to sign up for and nothing to cancel.

## Operating Context

- **Where:** two real scenes, not one plus a fallback.
  - **Desk, wide screen, mouse and keyboard.** Where planning, recipe building, and library management actually happen. This is where the design starts.
  - **iPhone, at arm's length, one hand.** Gym mid-session, kitchen, grocery store. Thumb reach and glanceability still decide these surfaces; a shopping list that needs two hands is broken.
- **Install:** home-screen PWA, standalone display, dark theme colour. Served from GitHub Pages at `https://darkzeen.github.io/Aerte/`.
- **Deploy ritual:** repo root *is* the website. Every deploy bumps `CACHE_VERSION` in `service-worker.js`, or devices keep serving the old shell. Commit, push, Pages rebuilds in ~1 minute.
- **Sync:** GET the gist on boot / tab focus / online; PATCH debounced 3s after any write to a synced key. Both directions go through `syncNow(reason)`.

## Capabilities and Constraints

**Surfaces:** four tabs — Week, Training, Food (Recipes · Products · Supplements · Fridge), Shopping — plus a Profile sheet and a hidden developer mode (Dev Studio).

**Confirmed functionality:** week calendar with day detail; training rotation with roll/fixed slots and role-based exercise membership; exercise library with primary/secondary muscle chips; 25 anatomical muscle SVGs and full-body front/back heat-shaded body map; full-screen session player with warmups, stretches, timers and cues; PR and progress tracking; unified streak with 7 tiers and 16 achievements; recipes, products, supplements, fridge inventory with "recipes you can make" matching; generated shopping list with ticks, custom items, dismissals and notes; PDF and JSON export/import; cross-device sync.

**Technical constraints:**

- Every read and write goes through `gget(k)` / `gset(k,v)`. No direct `localStorage` calls anywhere else — sync, namespacing, and any future migration to IndexedDB all depend on that single funnel. `gset` returns a boolean and toasts on quota failure.
- 38 keys under two prefixes, `aerte5_` (fitness) and `meal_` (food), plus `aerte_schema`. `ALL_STORE_KEYS` is authoritative; export, import and wipe all derive from it. The `aerte5_` prefix must never be renamed — bumping it orphans every user's data.
- Structural changes to stored data go through the schema ladder (`SCHEMA_KEY` / `SCHEMA_VERSION` / `MIGRATIONS[]`, run by `runMigrations()` at boot), never a new one-off `*_v3` / `*_migrated` key.
- `aerte_sync_cfg` (gist ID + PAT) and `aerte_sync_state` are deliberately excluded from `ALL_STORE_KEYS`, so credentials never enter the synced blob or an export file. Never add them.
- Never compare two devices' clocks. `localAt` and `pushedAt` are both stamped from *this* device and compared only to each other; "have I seen this blob?" is answered by `syncSig()` (`updatedAt|length`), not by timestamp.
- **No token, key, or secret in `index.html`.** The repo is public. Runtime credentials live in `localStorage` via the settings UI.
- Muscle art fills live in the `fill` attribute, never in `style=` — a style fill beats `setAttribute('fill', …)` and silently kills heat shading. There is a build assertion for this.
- Map Studio and the Body Map binder are deliberately separate and must not be merged.

**Known gap:** no wide layout exists yet. At 1440px the app renders as a 780px column (`.wrap` is `max-width:780px`) with ~660px of empty space; the only width response in the whole file is a `min-width:560px` bump from two grid columns to three. Desktop-first is the newly agreed direction, not a description of the current build.

**Undecided / deliberately open:** single-file, no-build is a strong preference, not a hard rule — it stays the default because it is simple and deploys to Pages for free, but a build step is on the table if something genuinely needs it. The 862 KB `index.html` is a known cost, accepted for now.

## Brand Commitments

- **Name:** Aerte. The header reads `Aerte` as a kicker above `Daily`; the manifest name is "Aerte — Daily".
- **iOS design language is binding on the phone, loosened on the desktop.** On iPhone the app reads as a system app: SF Pro / `-apple-system` type, saturated backdrop blur, bottom sheets, spring easing, segmented controls, large rounded radii. Drifting toward a generic web look there would be a failure, not a refresh. On a wide screen it is allowed — expected — to behave like a proper desktop app instead: denser rows, tighter radii, real hover states, visible keyboard focus, more on screen at once. Two related looks from one product, not one look stretched.
- **Dark-first**, with a light theme as an equal-quality alternate. Near-black grounds, iOS system accent colours (`--red` `#ff453a` as the primary, plus green/blue/orange/purple/teal), and a mono accent mode for the muscle art.
- **Offline-first, no account, permanently.** localStorage plus the owner's own secret Gist is the entire backend. No sign-up, no server, no third-party service.
- **Desktop-first, phone-essential.** The wide layout is designed first because that is where the owner does the real work. The phone is not a shrunken leftover: the shopping and in-session surfaces are judged on their own terms, one-handed.
- Existing assets at repo root: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.png`.

## Evidence on Hand

- The working app itself: [index.html](index.html) (~862 KB, ~7,300 lines), in daily personal use.
- Engineering record and hard rules: [CLAUDE.md](CLAUDE.md).
- Design tokens live in the `:root` block of `index.html` (~line 24) with `[data-theme="light"]` and `[data-accent="mono"]` overrides.
- **No DESIGN.md exists yet** — the incumbent visual system is undocumented. That is a documentation gap, not an absence of design authority.
- **Nothing to fabricate:** there are no users beyond the owner and a possible handful of acquaintances, no testimonials, no metrics, no press, no pricing, no licence terms, and no company. Future work must not invent any.

## Product Principles

1. **One week, one plan.** Training, meals, fridge and shopping are views onto the same week. Anything that splits them back into separate apps is a regression.
2. **Orientation before entry.** The most common action is looking, not typing. "What is today" must be answerable in the first viewport without a tap.
3. **Each job on the device it actually happens on.** Planning earns the wide screen and should use it — density, multiple columns, more visible at once. Shopping and training earn the phone and should stay one-handed. Neither is the other's leftover.
4. **It works with the network off.** Sync is a convenience layer over local truth, never a precondition for anything.
5. **The owner's data is the owner's.** No account, no server, no telemetry; credentials stay on-device and out of every export.

## Accessibility & Inclusion

No formal standard has been adopted, but colour contrast is now actively maintained: the dark-mode tertiary text, the light-mode red, and the green CTA were each retuned to clear WCAG AA (the reasoning is recorded inline in `index.html`). Future colour choices are expected to hold that line.

Two practical constraints:

- **Phone:** touch targets and hit areas must survive a hand that is also holding a shopping basket, or a phone mid-set.
- **Desktop:** now that a wide layout is a first-class target, keyboard reachability and a visible focus ring are part of it. Hover-only affordances are not acceptable as the sole route to any action.

# Aerte — animation improvement plans

Produced by `improve-animations` (full audit) and `find-animation-opportunities`, both run
against commit **8f786bf** on `main`.

Every plan is self-contained: exact file paths, verbatim current code, exact target values, and
a feel check. An executor with no context should be able to run one without reading anything
else — including this file.

**Applies to every plan:** the last step is always to bump `CACHE_VERSION` in
`service-worker.js`. Skip it and installed devices keep serving the old shell, and the change
looks like it silently did not happen. If several plans land in one commit, one bump covers
them all.

---

## Plans

| # | Title | Severity | Category | Status |
| --- | --- | --- | --- | --- |
| [001](001-quiet-in-place-rerenders.md) | Stop replaying entrances on in-place re-renders | HIGH | Purpose & frequency | **DONE** |
| [002](002-gate-hover-for-touch.md) | Gate every hover effect behind a real pointer | HIGH | Accessibility | **DONE** |
| [003](003-sleep-the-dial-loop.md) | Let the liquid dial's frame loop sleep | HIGH | Performance | TODO |
| [004](004-throttle-pointer-handlers.md) | Throttle pointer handlers, skip them on touch | HIGH | Performance | TODO |
| [005](005-sheet-drawer-curve.md) | Stop the sheet lifting off the bottom edge | HIGH | Physicality | **DONE** |
| [006](006-transition-presets.md) | Replace 49 `transition: all` shorthands with presets | MEDIUM | Cohesion & tokens | TODO |
| [007](007-reduced-motion-tiers.md) | Make reduced motion gentler, not dead | MEDIUM | Accessibility | TODO |
| [008](008-bookend-grid-collapse.md) | Replace the `max-height: 2000px` accordion hack | MEDIUM | Performance | TODO |
| [009](009-drag-ghost-transform.md) | Move the drag ghost with `transform` | MEDIUM | Performance | TODO |
| [010](010-glider-and-traveller-timing.md) | Retime the glider and the day-strip traveller | MEDIUM | Easing & duration | **DONE** |
| [011](011-press-and-entrance-scales.md) | Bring press and entrance scales into range | MEDIUM | Physicality | **DONE** |
| [012](012-water-wobble-repaint.md) | Stop the water wobble repainting forever | MEDIUM | Performance | TODO |
| [013](013-sheet-content-stagger.md) | Land the sheet's contents with the sheet | MEDIUM | Interruptibility | **DONE** |
| [014](014-row-level-entrance.md) | Animate the row that changed, not the whole list | MEDIUM (additive) | Missed opportunity | TODO |
| [015](015-workout-completion-moment.md) | Give completing a workout a moment | MEDIUM (additive) | Missed opportunity | TODO |
| [016](016-sequence-item-crossfade.md) | Bridge the hard cut between sequence moves | MEDIUM (additive) | Missed opportunity | TODO |
| [017](017-sheet-drag-to-dismiss.md) | Make the sheet's grab handle real | MEDIUM (additive) | Missed opportunity | TODO |

Six plans are applied and **uncommitted** in the working tree (`git diff` to review,
`git checkout index.html service-worker.js` to revert all of them). `CACHE_VERSION` is bumped
`v2` → `v3`, which covers all six.

### Deviations from the plans as written

- **002 step 7 was skipped.** `.fab-group` / `.gear-btn` (`index.html:510-516`) have no markup
  and no JS references — they are dead CSS. Gating them would have been a no-op. The plan told
  the executor to read first and stop if the gear had no other route on touch; it has no route
  at all. Worth deleting separately, but that is not an animation change.
- **001's replace-all guard fired, correctly.** The plan claimed
  `renderShop();renderFridge&&renderFridge();` occurred twice; it occurs **five** times. The
  three extra sites are `clearShopping()` bulk actions and a dedupe flow — genuine wholesale
  content changes where an entrance replay is defensible. Only the two toggle handlers were
  wrapped. If you re-run 001 from the plan text, fix that count first.

### Latent issue found while verifying 001

`__motion.quiet()` (`index.html:6768-6775`) releases its flag with a double
`requestAnimationFrame`, and **rAF does not fire while `document.hidden` is true**. So a
quiet-wrapped render that happens while the page is hidden leaves `QUIET` stuck on until the
page is visible again for two frames. This is pre-existing, not introduced by 001 — but 001
takes the call sites from one to six, which raises the odds of hitting it. It self-corrects on
the next visible frame, so it is not urgent. A `visibilitychange` fallback in `quiet()` would
close it, and it belongs naturally with **plan 003**, which is already about hidden-page
behaviour.

---

## Dependencies

```
005 ──> 017        017 uses --ease-drawer, introduced by 005
001 ──> 014        without 001 the single-row entrance is invisible under a full replay
001 ──> 015        015 assumes the completion re-render is already quiet
006 ─ ─> 011, 013  soft: 006 touches many of the same lines; land it first to avoid conflicts
```

Everything else is independent. 002, 003, 004, 007, 008, 009, 010, 012 and 016 can be run in
any order and in parallel.

---

## Recommended execution order

**Wave 1 — the ones a user feels today.** Independent of each other; can run in parallel.

1. **001** — stop replaying entrances. Highest leverage in the set: one helper already exists
   and is used once, and wiring it up removes the app's most repeated annoyance.
2. **002** — gate hover for touch. Fixes a visible bug on the FAB, the primary control.
3. **005** — sheet drawer curve. Two lines; removes a visible gap under every sheet.

**Wave 2 — the ones the battery feels.** Also independent.

4. **003** — sleep the dial loop. Stops a 30 Hz SVG rebuild running in the background.
5. **004** — throttle the pointer handlers. Removes forced layout from the touch-scroll path.
6. **012** — water wobble repaint.

**Wave 3 — the sweep.** Land 006 before 011 and 013; it rewrites ~52 lines and merge conflicts
are the main risk in a single 862 KB file.

7. **006** — transition presets.
8. **007** — reduced-motion tiers.
9. **010** — glider and traveller timing.
10. **011** — press and entrance scales.
11. **013** — sheet content stagger.
12. **008** — accordion collapse.
13. **009** — drag ghost.

**Wave 4 — additive.** Only after the corrective work; 014 and 015 both need 001, and 017
needs 005.

14. **014** — row-level entrance.
15. **016** — sequence crossfade.
16. **015** — workout completion moment.
17. **017** — sheet drag-to-dismiss. Largest and riskiest; do it last and test it on a real
    phone, not in emulation.

---

## Conventions every plan assumes

- **One file.** Everything lives in `index.html` — three `<style>` blocks (base at line 23,
  `#motion-layer` at 6698, `#liquid-layer` at 6914) and three scripts. Later blocks
  deliberately override earlier ones; edit rules where they already live rather than
  consolidating.
- **Curve tokens** are in the single `:root` at `index.html:24-51`:
  `--spring:cubic-bezier(.34,1.4,.5,1)` (overshoots, peak y≈1.053) and
  `--ease:cubic-bezier(.22,.9,.32,1)`. Plan 005 adds `--ease-drawer`; plan 006 adds `--t-fast`,
  `--t-ui`, `--t-slow`.
- **Durations** are written with no leading zero (`.2s`).
- **Script style differs by block.** The app script and `#motion-layer` use `const`/arrow
  functions; `#liquid-layer` is ES5 with `'use strict'`. Match whichever you are editing.
- **The FX switchboard** at `index.html:1055-1065` registers every non-essential effect with a
  kill switch (`fx-no-*` class for CSS, `window.FX.<key>` for JS). Any new effect gets an entry;
  no existing effect gets deleted — they are deliberate, and the switchboard is how the user
  turns them off.
- **`mQuiet(fn)`** at `index.html:1048` suppresses entrance replays for a render. Plan 001 is
  mostly about using it.

---

## What was deliberately not planned

From the opportunity sweep, three candidates were rejected rather than turned into plans:

- **Directional tab-switch motion.** Core navigation, used tens of times a day — the tier where
  the correct answer is less motion, not more. It also already animates (`m-tabin`, 320ms), so
  adding direction is a change to existing motion, not a missing opportunity.
- **A wipe on the shopping strike-through.** The checkbox already pops (`m-chk` at
  `index.html:6730`). A second animation on the same event is decoration.
- **Streak-tier celebration.** Genuinely the right frequency tier for delight, but detecting
  "just crossed a tier" needs new persisted state, which is a data-model change, not a motion
  change. Noted in plan 015's boundaries.

Also left alone by design: the dial slosh, the water fill, and the day-border traveller. All
three are registered signature effects with kill switches. The plans reduce what they cost, not
whether they exist.

# 008 — Replace the `max-height: 2000px` accordion hack

- **Status**: TODO
- **Commit**: 8f786bf
- **Severity**: MEDIUM
- **Category**: Performance / Easing & duration
- **Estimated scope**: 1 file (`index.html`), 2 CSS edits

## Problem

The warmup / stretch accordions on the training day sheet collapse with the classic
`max-height` hack:

```css
/* index.html:375-376 — current */
  .bookend-body{max-height:0;overflow:hidden;transition:max-height .4s var(--ease);}
  .bookend-body.open{max-height:2000px;}
```

Two problems, and the second is the one users feel:

1. `max-height` is a layout property. Animating it forces layout + paint on every frame for
   the accordion and everything below it in the sheet.
2. **The travel is mostly imaginary.** A warmup list is ~200px tall, but the transition
   interpolates across 2000px. Opening, the real content finishes appearing in the first ~10%
   of the 400ms and the remaining 360ms animates empty space — so it looks instant. Closing is
   worse: 90% of the duration is spent shrinking from 2000px down to ~200px, during which
   **nothing visibly moves**, and then the panel snaps shut in the last ~40ms. The collapse
   reads as a lag followed by a glitch.

## Target

`grid-template-rows` interpolation, which animates to the content's real height with no magic
number:

```css
/* target */
  .bookend-body{display:grid;grid-template-rows:0fr;overflow:hidden;transition:grid-template-rows .3s var(--ease);}
  .bookend-body.open{grid-template-rows:1fr;}
  .bookend-body>*{min-height:0;overflow:hidden;}
```

`min-height:0` on the child is required — grid items default to `min-height:auto`, which
refuses to shrink below their content and defeats the whole technique.

300ms rather than 400ms: with the fake travel gone, the animation now uses all of its duration,
so the same number would read as slower than before.

Browser support: `grid-template-rows` interpolation ships in Safari 16+, Chrome 107+, Firefox
120+. This app targets an iPhone home-screen PWA, so Safari 16+ is a safe floor. Older browsers
simply get an instant open/close — an acceptable, non-broken fallback.

## Repo conventions to follow

- `--ease` is `cubic-bezier(.22,.9,.32,1)`, declared at [index.html:37](../index.html).
- These two rules sit in the "ported from Aerte Muscle" section of the base stylesheet,
  starting at [index.html:362](../index.html). Edit them in place.
- The chevron rotation immediately above at [index.html:373-374](../index.html) is correct and
  stays as it is.

## Steps

1. **Check the markup first.** Read [index.html:374-382](../index.html) and find the
   `bookendHTML()` function (`grep -n "function bookendHTML" index.html`). Confirm that
   `.bookend-body` has exactly **one** element child — the `.bookend-list` div at
   [index.html:377](../index.html) — plus possibly a `.bookend-start` button. Record how many
   children it has.

   - If it has **one** child, proceed with `.bookend-body>*{min-height:0;overflow:hidden;}`.
   - If it has **more than one**, the technique still works but all children must be wrapped in
     a single element for the grid row to size correctly. In that case STOP and report — the
     markup change is outside this plan's scope.

2. Replace [index.html:375-376](../index.html):

   ```css
   /* from */
     .bookend-body{max-height:0;overflow:hidden;transition:max-height .4s var(--ease);}
     .bookend-body.open{max-height:2000px;}
   /* to */
     .bookend-body{display:grid;grid-template-rows:0fr;overflow:hidden;transition:grid-template-rows .3s var(--ease);}
     .bookend-body.open{grid-template-rows:1fr;}
     .bookend-body>*{min-height:0;overflow:hidden;}
   ```

3. **Check for a JS height assignment.** Run `grep -n "bookend-body\|bookendBody" index.html`
   and read `bindBookends()` (`grep -n "function bindBookends" index.html`). If any JS sets
   `style.maxHeight` on these elements, it must be removed — the CSS no longer uses that
   property. If you find one, remove **only** the `maxHeight` assignment and leave the rest of
   the handler alone.

4. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT change the chevron rotation rules at [index.html:373-374](../index.html).
- Do NOT change `.bookend`, `.bookend-hdr`, `.bookend-list`, `.bookend-item`, or
  `.bookend-start`.
- Do NOT change the markup produced by `bookendHTML()`.
- Do NOT apply this technique anywhere else in the file in this plan — there is one other
  `max-height` transition (`grep -n "transition:max-height" index.html` shows two rules total);
  the second one is out of scope here.
- Do NOT add a JS height measurement as an alternative. If `grid-template-rows` does not work,
  report it.

## Verification

- **Mechanical**: `grep -c "max-height:2000px" index.html` returns 0. Page loads clean.
- **Feel check**: open a training day sheet (Training tab → tap a day). The warmup and stretch
  accordions are at the top and bottom of the sheet.
  - Tap the warmup header to expand. The panel must grow smoothly to exactly its content
    height, with no overshoot and no clipping of the last row.
  - Tap it again to collapse. **This is the key check** — the panel must start shrinking
    immediately and shrink continuously to zero. Before the fix, it sits still for ~350ms and
    then snaps.
  - Expand it, then tap to collapse and immediately tap again to re-expand mid-animation. It
    must retarget smoothly from wherever it is, not jump.
  - Expand a warmup with a different number of items (or add a stretch) and confirm the timing
    feels the same regardless of content length.
  - In DevTools → Performance, record an expand. Confirm the frames are clean; some layout cost
    is unavoidable for a size animation, but it should no longer be interpolating 2000px.
  - Toggle reduced motion on and confirm the panel opens instantly with no animation.
- **Done when**: collapsing starts moving immediately and the panel's open height matches its
  content exactly.

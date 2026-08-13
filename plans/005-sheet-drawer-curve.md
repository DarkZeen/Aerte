# 005 — Stop the bottom sheet lifting off the bottom edge

- **Status**: DONE (applied at 8f786bf, uncommitted)
- **Commit**: 8f786bf
- **Severity**: HIGH
- **Category**: Physicality & origin
- **Estimated scope**: 1 file (`index.html`), 2 CSS edits

## Problem

The bottom sheet slides in on the overshooting `--spring` curve:

```css
/* index.html:37 — current */
    --spring:cubic-bezier(.34,1.4,.5,1); --ease:cubic-bezier(.22,.9,.32,1);
```
```css
/* index.html:218 — current */
  .sheet{position:fixed;left:0;right:0;bottom:0;z-index:100;max-height:92vh;overflow-y:auto;background:var(--sheet-grad);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border-top:1px solid var(--stroke-2);border-radius:28px 28px 0 0;transform:translateY(102%);transition:transform .45s var(--spring);box-shadow:var(--sh-sheet);}
```
```css
/* index.html:224 — current */
  .sheet.show{transform:translateY(0);}
```

`cubic-bezier(.34,1.4,.5,1)` has a control-point `y` of 1.4, so its output peaks at
**y ≈ 1.053** around t ≈ 0.65. The sheet animates `translateY` from `102%` to `0`, so at that
peak the transform is roughly `translateY(-5.4%)` — the sheet travels *past* its resting
position and lifts about 5% of its own height off the bottom of the viewport.

The sheet is `position:fixed; bottom:0` with `border-radius:28px 28px 0 0` — a surface that is
supposed to be welded to the bottom edge of the screen. For roughly 150ms on every open, the
scrim shows through underneath it. On a tall sheet (`max-height:92vh`, so ~700px on an iPhone)
that gap is ~38px.

A bottom sheet cannot detach from the bottom of the screen. Nothing in the physical world it
imitates does that.

The same `--spring` is used correctly elsewhere (press feedback, the segmented glider, chips) —
this plan changes the sheet only.

## Target

An iOS-style drawer curve — fast out of the gate, long settle, no overshoot:

```css
/* target — add to :root alongside the existing curve tokens */
    --ease-drawer:cubic-bezier(0.32, 0.72, 0, 1);
```
```css
/* target — .sheet transition */
  transition:transform .4s var(--ease-drawer);
```

400ms sits inside the 200–500ms budget for drawers. The curve is monotonic, so `translateY`
never goes negative and the sheet stays welded to the bottom edge for the whole animation.

The scrim keeps its own timing — it is a cross-fade, not a movement, and 300ms is right for it.

## Repo conventions to follow

- Curve tokens live on one line in `:root` at [index.html:37](../index.html), semicolon-
  separated, no space after the colon:
  `--spring:cubic-bezier(.34,1.4,.5,1); --ease:cubic-bezier(.22,.9,.32,1);`
  Add the new token to that same line, in the same style.
- Durations in this file are written without a leading zero (`.4s`, not `0.4s`). Match that.
- Do not create a second `:root` block; there is exactly one, at
  [index.html:24-51](../index.html).

## Steps

1. **Add the token.** Replace [index.html:37](../index.html):

   ```css
   /* from */
       --spring:cubic-bezier(.34,1.4,.5,1); --ease:cubic-bezier(.22,.9,.32,1);
   /* to */
       --spring:cubic-bezier(.34,1.4,.5,1); --ease:cubic-bezier(.22,.9,.32,1);
       --ease-drawer:cubic-bezier(0.32,0.72,0,1);
   ```

2. **Retime the sheet.** In [index.html:218](../index.html), change **only** the transition
   declaration inside that rule:

   ```css
   /* from */
   transition:transform .45s var(--spring);
   /* to */
   transition:transform .4s var(--ease-drawer);
   ```

   Leave every other property in the `.sheet` rule byte-for-byte identical.

3. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT change `--spring` itself. It is used by ~20 other rules
  (`grep -c "var(--spring)" index.html`) where the overshoot is correct — press feedback, the
  segmented glider, the water cells, chips.
- Do NOT change `.scrim` ([index.html:216](../index.html)) — its `transition:.3s` fade is a
  separate concern handled in plan 006.
- Do NOT change `.sheet.show` ([index.html:224](../index.html)), the `translateY(102%)` rest
  position, `max-height`, or the border radius.
- Do NOT touch `.sheet-inner` or its staggered children — that is plan 013.
- Do NOT add drag-to-dismiss here — that is plan 017, which depends on this plan landing first.

## Verification

- **Mechanical**: `grep -c "ease-drawer" index.html` returns 2. Page loads with no console
  errors.
- **Feel check**: serve the file and open any sheet (tap a day chip, or the `+` FAB).
  - Open DevTools → Animations panel, set playback speed to **10%**, then open a sheet. Watch
    the bottom edge of the sheet against the bottom of the viewport. It must stay in contact
    the entire time. Before the fix you can clearly see the sheet lift away and drop back.
  - Alternative check without the Animations panel: temporarily set the transition duration to
    `4s` in DevTools, open a sheet, and watch the bottom edge. Revert the override afterwards.
  - Open and close a sheet several times in a row. Closing must still slide straight down and
    off; the exit is unchanged.
  - The sheet must not feel slower. 400ms with this curve covers most of its distance in the
    first 150ms — if it reads as sluggish, report rather than trimming the duration, because
    the perceived speed comes from the curve, not the number.
- **Done when**: at 10% playback the sheet's bottom edge never separates from the viewport
  bottom, and every other spring-driven animation in the app is untouched.

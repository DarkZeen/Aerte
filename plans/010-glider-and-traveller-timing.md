# 010 — Retime the segmented glider and the day-strip traveller

- **Status**: DONE (applied at 8f786bf, uncommitted)
- **Commit**: 8f786bf
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file (`index.html`), 2 CSS edits

## Problem

**The segmented control is slow for how often it is used.** Week / Training / Food / Shopping
is the app's primary navigation — used tens of times a day:

```css
/* index.html:91 — current */
  .seg .glider{position:absolute;top:4px;left:4px;height:calc(100% - 8px);border-radius:10px;z-index:1;background:var(--seg-glider);box-shadow:var(--seg-glider-sh);transition:transform .45s var(--spring),width .45s var(--spring);}
```

450ms on an overshooting curve, for a control the user hits constantly. iOS's own segmented
control settles in roughly 250ms. It also animates `width` — a layout property — because the
glider is resized to each button in JS:

```js
/* index.html:6607 — current */
function moveGlider(b){glider.style.width=b.offsetWidth+'px';glider.style.transform=`translateX(${b.offsetLeft-4}px)`;}
```

**The day-strip traveller morphs before it arrives.** The red outline that slides between day
chips runs its size and its position on two different clocks:

```css
/* index.html:6948-6950 — current */
  .dsel{position:absolute;left:0;top:0;pointer-events:none;z-index:0;border-radius:16px;
    border:1px solid var(--red);box-shadow:0 8px 22px rgba(255,69,58,0.25);
    transition:transform .38s var(--spring),width .24s var(--ease),height .24s var(--ease);}
```

The outline finishes resizing 140ms before it finishes moving, so on a strip where chips differ
in width it visibly changes shape in mid-flight and then coasts. A single object should move
and resize on one clock.

## Target

```css
/* target — index.html:91 */
transition:transform .25s var(--ease),width .25s var(--ease);
```

250ms sits at the top of the 150–250ms dropdown/selector budget. `--ease`
(`cubic-bezier(.22,.9,.32,1)`) rather than `--spring`: a segmented glider is a moving object
that must land exactly on its label, and an overshoot on a control this frequent reads as
imprecision.

```css
/* target — index.html:6950 */
    transition:transform .3s var(--ease),width .3s var(--ease),height .3s var(--ease);
```

One duration, one curve, all three properties. 300ms rather than 380ms because the overshoot is
gone — with `--spring` removed, the same number would read as slower.

`width`/`height` stay as animated properties in both cases. Converting to `scaleX`/`scaleY`
would distort the 1px border and the 16px corner radius on both elements, which is a worse
outcome than the layout cost of animating two small absolutely-positioned overlays.

## Repo conventions to follow

- `--ease:cubic-bezier(.22,.9,.32,1)` and `--spring:cubic-bezier(.34,1.4,.5,1)` are declared at
  [index.html:37](../index.html).
- Durations use no leading zero (`.25s`).
- `.seg .glider` lives in the base stylesheet; `.dsel` lives in `<style id="liquid-layer">`
  ([index.html:6914](../index.html)). Edit each where it is.
- The traveller's `first`-render suppression at [index.html:7069-7071](../index.html) sets
  `transition:'none'` inline for the very first placement so it does not fly in from the corner.
  That logic is correct and must keep working.

## Steps

1. **Segmented glider.** In [index.html:91](../index.html), replace only the transition
   declaration:

   ```css
   /* from */
   transition:transform .45s var(--spring),width .45s var(--spring);
   /* to */
   transition:transform .25s var(--ease),width .25s var(--ease);
   ```

2. **Day-strip traveller.** In [index.html:6950](../index.html), replace the whole line:

   ```css
   /* from */
       transition:transform .38s var(--spring),width .24s var(--ease),height .24s var(--ease);}
   /* to */
       transition:transform .3s var(--ease),width .3s var(--ease),height .3s var(--ease);}
   ```

3. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT change `moveGlider()` at [index.html:6607](../index.html) or the boot call at
  [index.html:6688](../index.html).
- Do NOT change the traveller's JS — `moveTo()`, `place()`, `mount()`, the `first` flag, the
  `pointerdown` handler at [index.html:7080-7089](../index.html), or the ResizeObserver at
  [index.html:7095-7098](../index.html).
- Do NOT convert either element to `scaleX`/`scaleY`.
- Do NOT change `--spring` or `--ease`.
- Do NOT touch the `m-tabin` tab crossfade at [index.html:6712](../index.html) — the tab
  content animation is a separate concern and is deliberately left alone.
- Do NOT change `.dsel`'s border, shadow, or radius.

## Verification

- **Mechanical**: `grep -c "\.45s var(--spring)" index.html` drops by 1. Page loads clean.
- **Feel check**:
  - Tap through all four segmented tabs in quick succession. The glider must keep up with you
    and land precisely on each label with no wobble past its edge. Before the fix it lags and
    overshoots.
  - Tap two tabs in rapid succession (Week → Shopping → Week). The glider must retarget
    smoothly mid-flight — it uses a transition, so it will; confirm it does not stutter.
  - Week tab → tap day chips left to right along the strip. The red outline must move and
    resize as one object. Watch a transition between two chips of different widths
    (the strip is `repeat(7,1fr)` so widths are equal — to test properly, open DevTools and
    temporarily change one chip's padding, or check on a narrow viewport where the last chip
    may differ). The outline must not finish resizing early.
  - Open DevTools → Animations, set playback to 10%, and tap a day chip. Confirm the width,
    height and transform tracks all start and end together.
  - Confirm the very first render still places the outline instantly, with no flight in from
    the top-left corner — reload the page on the Week tab and watch.
- **Done when**: tab switching feels immediate rather than springy, and the day outline's size
  and position animate on one clock.

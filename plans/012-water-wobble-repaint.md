# 012 — Stop the water wobble repainting sixteen layers forever

- **Status**: TODO
- **Commit**: 8f786bf
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file (`index.html`), 2 CSS edits

## Problem

Each filled water cell runs two infinite keyframe animations, one per pseudo-element:

```css
/* index.html:6928-6935 — current */
  .wcell.aq-fill{--aq-y:18%;}
  .wcell.aq-fill::before{animation:aq-wob 4.2s ease-in-out infinite;}
  .wcell.aq-fill::after{animation:aq-wob 3.4s ease-in-out .3s infinite reverse;}
  .wcell.aq-fill svg{color:#f4fbff;}
  @keyframes aq-wob{
    0%,100%{border-radius:46% 46% 6px 6px/13px 13px 6px 6px;transform:translateY(18%);}
    50%{border-radius:34% 58% 6px 6px/10px 17px 6px 6px;transform:translateY(15%);}}
```

`WATER_TARGET` is 8 ([index.html:1007](../index.html)), so a user who has hit their water goal
has **16 infinite animations** running whenever the day card is on screen.

The problem is not the count, it is `border-radius`. Transform and opacity are composited on
the GPU; `border-radius` is not. Interpolating it forces a repaint of the element on every
frame, forever, for sixteen elements — on a phone, in a PWA the user leaves open.

The wobble's *visible* effect is dominated by the 3% `translateY` swing and the asymmetric
radius. The radius change is doing real visual work, so this is not a case for deleting the
effect — `waterfill` is a registered signature effect
([index.html:1056](../index.html)). It needs to be paid for differently.

## Target

Keep the wobble; move it entirely onto composited properties. A skew plus a translate produces
the same lopsided-surface read as the radius morph, at zero repaint cost:

```css
/* target */
  .wcell.aq-fill{--aq-y:18%;}
  .wcell.aq-fill::before{animation:aq-wob 4.2s ease-in-out infinite;}
  .wcell.aq-fill::after{animation:aq-wob 3.4s ease-in-out .3s infinite reverse;}
  .wcell.aq-fill svg{color:#f4fbff;}
  @keyframes aq-wob{
    0%,100%{transform:translateY(18%) rotate(-1.1deg) scaleX(1.04);}
    50%{transform:translateY(15%) rotate(1.1deg) scaleX(1.04);}}
```

The static `border-radius` values stay where they already are, on the pseudo-elements
themselves ([index.html:6924-6927](../index.html)) — they are set once and never animated:

```css
/* index.html:6924-6927 — current, unchanged by this plan */
  .wcell::before{background:rgba(90,200,250,.34);
    border-radius:52% 42% 6px 6px/15px 12px 6px 6px;transition-delay:.05s;}
  .wcell::after{background:linear-gradient(180deg,rgba(125,211,252,.62),rgba(10,132,255,.88));
    border-radius:44% 48% 6px 6px/13px 14px 6px 6px;}
```

The `scaleX(1.04)` prevents the rotation from exposing the cell's corners — the pseudo-elements
are already inset `left:-14%;right:-14%` ([index.html:6921](../index.html)) and the cell has
`overflow:hidden` ([index.html:6918](../index.html)), so a 1.1° tilt stays clipped.

**Whether 1.1° reads as convincingly as the radius morph cannot be judged from the code.**
The feel check below is the deciding test; if it looks wrong, report rather than escalating the
angle past 2°, which would start to look like the water is sloshing rather than settling.

## Repo conventions to follow

- This block is `<style id="liquid-layer">`, [index.html:6914](../index.html). It is written to
  be self-contained and carries a comment saying so at
  [index.html:6916-6917](../index.html) — keep it that way.
- The fill position is driven by the `--aq-y` custom property with a
  `transition:transform .62s var(--spring)` on the pseudo-elements
  ([index.html:6922-6923](../index.html)). The keyframe animation overrides `transform` while
  it runs; that interaction is existing behaviour and this plan does not change it.
- The kill switch `.fx-no-waterfill` at [index.html:6938](../index.html) disables both the
  transition and the animation. It keeps working unchanged.

## Steps

1. Replace [index.html:6933-6935](../index.html) (the `aq-wob` keyframe) with the target
   keyframe above. Leave lines 6928-6932 exactly as they are.

2. **Add a compositing hint.** In [index.html:6920-6923](../index.html), append
   `will-change:transform;` to the shared `.wcell::before,.wcell::after` rule, immediately
   after the existing `transition:transform .62s var(--spring);`.

   Do not add `will-change` anywhere else — it costs memory per layer and 16 small layers is
   already the upper bound of what is reasonable.

3. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT delete the wobble, the second wave layer, or the `waterfill` kill switch.
- Do NOT change the static `border-radius` values at
  [index.html:6924-6927](../index.html) — those are what give the water its shaped surface and
  they cost nothing.
- Do NOT change `--aq-y`, the `.aq-now` no-transition class
  ([index.html:6931](../index.html)), or the JS that stages the fill
  ([index.html:6992-7029](../index.html)).
- Do NOT change the animation durations (4.2s / 3.4s), the `.3s` delay, or the `reverse`
  direction — the two layers are deliberately out of phase.
- Do NOT change `WATER_TARGET`.
- Do NOT touch the reduced-motion block at [index.html:6978-6981](../index.html).

## Verification

- **Mechanical**: `grep -c "border-radius:46%" index.html` returns 0. Page loads clean.
- **Feel check**: Week tab, day card. Tap water cells until several are filled.
  - The filled cells must still show a gently moving, lopsided liquid surface. Compare against
    the previous behaviour (stash the change, look, restore) — if the new wobble reads as flat
    or as a hard tilt rather than a settling surface, **report it** instead of adjusting the
    angle yourself.
  - In DevTools → Rendering, enable **"Paint flashing"**. With water cells filled and the day
    card on screen: before this change the cells flash green continuously; after, they must not
    flash at all. This is the definitive check.
  - In DevTools → Performance, record 5 seconds with 8 cells filled. Paint time should drop to
    near zero for these elements.
  - Tap a fresh cell. The staged rise (`aq-fill` with the 70ms per-cell delay,
    [index.html:7009](../index.html)) must still play, and the cell must settle into the wobble.
  - Dev Studio → UX switchboard → turn off `waterfill`. The cells must fill instantly with no
    wobble.
  - Turn on reduced motion. No wobble, no fill animation.
- **Done when**: paint flashing shows no repaints from the water cells, and the wobble still
  reads as liquid.

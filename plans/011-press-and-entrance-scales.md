# 011 — Bring the press and entrance scales into range

- **Status**: DONE (applied at 8f786bf, uncommitted)
- **Commit**: 8f786bf
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 file (`index.html`), 3 CSS edits

## Problem

**The water cell collapses when pressed.** Press feedback should sit between `0.95` and `0.98`
— enough to confirm the tap, not enough to look like the element is being crushed:

```css
/* index.html:196 — current */
  .wcell:active{transform:scale(.88);}
```

`.88` is a 12% collapse on a 38×46px target that users tap up to eight times a day. Every other
press in the app is in range — `.978` at [index.html:6722](../index.html), `.97` at
[index.html:201](../index.html), `.985` at [index.html:172](../index.html) — so this one also
breaks cohesion.

**The FAB entrance appears from nothing.** Nothing in the physical world scales up from a
speck, and `scale(.4)` is close enough to `scale(0)` to read that way:

```css
/* index.html:6702 — current */
  @keyframes m-pop{0%{transform:scale(.4) rotate(-45deg);opacity:0;}60%{transform:scale(1.08) rotate(4deg);opacity:1;}100%{transform:none;opacity:1;}}
```

The 45° counter-rotation compounds it — the button tumbles into place. This runs once per app
load ([index.html:6909](../index.html)), on the primary action button.

**The FAB press is heavy too.** [index.html:357](../index.html) ends with
`.addbtn:active{transform:scale(.9);}` — a 10% collapse on the app's most-pressed control.

## Target

```css
/* target — index.html:196 */
  .wcell:active{transform:scale(.96);}
```
```css
/* target — index.html:6702 */
  @keyframes m-pop{0%{transform:scale(.92) rotate(-8deg);opacity:0;}60%{transform:scale(1.04) rotate(2deg);opacity:1;}100%{transform:none;opacity:1;}}
```
```css
/* target — the :active half of index.html:357 */
  .addbtn:active{transform:scale(.95);}
```

The FAB keeps its playful pop — a 4% overshoot and a small counter-rotation still read as a
pop — but it now grows from something rather than from nothing.

## Repo conventions to follow

- Press-feedback exemplar: [index.html:6722](../index.html) —
  `.rcard:active,.lib-card:active,.dchip:active,.shop-item:active,.fridge-item:active{transform:scale(.978);}`
- The `.wcell` transition already exists and is correct
  ([index.html:192](../index.html), `transition:transform .25s var(--spring),…`) — do not
  change it.
- `m-pop` is defined in `<style id="motion-layer">` at [index.html:6698](../index.html) and
  applied from JS at [index.html:6909](../index.html). Change the keyframe only.

## Steps

1. **Water cell press.** Replace [index.html:196](../index.html):

   ```css
   /* from */
     .wcell:active{transform:scale(.88);}
   /* to */
     .wcell:active{transform:scale(.96);}
   ```

2. **FAB entrance.** Replace [index.html:6702](../index.html) with the target keyframe above.

3. **FAB press.** In [index.html:357](../index.html), change `.addbtn:active{transform:scale(.9);}`
   to `.addbtn:active{transform:scale(.95);}`.

   If plan 002 has already landed, line 357 will have been split across two lines and the
   `:active` rule will be on its own line — change it there.

4. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT change the `flipIn` keyframe at [index.html:198](../index.html). Its
  `rotateX(90deg) scale(.8)` is a card-flip, a different gesture from a scale entrance, and it
  only fires on the cell you just tapped.
- Do NOT change the `m-chk` checkbox pop at [index.html:6729](../index.html) — `scale(.7)` to
  `1.14` is a checkmark drawing itself, not an object appearing, and it is inside a 24px box.
- Do NOT change the `m-ripple` `transform:scale(0)` at [index.html:6750](../index.html) — a
  ripple is a spreading wavefront and correctly starts at zero radius.
- Do NOT change the other `:active` scales in the file — `.94`, `.92`, `.9` on small dev-mode
  buttons ([index.html:577](../index.html), [511](../index.html), [589](../index.html),
  [623](../index.html)) are on 26px targets where a larger proportional squeeze is legible and
  the surfaces are rare. Leave them.
- Do NOT change the `m-pop` duration or delay at [index.html:6909](../index.html).

## Verification

- **Mechanical**: `grep -c "scale(\.88)" index.html` returns 0. `grep -c "scale(\.4) rotate"
  index.html` returns 0. Page loads clean.
- **Feel check**:
  - Week tab → press and hold a water cell. The squeeze must be noticeable but must not look
    like the cell is being crushed. Compare it side by side with pressing a shopping row —
    they should now feel like the same interface.
  - Release. The water fill and the `flipIn` card-flip must still play exactly as before.
  - Reload the page and watch the `+` button in the bottom-right. It must pop in from slightly
    small and slightly rotated, not tumble in from a speck. Reload a few times — the moment is
    brief, so watch it more than once, or open DevTools → Animations and slow playback to 25%.
  - Press the `+` button. The squeeze should feel like a button press, not a collapse.
  - Turn off the FAB entrance in Dev Studio → UX switchboard (`fabpop`) and confirm the button
    still appears correctly with no animation.
- **Done when**: every press in the app squeezes by a comparable proportion, and the FAB grows
  in from something rather than from nothing.

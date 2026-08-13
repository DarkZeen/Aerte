# 006 — Replace 49 `transition: all` shorthands with transition presets

- **Status**: TODO
- **Commit**: 8f786bf
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens / Performance
- **Estimated scope**: 1 file (`index.html`), ~52 mechanical edits

## Problem

49 rules declare a bare duration:

```css
/* index.html:640 — current */
  .trow{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--stroke);border-radius:var(--r-md);padding:13px 14px;margin-top:10px;cursor:pointer;transition:.2s;backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);}
```
```css
/* index.html:280 — current */
  .shop-item{display:flex;gap:12px;align-items:center;background:var(--card-2);border:1px solid var(--stroke);border-radius:var(--r-md);padding:12px 14px;margin-top:9px;transition:.2s;}
```

`transition:.2s` is shorthand for `transition: all .2s ease`. Two consequences:

1. **It animates everything**, including properties that were never meant to animate and that
   are expensive off the GPU. `.trow` is a **drag target** ([index.html:4052](../index.html))
   carrying `transition: all .2s` — every property the drag code touches is transitionable.
2. **It uses the browser's built-in `ease`**, which is far too weak for deliberate UI motion.
   The repo already owns a much better curve at [index.html:37](../index.html) —
   `--ease:cubic-bezier(.22,.9,.32,1)` — and 49 rules ignore it.

There is a related duplication in JS:

```js
/* index.html:4089-4091 — current */
        const nb=document.querySelector(`.trow[data-tkey="${b}"]`);
        if(nb&&nb.animate)nb.animate([{transform:'scale(1.04)'},{transform:'scale(1)'}],
          {duration:380,easing:'cubic-bezier(.34,1.4,.5,1)'});
```

That is `--spring` hand-typed, so a future change to the token silently misses this one call.

## Target

Three transition presets, declared as custom properties in `:root`, holding complete
property lists. CSS custom properties can carry a full `transition` value, so call sites stay
one token long:

```css
/* target — added to :root */
    --t-fast:background-color .15s var(--ease),border-color .15s var(--ease),color .15s var(--ease),opacity .15s var(--ease),box-shadow .15s var(--ease),transform .15s var(--spring);
    --t-ui:background-color .2s var(--ease),border-color .2s var(--ease),color .2s var(--ease),opacity .2s var(--ease),box-shadow .2s var(--ease),transform .2s var(--spring);
    --t-slow:background-color .3s var(--ease),border-color .3s var(--ease),color .3s var(--ease),opacity .3s var(--ease),box-shadow .3s var(--ease),transform .3s var(--spring);
```

The property list is deliberately a superset of what these rules animate today, so behaviour is
preserved everywhere — but `background` (the shorthand, which includes `background-image` and
therefore gradients) is **excluded**, and layout properties are excluded. `background-color` is
in; gradient interpolation is not.

Call sites become:

```css
/* target */
  .trow{ … transition:var(--t-ui); … }
```

## Repo conventions to follow

- Tokens live in the single `:root` block, [index.html:24-51](../index.html). Add the three
  presets on their own lines after the curve tokens at
  [index.html:37](../index.html). Do not create a second `:root`.
- Durations are written without a leading zero (`.2s`). Match that.
- The light theme block at [index.html:53-71](../index.html) overrides colour tokens only —
  do **not** add the presets there.
- Exemplar of a correctly enumerated transition already in the file:
  [index.html:6725](../index.html) —
  `.rec-act,.filt button,.weeknav button,.profbtn{transition:transform .18s var(--spring),border-color .2s,color .2s,background .2s;}`

## Steps

1. **Add the presets.** After [index.html:37](../index.html), insert the three declarations
   from the Target section verbatim. If plan 005 has already landed, `--ease-drawer` will be on
   the line below; insert after it.

2. **Swap the general cases.** Perform these exact string replacements across the whole file:

   | Find | Replace with |
   | --- | --- |
   | `transition:.15s` | `transition:var(--t-fast)` |
   | `transition:.18s` | `transition:var(--t-fast)` |
   | `transition:.2s` | `transition:var(--t-ui)` |
   | `transition:.22s` | `transition:var(--t-ui)` |
   | `transition:.25s` | `transition:var(--t-ui)` |

   Do these as literal string replacements. Before each one, run
   `grep -c "transition:\.2s" index.html` (etc.) and record the count; after, confirm the
   corresponding `var(--t-*)` count matches. Expected counts at commit 8f786bf:
   `.15s` → 11, `.18s` → 2, `.2s` → 34, `.22s` → 2, `.25s` → 1.

   **Do not** touch `transition:.3s` in this bulk pass — it has only three occurrences and two
   of them are special cases handled in step 3.

3. **Handle the three `.3s` sites individually.** `grep -n "transition:\.3s" index.html`
   returns exactly these three lines — 167, 216, 306.

   a. `.mealgroup` at [index.html:167](../index.html) reads `transition:.3s var(--ease)`.
      Change it to `transition:var(--t-slow)`.

   b. `.scrim` at [index.html:216](../index.html) fades only. Change `transition:.3s` to
      `transition:opacity .3s var(--ease)`.

   c. `#toast` at [index.html:306](../index.html) reads `transition:.3s var(--spring)`.
      Change that to `transition:opacity .3s var(--ease),transform .3s var(--spring)`.
      The toast animates opacity and a `translateY` — nothing else.

   Then confirm `grep -c "transition:\.3s" index.html` returns 0.

4. **Give `.fridge-item` a transition.** It has a press-feedback rule
   (`.fridge-item:active{transform:scale(.978)}` at [index.html:6722](../index.html)) but no
   transition, so the press snaps. In [index.html:314](../index.html), add
   `transition:var(--t-ui);` to the `.fridge-item` rule, immediately before the
   `backdrop-filter` declaration.

5. **Use the token in JS.** Replace [index.html:4090-4091](../index.html):

   ```js
   /* from */
           if(nb&&nb.animate)nb.animate([{transform:'scale(1.04)'},{transform:'scale(1)'}],
             {duration:380,easing:'cubic-bezier(.34,1.4,.5,1)'});
   /* to */
           if(nb&&nb.animate)nb.animate([{transform:'scale(1.04)'},{transform:'scale(1)'}],
             {duration:380,easing:getComputedStyle(document.documentElement).getPropertyValue('--spring').trim()||'cubic-bezier(.34,1.4,.5,1)'});
   ```

   The `||` fallback keeps the animation working if the property ever fails to resolve.

6. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT touch any rule that already enumerates its properties — anything matching
  `transition:transform`, `transition:opacity`, `transition:max-height`, `transition:width`,
  `transition:fill`, `transition:color`, `transition:padding`, `transition:background`,
  `transition:border-color`, `transition:stroke-dashoffset`, `transition:font-size`,
  `transition:outline-color`, or `transition:y`. There are ~25 of these and they are all
  deliberate.
- Do NOT touch `transition:none` (4 occurrences) or `transition:none!important` (3).
- Do NOT change `--ease` or `--spring` themselves.
- Do NOT change any duration value while swapping — `.22s` and `.25s` map onto the 200ms preset
  intentionally; do not try to preserve them exactly.
- Do NOT add layout properties (`width`, `height`, `padding`, `margin`, `top`, `left`,
  `max-height`) to any preset.
- Do NOT include the `background` shorthand in the presets — several of these elements have
  gradient backgrounds and transitioning the shorthand would try to interpolate them.
- If a replacement count does not match the expected number above, STOP and report.

## Verification

- **Mechanical**:
  - `grep -c "transition:\.\(15\|18\|2\|22\|25\|3\)s" index.html` returns **0**.
  - `grep -c "var(--t-ui)" index.html` returns **38** (34 + 2 + 1 from step 2, plus 1 from
    step 4).
  - `grep -c "var(--t-fast)" index.html` returns **13**.
  - `grep -c "var(--t-slow)" index.html` returns **2** (the `:root` declaration and
    `.mealgroup`).
  - The page loads with no console errors and nothing is unstyled.
- **Feel check**: this plan touches nearly every interactive surface, so sweep broadly.
  - Hover a recipe card, a shopping row, a filter chip, a form input (focus it), a training
    row. Each must still transition its border/background exactly as before — no snapping, no
    new sluggishness.
  - Press and hold a shopping row and a training row. The `scale(.978)` / `scale(.99)` press
    must still ease in, not snap. This is the check that proves `transform` survived in the
    presets.
  - Press a fridge item — it should now ease where it previously snapped.
  - Open a sheet and check the scrim still fades rather than appearing instantly.
  - Trigger a toast (tick a shopping checkbox on a cleared list, or use any action that calls
    `toast()`). It must still rise and fade in.
  - Training tab → drag a row onto another. The drop bump must still play at the same speed.
  - Watch for any element whose **gradient** background now animates oddly (the FAB, the
    `.cta.green`/`.cta.red` buttons, `.dchip.mum`). If a gradient visibly interpolates, the
    `background` shorthand leaked into a preset — fix the preset, do not special-case the rule.
- **Done when**: no bare `transition:<time>` remains, and no interaction in the app feels
  different from before except the fridge-item press, which now eases.

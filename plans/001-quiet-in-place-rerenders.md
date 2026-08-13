# 001 — Stop replaying entrance animations on in-place re-renders

- **Status**: DONE (applied at 8f786bf, uncommitted)
- **Commit**: 8f786bf
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 1 file (`index.html`), ~6 small edits

## Problem

Entrance staggers are driven by `MutationObserver(childList)` on ten host containers. Any
`innerHTML =` re-render of a host therefore replays the full staggered entrance, including
re-renders caused by a tiny in-place state toggle that changed one row.

```js
/* index.html:6800-6804 — current */
  GROUPS.forEach(([id,sel,step])=>{
    const host=document.getElementById(id); if(!host) return;
    stagger(host,sel,step);
    new MutationObserver(()=>stagger(host,sel,step)).observe(host,{childList:true});
  });
```

The worst path is the shopping checkbox. Ticking one item re-renders **two** staggered hosts:

```js
/* index.html:3042 — current (inside the [data-toggle] click handler) */
    renderShop();renderFridge&&renderFridge();
```

Result: every shopping-list tick makes the entire list and the entire fridge list fade up
from `translateY(10px)` again (`.m-in`, `m-rise .42s`, 18ms and 22ms steps), plus a 600ms
count-up on the total ([index.html:6855](../index.html)). A user ticking twenty items during
a shop sees twenty full-list replays.

The escape hatch already exists and is used exactly once in the whole file:

```js
/* index.html:1048 — current */
function mQuiet(fn){ return (window.__motion&&window.__motion.quiet)?window.__motion.quiet(fn):fn(); }
```

```js
/* index.html:2414 — the only call site today */
    mQuiet(()=>renderSumCard());
```

`window.__motion.quiet` ([index.html:6768-6775](../index.html)) sets a `QUIET` flag, runs the
function, and releases the flag after a double-`requestAnimationFrame` — late enough to cover
the MutationObserver microtasks, early enough not to swallow the next real navigation. The
mechanism is correct; it is simply not wired up.

## Target

Entrance animations fire for **navigation** (switching tabs, switching days, opening a tab for
the first time) and never for **in-place state changes** (ticking a checkbox, deleting a row,
marking a day done, dropping a dragged row).

Every re-render triggered from inside an existing view's own event handler is wrapped:

```js
/* target */
    mQuiet(()=>{ renderShop(); renderFridge&&renderFridge(); });
```

No CSS changes. No changes to `stagger()`, `__motion.quiet`, or the observer wiring.

## Repo conventions to follow

- The helper is `mQuiet(fn)` at [index.html:1048](../index.html) — a plain global function, no
  import needed. Always call `mQuiet`, never `window.__motion.quiet` directly (the wrapper
  guards against the motion layer not having loaded yet).
- Exemplar to imitate — [index.html:2414](../index.html), inside the water-cell click handler,
  which already does this correctly and carries the explanatory comment at
  [index.html:2398-2400](../index.html).
- Style: this file uses no spaces around `=>` bodies and packs statements onto one line.
  Match the surrounding density; do not reformat neighbouring lines.

## Steps

1. **Shopping list — generated-line tick.** In `renderShop()`, find the `[data-toggle]` click
   handler. Replace line 3042 exactly:

   ```js
   /* from */
       renderShop();renderFridge&&renderFridge();
   /* to */
       mQuiet(()=>{renderShop();renderFridge&&renderFridge();});
   ```

   Note: this exact string appears **twice** in `renderShop()` (lines 3042 and 3056). Change
   both — do them one at a time by locating each enclosing handler, or use a replace-all for
   this exact string **only if** you have first confirmed it occurs exactly twice in the file.

2. **Shopping list — custom-item tick.** The second occurrence, at line 3056, is inside the
   `[data-customtoggle]` handler. Apply the identical change.

3. **Shopping list — custom-item removal.** Line 3058:

   ```js
   /* from */
     box.querySelectorAll('[data-customrm]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();SHOP_CUSTOM=SHOP_CUSTOM.filter(x=>x.id!==b.dataset.customrm);saveShopCustom();renderShop();});
   /* to */
     box.querySelectorAll('[data-customrm]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();SHOP_CUSTOM=SHOP_CUSTOM.filter(x=>x.id!==b.dataset.customrm);saveShopCustom();mQuiet(()=>renderShop());});
   ```

4. **Training row drag-drop.** In `attachRowDrag()`, line 4088:

   ```js
   /* from */
           renderTrainWeek();renderDaystrip();renderDayDetail();
   /* to */
           mQuiet(()=>{renderTrainWeek();renderDaystrip();renderDayDetail();});
   ```

   The dropped row gets its own WAAPI confirmation bump on the very next lines (4089-4091);
   that bump is the feedback, and it currently competes with a full-list replay.

5. **Day-complete toggle.** In `openDay()`, line 4137-4139:

   ```js
   /* from */
     document.getElementById('tglDone').onclick=()=>{
       WDONE[key]=!WDONE[key];saveWDone();openDay(key);renderTrainWeek();renderDaystrip();
     };
   /* to */
     document.getElementById('tglDone').onclick=()=>{
       WDONE[key]=!WDONE[key];saveWDone();mQuiet(()=>{openDay(key);renderTrainWeek();renderDaystrip();});
     };
   ```

6. **Bump the cache version.** In `service-worker.js`, increment `CACHE_VERSION` by one
   (`'v1'` → `'v2'` pattern — read the current value and add one). This repo will not ship a
   change to installed devices without it.

## Boundaries

- Do NOT wrap navigation renders. Specifically leave alone: the `#seg` tab button handlers,
  `showFood()`, `renderAll()`, day-selection renders from the day strip, and the initial boot
  render at [index.html:6688](../index.html). Those are the entrances the animation exists for.
- Do NOT modify `stagger()`, the `GROUPS` array, `__motion.quiet`, or the MutationObserver
  wiring at [index.html:6777-6804](../index.html).
- Do NOT change any CSS, keyframe, duration, or easing in this plan.
- Do NOT add dependencies.
- If a quoted line does not match what you find, STOP and report — do not guess at the
  intended handler.

## Verification

- **Mechanical**: `node --check` does not apply (HTML file). Instead run
  `grep -c "mQuiet(" index.html` and confirm the count went from 2 to 7 (1 definition +
  1 pre-existing call + 5 new calls). Open `index.html` in a browser and confirm the console
  is free of syntax errors.
- **Feel check**: serve the file (`python3 -m http.server 8000`) and open it.
  - Shopping tab → tick a checkbox. The row you tapped changes state; **no other row moves**.
    Before the fix, the whole list slides up 10px and fades.
  - Tick five items rapidly. The list stays completely still apart from the checkboxes.
  - Switch Week → Shopping → Week. The entrance stagger **still plays** on each tab arrival.
    If it stopped, the quiet flag is leaking — check that you did not wrap a navigation path.
  - Training tab → drag one row onto another. The swap confirmation bump plays on the target
    row alone; the list does not re-fade behind it.
  - Open a training day → tap the done toggle. The sheet content updates without the whole
    sheet body re-fading.
- **Done when**: ticking a shopping checkbox produces zero movement outside the tapped row,
  and tab switching still animates.

# 017 — Make the sheet's grab handle real

- **Status**: TODO
- **Commit**: 8f786bf
- **Severity**: MEDIUM (additive)
- **Category**: Missed opportunity — gesture seam
- **Depends on**: plan 005 (must land first)

## Problem

Every sheet in the app is opened with a grab handle drawn at the top:

```js
/* index.html:2451 — current */
function openSheet(html){SHEET_RETURN=null;sInner.innerHTML=`<div class="grabber"></div>`+html;scrim.classList.add('show');sheet.classList.add('show');}
```
```css
/* index.html:229 — current */
  .grabber{width:38px;height:5px;border-radius:3px;background:var(--stroke-2);margin:10px auto 14px;animation:none!important;opacity:1!important;transform:none!important;}
```

That pill is the iOS convention for "drag me down to dismiss". It is the single strongest
affordance in the sheet, and it does nothing — there are **zero** pointer listeners on `#sheet`
(verified: `grep -c "sheet.addEventListener" index.html` returns 0). The only way to close a
sheet is tapping the scrim, which on a `max-height:92vh` sheet means reaching for the small
strip of scrim still visible at the top of the screen.

This is the one place in the app where the interface promises a gesture it does not have.

**Gate record.** Frequency: occasional-to-frequent — sheets close many times a day, but the
drag is an *alternative* to the existing scrim tap, not a new required step. Purpose:
*feedback* and *spatial consistency* — the sheet follows the finger and leaves the same way it
arrived. Speed: the release settle is 400ms, matching the sheet's own entrance from plan 005.
Function: it removes a reach, it does not add a step.

## Target

A direct-manipulation drag on the sheet, with velocity-based dismissal and rubber-banding —
the standard iOS drawer behaviour.

**Engagement rule.** The sheet is `overflow-y:auto` ([index.html:218](../index.html)), so the
drag must never steal a scroll. The gesture engages only when **both** are true at
`pointerdown`:

- `sheet.scrollTop <= 0` (the content is already at the top), and
- the first movement is downward by more than 6px, with `|dy| > |dx|`

If the user is scrolling content, `scrollTop` is above zero and the drag never starts.

**During the drag.** The sheet tracks the finger exactly, with `transition:none`:

```js
sheet.style.transform = 'translateY(' + y + 'px)';
```

Upward drags are rubber-banded rather than hard-stopped — resistance rises with distance, so
the sheet can be pulled up slightly and always wants to come back:

```js
/* y is the raw finger delta; negative means dragging up */
const y = dy >= 0 ? dy : -Math.pow(-dy, 0.7) * 0.6;
```

**On release**, dismiss if *either* condition holds:

```js
const elapsed = performance.now() - t0;
const velocity = Math.abs(dy) / Math.max(1, elapsed);   /* px per ms */
const dismiss = (velocity > 0.11 && dy > 0) || dy > sheet.offsetHeight * 0.35;
```

The velocity threshold is what makes a quick flick work regardless of distance; the distance
threshold catches a slow, deliberate pull. A slow drag halfway down that is released without
velocity must **spring back**, not dismiss.

**Settling.** Restore the class-driven transition and let the existing CSS do the rest:

- Dismiss → clear the inline transform, call `closeSheet()`.
- Spring back → set `transition:transform .4s var(--ease-drawer)`, `transform:translateY(0)`,
  then clear both on `transitionend`.

## Repo conventions to follow

- `--ease-drawer:cubic-bezier(0.32,0.72,0,1)` is introduced by plan 005 at
  [index.html:37](../index.html). This plan reuses it and must not define its own curve.
- `closeSheet()` at [index.html:2452-2459](../index.html) does real work beyond hiding the
  sheet — it runs `SHEET_RETURN` and flushes a deferred sync. **Always dismiss by calling
  `closeSheet()`.** Never hide the sheet directly.
- Pointer events with `document`-level move/up listeners removed in the up handler is the
  established drag pattern here — see `attachRowDrag()` at
  [index.html:4052-4098](../index.html). Imitate its structure.
- rAF coalescing uses a boolean latch plus a stored event — [index.html:6873-6884](../index.html).
- Reduced motion is read as `matchMedia('(prefers-reduced-motion:reduce)').matches` at
  [index.html:6759](../index.html).

## Steps

1. **Add the CSS hook.** After [index.html:224](../index.html) (`.sheet.show{transform:translateY(0);}`)
   add:

   ```css
     .sheet.dragging{transition:none!important;}
   ```

2. **Add the gesture.** Immediately after `scrim.onclick=closeSheet;` at
   [index.html:2460](../index.html), insert a self-contained block. Write it in the app
   script's style (`const`/`let`, arrow functions):

   ```js
   /* drag-to-dismiss — the grabber at the top of every sheet is an iOS affordance;
      this is what it promises. Engages only when the content is scrolled to the top,
      so it can never steal a scroll from the sheet body. */
   (function(){
     const REDUCE=matchMedia('(prefers-reduced-motion:reduce)').matches;
     let sy=0,sx=0,dy=0,t0=0,active=false,armed=false,queued=false;
     sheet.addEventListener('pointerdown',e=>{
       if(REDUCE) return;
       if(e.target.closest('input,textarea,select,button')) return;
       if(sheet.scrollTop>0) return;
       armed=true;active=false;sx=e.clientX;sy=e.clientY;dy=0;t0=performance.now();
     },{passive:true});
     const move=e=>{
       if(!armed) return;
       const ddy=e.clientY-sy, ddx=e.clientX-sx;
       if(!active){
         if(Math.abs(ddy)<6||Math.abs(ddx)>Math.abs(ddy)) return;
         if(ddy<0){ armed=false; return; }   /* an upward flick is a scroll intent */
         active=true; sheet.classList.add('dragging');
       }
       dy=ddy;
       if(queued) return; queued=true;
       requestAnimationFrame(()=>{
         queued=false;
         if(!active) return;
         const y = dy>=0 ? dy : -Math.pow(-dy,0.7)*0.6;
         sheet.style.transform='translateY('+y.toFixed(1)+'px)';
       });
     };
     const up=()=>{
       if(!armed){ return; }
       armed=false;
       if(!active){ return; }
       active=false;queued=false;
       sheet.classList.remove('dragging');
       const elapsed=performance.now()-t0;
       const velocity=Math.abs(dy)/Math.max(1,elapsed);
       const dismiss=(velocity>0.11&&dy>0)||dy>sheet.offsetHeight*0.35;
       if(dismiss){ sheet.style.transform=''; closeSheet(); return; }
       sheet.style.transition='transform .4s var(--ease-drawer)';
       sheet.style.transform='translateY(0)';
       sheet.addEventListener('transitionend',function h(){
         sheet.style.transition='';sheet.style.transform='';
         sheet.removeEventListener('transitionend',h);
       },{once:true});
     };
     document.addEventListener('pointermove',move,{passive:true});
     document.addEventListener('pointerup',up,{passive:true});
     document.addEventListener('pointercancel',up,{passive:true});
   })();
   ```

3. **Clear stale inline styles on open.** A dismissal leaves no inline transform, but a
   cancelled `transitionend` could. Make `openSheet()` defensive — replace
   [index.html:2451](../index.html):

   ```js
   /* from */
   function openSheet(html){SHEET_RETURN=null;sInner.innerHTML=`<div class="grabber"></div>`+html;scrim.classList.add('show');sheet.classList.add('show');}
   /* to */
   function openSheet(html){SHEET_RETURN=null;sheet.style.transition='';sheet.style.transform='';sheet.classList.remove('dragging');sInner.innerHTML=`<div class="grabber"></div>`+html;scrim.classList.add('show');sheet.classList.add('show');}
   ```

4. **Reset scroll position on open.** With the gesture keyed to `scrollTop`, a sheet that opens
   still scrolled from last time would not respond to a drag. Confirm whether `openSheet()`
   already resets it (`grep -n "scrollTop" index.html`). If nothing resets `sheet.scrollTop`,
   add `sheet.scrollTop=0;` to `openSheet()` alongside the step 3 additions. If something
   already does, leave it alone.

5. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT remove the scrim tap-to-close at [index.html:2460](../index.html). The drag is an
  addition, not a replacement.
- Do NOT hide the sheet directly on dismissal — always go through `closeSheet()`, which runs
  `SHEET_RETURN` and the deferred-sync flush at [index.html:2456-2458](../index.html). Skipping
  it will silently break the sync-deferral behaviour documented in `CLAUDE.md`.
- Do NOT engage the gesture when `sheet.scrollTop > 0`. Stealing a scroll from a long sheet is
  worse than having no gesture at all.
- Do NOT engage on form controls — a drag starting on a text input, textarea, select or button
  must be left to that control.
- Do NOT add momentum, overshoot, or bounce on the spring-back. `--ease-drawer` does not
  overshoot, and that is correct for a surface welded to the bottom edge (see plan 005).
- Do NOT change `.sheet`'s transition, `max-height`, or `overflow-y`.
- Do NOT add a dependency or a gesture library.
- Do NOT attempt to drive the scrim's opacity from the drag distance in this plan. It is a nice
  refinement, but it adds a second moving part to a gesture that must be right first.
- If plan 005 has not landed, STOP — `--ease-drawer` will not exist.

## Verification

- **Mechanical**: `grep -c "sheet.addEventListener" index.html` returns at least 1. Page loads
  clean.
- **Feel check** — this one **must** be tested on a real touch device or with DevTools touch
  emulation; a mouse cannot reproduce the scroll conflict.
  - Open a short sheet (tap an empty meal slot). Drag down slowly and release halfway: the
    sheet must spring back smoothly, not dismiss.
  - Drag down and release past ~35% of the sheet's height: it dismisses.
  - Flick down quickly, only 40–50px: it must dismiss. This is the velocity path, and it is the
    difference between a gesture that feels alive and one that feels like a threshold.
  - Drag **up**: the sheet must resist, moving only a little, and return to rest on release. It
    must never fly upward.
  - Open a **long** sheet (the recipe editor, or a training day with many exercises). Scroll the
    content down, then drag down from the middle of the content. **The content must scroll —
    the sheet must not move.** Scroll back to the very top, then drag down: now the sheet
    moves. This is the most important check in this plan.
  - Start a drag on a text input inside a sheet. The input must behave normally.
  - Dismiss by dragging, then reopen. The sheet must open cleanly with no leftover offset.
  - Dismiss a sheet by dragging where `SHEET_RETURN` is set (open a nested sheet — e.g. an item
    picker opened from a day card — and drag it away). The parent sheet must return, proving
    `closeSheet()` ran.
  - Turn on reduced motion: the gesture must not engage at all, and the scrim tap must still
    close the sheet.
- **Done when**: a flick dismisses, a slow half-pull springs back, and dragging inside a
  scrolled sheet scrolls the content instead of moving the sheet.

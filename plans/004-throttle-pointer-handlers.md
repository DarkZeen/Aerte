# 004 — Throttle the pointer handlers and skip them on touch

- **Status**: TODO
- **Commit**: 8f786bf
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 file (`index.html`), 2 edits

## Problem

Two `pointermove` listeners drive hover-only decoration. Both do layout-forcing work on a code
path that fires during touch scrolling, on a device that can never see the effect.

**The summary card handler is not throttled at all** — every single `pointermove` event does a
`getBoundingClientRect()` (a forced synchronous layout) plus two `setProperty` calls that
invalidate the card's background gradient:

```js
/* index.html:7270-7284 — current */
    card.addEventListener('pointermove', function(e){
      var r = card.getBoundingClientRect();
      card.style.setProperty('--aq-sx', (((e.clientX-r.left)/r.width)*100).toFixed(1)+'%');
      card.style.setProperty('--aq-sy', (((e.clientY-r.top)/r.height)*100).toFixed(1)+'%');
      card.classList.add('aq-lit');
      if(!svg || (window.FX && window.FX.dialslosh === false)) return;
      var onDial = e.target === svg || (e.target.ownerSVGElement === svg);
      if(onDial){
        if(!hot){ hot = true; svg.classList.add('aq-hot'); }
        dialMove(e);
      } else if(hot){
        hot = false; S.lean = 0; px = null;
        svg.classList.remove('aq-hot');
      }
    }, {passive:true});
```

`pointermove` fires far more often than once per frame on a high-refresh trackpad, and on iOS
it fires during a touch-drag before `pointercancel` hands the scroll over. The two properties
it writes feed a 300px radial gradient ([index.html:6965-6968](../index.html)) that is
`opacity: 0` unless `.aq-lit` is set — and `.aq-lit` is only removed on `pointerleave`, which
touch devices fire unreliably.

**The sheen handler is throttled but pointless on touch.** It is correctly rAF-coalesced, yet
it still runs `closest()` and `getBoundingClientRect()` during every touch scroll to feed a
`::after` gradient that only becomes visible on `:hover`
([index.html:6719](../index.html)) — i.e. never, on a phone:

```js
/* index.html:6872-6884 — current */
  let sheenQueued=false,lastEv=null;
  document.addEventListener('pointermove',e=>{
    lastEv=e; if(sheenQueued||reduce) return; sheenQueued=true;
    requestAnimationFrame(()=>{
      sheenQueued=false;
      const c=lastEv.target.closest&&lastEv.target.closest('.rcard,.lib-card,.trow,.mealslot');
      if(!c) return;
      const r=c.getBoundingClientRect();
      c.style.setProperty('--mx',((lastEv.clientX-r.left)/r.width*100).toFixed(1)+'%');
      c.style.setProperty('--my',((lastEv.clientY-r.top)/r.height*100).toFixed(1)+'%');
    });
  },{passive:true});
```

## Target

Both effects are desktop-only decoration, so both become no-ops on a coarse pointer, and the
one that does per-event layout work gets coalesced to one write per frame:

```js
/* target — the shared capability test, defined once per script block */
  var FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
```

- Sheen handler: bail immediately when `!FINE`. Keep the existing rAF coalescing otherwise.
- Dial-card handler: split the glow (rAF-coalesced, `FINE` only) from the dial physics
  (`dialMove`), which must keep running because a **touch drag across the dial is a real,
  intended interaction** — `.sumring` carries `cursor:grab` and `touch-action:pan-y`
  ([index.html:6971-6972](../index.html)) and `dialMove` reads `e.buttons` to distinguish
  grab strength. Do not disable the physics on touch; only the cursor glow is hover-only.

## Repo conventions to follow

- The motion-layer script ([index.html:6757](../index.html)) is modern (`const`, arrow
  functions); the liquid-layer script ([index.html:6983](../index.html)) is ES5 (`var`,
  `function`, `'use strict'`). Match whichever block you are editing.
- Both blocks already compute a capability flag at the top of their IIFE:
  `const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;`
  ([index.html:6759](../index.html)) and `var reduce = …` ([index.html:6986](../index.html)).
  Declare `FINE` on the line immediately below each, in the same style.
- Listeners are registered `{passive:true}` throughout. Keep that.

## Steps

1. **Motion layer — declare the flag.** After [index.html:6759](../index.html)
   (`const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;`) add:

   ```js
     const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
   ```

2. **Motion layer — skip the sheen on touch.** Replace the guard on
   [index.html:6875](../index.html):

   ```js
   /* from */
       lastEv=e; if(sheenQueued||reduce) return; sheenQueued=true;
   /* to */
       if(!FINE||reduce) return;
       lastEv=e; if(sheenQueued) return; sheenQueued=true;
   ```

3. **Liquid layer — declare the flag.** After [index.html:6986](../index.html)
   (`var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;`) add:

   ```js
     var FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
   ```

4. **Liquid layer — coalesce the glow and gate it.** Replace the whole listener at
   [index.html:7270-7284](../index.html):

   ```js
   /* to */
       var glowQueued = false, glowEv = null;
       card.addEventListener('pointermove', function(e){
         if(FINE){
           glowEv = e;
           if(!glowQueued){
             glowQueued = true;
             requestAnimationFrame(function(){
               glowQueued = false;
               var r = card.getBoundingClientRect();
               card.style.setProperty('--aq-sx', (((glowEv.clientX-r.left)/r.width)*100).toFixed(1)+'%');
               card.style.setProperty('--aq-sy', (((glowEv.clientY-r.top)/r.height)*100).toFixed(1)+'%');
               card.classList.add('aq-lit');
             });
           }
         }
         if(!svg || (window.FX && window.FX.dialslosh === false)) return;
         var onDial = e.target === svg || (e.target.ownerSVGElement === svg);
         if(onDial){
           if(!hot){ hot = true; svg.classList.add('aq-hot'); }
           dialMove(e);
         } else if(hot){
           hot = false; S.lean = 0; px = null;
           svg.classList.remove('aq-hot');
         }
       }, {passive:true});
   ```

   Note `glowEv` is reassigned on every event and read inside the frame callback — that is
   deliberate, it takes the newest position, matching how the sheen handler uses `lastEv`.

5. **Clear the glow on touch end.** The existing `pointerleave` handler
   ([index.html:7285-7289](../index.html)) removes `.aq-lit`, but touch does not reliably fire
   it. Immediately after that handler, add:

   ```js
       card.addEventListener('pointercancel', function(){ card.classList.remove('aq-lit'); }, {passive:true});
       card.addEventListener('pointerup', function(){ if(!FINE) card.classList.remove('aq-lit'); }, {passive:true});
   ```

6. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT disable `dialMove()` or the dial physics on touch — dragging the dial is an intended
  interaction, and the `dialglow` kill switch ([index.html:1060](../index.html)) covers only
  the glow.
- Do NOT touch the `pointerdown` splash handler at [index.html:7290-7293](../index.html) or the
  scroll-bob at [index.html:7295-7303](../index.html).
- Do NOT remove the `.sumcard::before` gradient or the `.rcard::after` sheen CSS — plan 002
  gates those rules behind a hover media query; this plan only stops the JS that feeds them.
- Do NOT change the rAF loop or watchdog — that is plan 003.
- Do NOT add dependencies.

## Verification

- **Mechanical**: page loads clean. `grep -c "pointer:fine" index.html` returns at least 2 from
  this plan's edits (more if plan 002 has already landed).
- **Feel check**:
  - **Desktop, mouse**: move the cursor across the weekly summary card. The soft light must
    still follow the pointer, and the dial must still tilt when the cursor crosses it. Open
    DevTools → Performance and record while sweeping the mouse fast across the card: there
    should be at most one "Recalculate Style" per frame, not several.
  - **Desktop, mouse**: sweep across recipe cards in the Food tab; the sheen must still track.
  - **Touch (iPhone or DevTools device emulation with touch forced on)**: scroll the Week tab
    up and down hard. Record a Performance trace — there must be **no** `getBoundingClientRect`
    forced-layout entries attributable to the pointermove handlers during the scroll.
  - **Touch**: drag a finger across the dial. It must still slosh and tilt. This is the check
    that proves step 4 did not over-gate.
  - **Touch**: after lifting your finger from the card, the soft glow must not be left on.
- **Done when**: touch scrolling triggers no pointer-driven layout work, and every desktop
  hover effect is unchanged.

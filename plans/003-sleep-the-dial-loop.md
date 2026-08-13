# 003 — Let the liquid dial's frame loop sleep

- **Status**: TODO
- **Commit**: 8f786bf
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 file (`index.html`), ~4 edits in the liquid layer script

## Problem

The weekly summary dial runs a `requestAnimationFrame` loop that never stops and never idles.
Each frame it rebuilds three ~30-point SVG path strings, repositions seven bubble circles
(three attribute writes each), and recomputes an annulus path.

```js
/* index.html:7237-7254 — current */
    /* frame loop + watchdog: some embedded webviews never fire rAF */
    var lastTick = 0;
    function tick(){
      lastTick = performance.now();
      if(!svg || !svg.isConnected || !visible || reduce) return;
      if(window.FX && window.FX.dialslosh === false){ settle(); return; }
      step();
    }
```
```js
/* index.html:7252-7254 — current */
    function loop(){ tick(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
    setInterval(function(){ if(performance.now() - lastTick > 240) tick(); }, 33);
```

Two separate problems:

**It never idles.** `step()` unconditionally advances the wave phase:

```js
/* index.html:7233 — current */
      S.phase += .042 + Math.min(.09, Math.abs(S.tiltV)*.05);
```

so even with the water perfectly settled and nobody touching the screen, the waves keep
travelling and every frame does the full path rebuild. There is no rest state.

**The watchdog keeps it running in the background.** `setInterval(…, 33)` was added for
webviews that never fire rAF. But a backgrounded PWA looks exactly like a broken webview:
the browser throttles rAF, `lastTick` goes stale, and the interval starts driving `tick()`
at ~30 Hz. `tick()`'s only guards are `svg.isConnected`, `visible`, and `reduce` — and
`visible` comes from an IntersectionObserver ([index.html:7307-7309](../index.html)), which
reports `isIntersecting: true` for an element that is on-screen in a hidden tab. So Aerte
sitting in the background on a locked phone keeps rebuilding SVG paths 30 times a second.

This is the app's signature effect and it has a documented kill switch
(`dialslosh`, [index.html:1059](../index.html)) — the effect stays. Only its cost changes.

## Target

1. The loop sleeps when the page is hidden, regardless of the watchdog.
2. The watchdog only exists while rAF has actually proven unreliable; it never runs while the
   document is hidden.
3. The dial comes to rest: when there is no user energy and the level/pie have reached their
   targets, the loop stops calling `step()` and parks until something wakes it.

```js
/* target — the idle test */
    function atRest(){
      return Math.abs(S.tiltV) < .002 && Math.abs(S.bobV) < .002 &&
             Math.abs(S.levelV) < .002 && Math.abs(S.pieV) < .002 &&
             Math.abs(S.levelT - S.level) < .05 && Math.abs(S.pieT - S.pie) < .05 &&
             Math.abs(S.tilt) < .05 && Math.abs(S.bob) < .05;
    }
```

When `atRest()` is true the wave phase stops advancing and `draw()` is skipped. Any input that
injects energy (`dialMove`, the pointerdown splash, the scroll bob, `readData()` changing a
target) naturally makes `atRest()` false again on the next frame, so no explicit wake call is
needed — the loop keeps ticking, it just stops doing work.

**Important:** the surface must not freeze mid-wave in a visibly lopsided shape. Before
parking, let the amplitude decay so the water settles flat. `S.amp` already decays toward
`.7 + energy` ([index.html:7232](../index.html)); add a target of `0` when at rest and only
park once `S.amp < .02`.

## Repo conventions to follow

- This script is ES5-style (`var`, `function`, no arrow functions, `'use strict'` at
  [index.html:6985](../index.html)). Match it — do not introduce `let`/`const`/arrows in this
  block.
- Feature detection is written defensively throughout, e.g.
  `if('IntersectionObserver' in window)` at [index.html:7307](../index.html). Follow that shape.
- Kill switches are read as `window.FX && window.FX.<key> === false` — see
  [index.html:7242](../index.html). Do not change that pattern.

## Steps

1. **Add a hidden-page guard.** Directly after the `var lastTick = 0;` line
   ([index.html:7238](../index.html)), add:

   ```js
    function awake(){ return !document.hidden && visible && svg && svg.isConnected && !reduce; }
   ```

2. **Add the rest test.** Immediately after `awake()`, add the `atRest()` function exactly as
   written in the Target section above.

3. **Rewrite `tick()`.** Replace [index.html:7239-7244](../index.html):

   ```js
   /* from */
       function tick(){
         lastTick = performance.now();
         if(!svg || !svg.isConnected || !visible || reduce) return;
         if(window.FX && window.FX.dialslosh === false){ settle(); return; }
         step();
       }
   /* to */
       function tick(){
         lastTick = performance.now();
         if(!awake()) return;
         if(window.FX && window.FX.dialslosh === false){ settle(); return; }
         if(atRest() && S.amp < .02){ return; }
         step();
       }
   ```

4. **Damp the amplitude toward zero at rest.** In `step()`, replace
   [index.html:7232](../index.html):

   ```js
   /* from */
         S.amp   += ((.7 + energy) - S.amp)*.16;
   /* to */
         S.amp   += (((atRest() ? 0 : .7) + energy) - S.amp)*.16;
   ```

   Leave line 7233 (`S.phase += …`) alone — once `tick()` stops calling `step()`, the phase
   stops on its own.

5. **Make the watchdog conditional and background-safe.** Replace
   [index.html:7254](../index.html):

   ```js
   /* from */
       setInterval(function(){ if(performance.now() - lastTick > 240) tick(); }, 33);
   /* to */
       setInterval(function(){
         if(document.hidden) return;
         if(performance.now() - lastTick > 240) tick();
       }, 250);
   ```

   The interval drops from 33ms to 250ms: it is a liveness fallback for broken webviews, not a
   second animation clock. A webview with no rAF still gets a moving dial, just at 4fps —
   which is the correct trade for a fallback path.

6. **Redraw on wake.** Add a listener immediately after the `setInterval` line so the dial is
   correct when the user returns to a backgrounded app:

   ```js
    document.addEventListener('visibilitychange', function(){
      if(!document.hidden && svg && rot) draw();
    });
   ```

7. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT remove the slosh, the bubbles, the tilt physics, or the `dialslosh` kill switch. This
  is a deliberate signature effect registered in `FX_META` at
  [index.html:1059](../index.html).
- Do NOT touch `draw()`, `waveD()`, `annulus()`, `build()`, or `readData()`.
- Do NOT change the `IntersectionObserver` block at [index.html:7307-7309](../index.html).
- Do NOT change the pointer handlers in this plan — plan 004 covers those.
- Do NOT convert the loop to `setTimeout` or change its rAF structure beyond the steps above.
- If `atRest()` makes the dial visibly freeze in a tilted or wavy pose, STOP and report — the
  amplitude decay in step 4 is what prevents that, and if it is not working the thresholds need
  a human's eye, not a guess.

## Verification

- **Mechanical**: page loads with no console errors. `grep -c "document.hidden" index.html`
  returns 2.
- **Feel check**: serve the file and open the Week tab.
  - Open DevTools → Performance, record 5 seconds while **not touching anything**, with the
    summary card on screen. After the water settles (~2s), the flame chart should go
    essentially flat — no per-frame scripting. Before the fix it is a solid 60fps wall.
  - Drag across the dial. It must tilt, slosh and settle exactly as before, then go quiet.
  - Tap the dial. The splash must still fire (`S.bobV -= 2.4`).
  - Tick a water cell so the level target changes. The water must rise smoothly to the new
    level and then rest — not snap.
  - Switch to another browser tab for 10 seconds with the Performance profiler still running,
    then come back. There must be no scripting activity while hidden, and the dial must be
    drawn correctly the moment you return.
  - Scroll the page. The scroll-bob at [index.html:7296-7303](../index.html) must still nudge
    the water.
- **Done when**: an idle Week tab shows a flat CPU profile, a hidden tab shows zero dial
  activity, and every interactive slosh behaviour is unchanged.

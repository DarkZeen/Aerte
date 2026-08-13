# 015 — Give completing a workout a moment

- **Status**: TODO
- **Commit**: 8f786bf
- **Severity**: MEDIUM (additive)
- **Category**: Missed opportunity — delight
- **Depends on**: plan 001 (must land first)

## Problem

Marking a training day complete is the emotional peak of this app. It is what the streak system
([index.html:4408](../index.html) `ACHIEVEMENTS`, `computeUnifiedStreak`), the muscle map, and
the whole week view exist to reward. Today it is rendered as a full page rebuild:

```js
/* index.html:4137-4139 — current */
  document.getElementById('tglDone').onclick=()=>{
    WDONE[key]=!WDONE[key];saveWDone();openDay(key);renderTrainWeek();renderDaystrip();
  };
```

`openDay(key)` calls `openSheet(html)` ([index.html:2451](../index.html)), which replaces
`sInner.innerHTML` wholesale — so the user taps "done" and the sheet they are looking at
flashes and rebuilds itself, replaying the 660ms staggered content fade
([index.html:226-227](../index.html)). Plan 001 quiets the two list re-renders behind it and
plan 013 shortens the content fade, but neither adds anything in their place. After those land,
finishing a workout produces *less* feedback than it does now.

**Gate record.** Frequency: **rare** — roughly four times a week, once per training day. This
is the one tier where the delight budget is allowed to be spent. Purpose: *delight* and *state
indication* — the day changes into a permanently different state that gates rerolling
([index.html:4144](../index.html)) and feeds the streak. Speed: the confirmation itself stays
inside 400ms; only the check mark's draw is longer, and it is not blocking. Function: this is a
completion event, not data the user is reading.

## Target

Three layers, in order, none of them blocking:

1. **The toggle button confirms immediately** — a 160ms press-release scale, which the user
   feels before anything else happens.
2. **A check mark draws itself** over the sheet's header area, 420ms, then fades. Drawn with
   `stroke-dasharray` / `stroke-dashoffset`, which animates on the compositor.
3. **The day chip in the strip and the training row pulse once** as the state propagates, so
   the user sees *where* the change landed.

```css
/* target — added to <style id="motion-layer"> */
  @keyframes m-done-draw{from{stroke-dashoffset:48;}to{stroke-dashoffset:0;}}
  @keyframes m-done-out{0%,64%{opacity:1;transform:scale(1);}100%{opacity:0;transform:scale(1.12);}}
  .m-done{position:fixed;left:50%;top:38%;z-index:210;pointer-events:none;
    width:76px;height:76px;margin:-38px 0 0 -38px;
    animation:m-done-out .9s var(--ease) forwards;}
  .m-done svg{width:100%;height:100%;display:block;filter:drop-shadow(0 6px 20px rgba(48,209,88,.45));}
  .m-done path{stroke:var(--green);stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round;fill:none;
    stroke-dasharray:48;animation:m-done-draw .42s var(--ease) both;}
  @keyframes m-done-pulse{0%{transform:none;}38%{transform:scale(1.06);}100%{transform:none;}}
  .m-done-pulse{animation:m-done-pulse .34s var(--spring);}
```

```js
/* target — added to window.__motion */
    done(){
      if(reduce) return;
      const w=document.createElement('div');
      w.className='m-done';
      w.setAttribute('aria-hidden','true');
      w.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 12.5l5.2 5.2L20 7"/></svg>';
      document.body.appendChild(w);
      setTimeout(()=>w.remove(),1000);
    },
```

The check is `aria-hidden` and `pointer-events:none` — it is decoration over a state change the
UI already communicates in text, so it must not be announced or interactive.

**It fires on completion only, never on un-completion.** Undoing a mistake is not a celebration.

## Repo conventions to follow

- `window.__motion` at [index.html:6768-6775](../index.html) is the place for this; `mQuiet` at
  [index.html:1048](../index.html) is the pattern for the app-script wrapper. If plan 014 has
  landed, `mEnter` sits next to it — follow the same shape for `mDone`.
- Transient overlay elements are created, appended, and removed on a timer elsewhere in this
  file — see the ripple at [index.html:6886-6895](../index.html), which appends a span and
  calls `setTimeout(()=>s.remove(),620)`. Imitate that lifecycle exactly.
- `--green:#30d158` is at [index.html:33](../index.html). `--ease` and `--spring` at
  [index.html:37](../index.html).
- Effects that can be switched off are registered in `FX_META` at
  [index.html:1055-1065](../index.html), gated by `window.FX.<key> === false` in JS and an
  `fx-no-<key>` class on `<html>` for CSS-only effects. This one is JS-driven.

## Steps

1. **Register the kill switch.** Add a row to `FX_META` at [index.html:1064](../index.html),
   after the `fabpop` entry:

   ```js
     ['donecheck',  'Completion check',      'A check mark draws itself when you finish a training day'],
   ```

   `FX_DEFAULT` at [index.html:1066](../index.html) derives from `FX_META`, so it defaults to
   on with no further change.

2. **Add the CSS.** Insert the whole target CSS block into `<style id="motion-layer">` after
   the `m-chk` rules at [index.html:6731](../index.html).

3. **Add the reduced-motion exemption.** In the motion layer's reduced-motion block at
   [index.html:6752-6755](../index.html), add `.m-done{display:none;}` alongside the existing
   `.m-ripple{display:none;}`.

4. **Add the `done()` method** to `window.__motion` at
   [index.html:6768-6775](../index.html), using the code in the Target section. Mind the commas
   between methods.

5. **Add the wrapper.** After [index.html:1048](../index.html) add:

   ```js
   function mDone(){ if(window.FX&&window.FX.donecheck===false) return; if(window.__motion&&window.__motion.done) window.__motion.done(); }
   ```

6. **Wire the toggle.** Replace [index.html:4137-4139](../index.html):

   ```js
   /* from */
     document.getElementById('tglDone').onclick=()=>{
       WDONE[key]=!WDONE[key];saveWDone();openDay(key);renderTrainWeek();renderDaystrip();
     };
   /* to */
     document.getElementById('tglDone').onclick=()=>{
       const nowDone=!WDONE[key];
       WDONE[key]=nowDone;saveWDone();
       mQuiet(()=>{openDay(key);renderTrainWeek();renderDaystrip();});
       if(nowDone){
         mDone();
         const chip=document.querySelector('#daystrip .dchip.sel');
         if(chip) chip.classList.add('m-done-pulse');
         if(chip) chip.addEventListener('animationend',()=>chip.classList.remove('m-done-pulse'),{once:true});
       }
     };
   ```

   If plan 001 has already landed, the `mQuiet(...)` wrapper will already be there — keep it and
   add only the `nowDone` capture and the `if(nowDone){…}` block.

7. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT fire anything on **un**-completing a day.
- Do NOT add confetti, particles, sound, or haptics.
- Do NOT block the UI. The check must be `pointer-events:none` and must not delay the
  re-render — it is appended alongside it, not before it.
- Do NOT touch `computeUnifiedStreak`, `STREAK_TIERS`, `ACHIEVEMENTS`, or the badge system. A
  tier-crossing celebration is a bigger design question and would need new state to detect
  "just crossed"; it is explicitly out of scope. If you think it is worth doing, report it.
- Do NOT change `openDay()`, `openSheet()`, or the sheet CSS.
- Do NOT add dependencies.
- If `#tglDone` does not exist at the line quoted, STOP and report.

## Verification

- **Mechanical**: `grep -c "m-done" index.html` returns at least 8. `grep -c "donecheck"
  index.html` returns 2. Page loads clean.
- **Feel check**: Training tab → tap a day → scroll to the done toggle.
  - Tap it. A green check must draw itself over the middle of the screen, hold briefly, then
    scale up slightly and fade. Total under one second. The sheet content updates behind it
    without re-fading.
  - The selected day chip in the strip must pulse once. Look for it — it is behind the sheet, so
    close the sheet immediately after and confirm the chip shows its completed state.
  - Tap the toggle again to un-complete. **Nothing must animate.** This is the key check.
  - Complete a day, then immediately complete another. The first check must be gone or be
    replaced cleanly — no stacking of overlays. If two overlap, report it.
  - Confirm the check is not tappable: complete a day and try to tap through where the check is
    drawn while it is visible. The tap must reach whatever is underneath.
  - Dev Studio → UX switchboard → turn off "Completion check". Completing a day must produce no
    overlay, but the state change must still work.
  - Turn on reduced motion. No check, no pulse, state change still works.
  - Check with a screen reader (VoiceOver rotor, or just confirm `aria-hidden="true"` is present
    in the DOM) that the overlay is not announced.
- **Done when**: completing a day feels like an event, un-completing feels like nothing, and
  the overlay never blocks a tap.

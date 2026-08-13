# 007 — Make reduced motion gentler, not dead

- **Status**: TODO
- **Commit**: 8f786bf
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (`index.html`), 1 CSS edit

## Problem

```css
/* index.html:360 — current */
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}.dchip,.rcard,.sheet-inner>*{opacity:1!important;transform:none!important;}}
```

`*{transition:none!important}` is a blunt instrument. `prefers-reduced-motion` means the user
is sensitive to **movement** — vestibular triggers are position, scale and rotation changes.
It does not mean they want the interface to become a slideshow of hard cuts.

What this rule currently destroys for those users:

- The bottom sheet stops sliding and **teleports** into place ([index.html:218](../index.html)).
  A full-screen surface appearing between two frames with no fade is arguably a worse
  experience than the slide it replaced.
- The scrim behind it hard-cuts from transparent to a blurred black overlay
  ([index.html:216](../index.html)).
- The toast pops in and out with no fade ([index.html:306](../index.html)).
- Every colour and border feedback in the app becomes instant — focus rings on inputs
  ([index.html:211](../index.html)), the checked state on shopping rows
  ([index.html:281](../index.html)), the segmented-control label colour
  ([index.html:89](../index.html)). None of these move; all of them are just feedback.

Two narrower reduced-motion blocks already exist and are correct in spirit —
[index.html:107](../index.html) (stops the ring waves) and
[index.html:6978-6981](../index.html) (stops the water fill and dial scaling). The global rule
at line 360 is the one that overreaches. The motion-layer block at
[index.html:6752-6755](../index.html) is also fine.

## Target

Keep every opacity and colour transition. Remove movement. Concretely:

```css
/* target — replaces index.html:360 */
  @media (prefers-reduced-motion:reduce){
    /* movement is what triggers; opacity and colour feedback stay */
    *{animation:none!important;}
    .dchip,.rcard,.lib-card,.sheet-inner>*,.m-in,.m-tabin{opacity:1!important;transform:none!important;}
    /* surfaces that used to slide now cross-fade in place */
    .sheet{transition:opacity .2s var(--ease)!important;transform:translateY(0)!important;opacity:0;pointer-events:none;}
    .sheet.show{opacity:1;pointer-events:auto;}
    .seg .glider,.dsel{transition:none!important;}
    #toast{transition:opacity .2s var(--ease)!important;transform:translateX(-50%)!important;}
    .addbtn:hover,.dchip:hover,.rcard:hover,.lib-card:hover,.daystrip .dchip:hover{transform:none!important;}
    .cta:active,.wcell:active,.mealslot:active,.exrow:active,.trow:active{transform:none!important;}
  }
```

Note what is **not** in that block: no `*{transition:none}`. Colour, border and opacity
transitions everywhere else keep working, which is the point.

The `.sheet` rule needs care. Its resting state is `transform:translateY(102%)` and `.show`
sets `translateY(0)`. Under reduced motion we pin the transform at `translateY(0)` permanently
and gate visibility on opacity instead — otherwise the sheet would sit visible on top of the
app at all times.

## Repo conventions to follow

- Media queries are written `@media (prefers-reduced-motion:reduce){` with no space after the
  colon — see [index.html:107](../index.html), [index.html:6752](../index.html),
  [index.html:6978](../index.html).
- Multi-line rule blocks in this file are indented two spaces from the `@media`, as at
  [index.html:6752-6755](../index.html). Match that.
- `--ease` is `cubic-bezier(.22,.9,.32,1)` at [index.html:37](../index.html).

## Steps

1. Replace [index.html:360](../index.html) in full with the target block above. It is a single
   line today; it becomes a multi-line block.

2. **Verify the sheet still hides.** The reduced-motion `.sheet` rule sets
   `pointer-events:none` on the base and `auto` on `.show`. Confirm no other rule sets
   `pointer-events` on `.sheet` (`grep -n "pointer-events" index.html` — check the `.sheet`
   entries). If one does and it conflicts, STOP and report.

3. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT touch the other three reduced-motion blocks at [index.html:107](../index.html),
  [index.html:6752-6755](../index.html), or [index.html:6978-6981](../index.html). They are
  scoped correctly.
- Do NOT change the JS `reduce` flags at [index.html:6759](../index.html) and
  [index.html:6986](../index.html) or any of their guards. Those correctly disable the
  rAF-driven effects entirely, which is right — they are all movement.
- Do NOT remove `*{animation:none!important}`. Every keyframe animation in this app moves
  something; killing them wholesale is correct.
- Do NOT add new easing tokens or durations.

## Verification

- **Mechanical**: page loads clean. `grep -c "prefers-reduced-motion" index.html` returns 4
  (unchanged).
- **Feel check**: enable reduced motion — macOS System Settings → Accessibility → Display →
  Reduce motion, or DevTools → Rendering panel → "Emulate CSS media feature
  prefers-reduced-motion: reduce".
  - Open a sheet. It must **fade** in, not teleport and not slide. Close it: it fades out.
    Nothing on screen should translate.
  - Confirm the sheet is genuinely gone when closed — tap where its content was and confirm
    nothing responds. This is the check that proves the `pointer-events` handling is right.
  - Switch segmented tabs. The glider must jump instantly (no slide) but the label colours must
    still cross-fade.
  - Focus a text input in any editor sheet. The border colour must still ease to red.
  - Tick a shopping row. The row's opacity must still ease to `.5`; nothing may scale.
  - Trigger a toast. It must fade in and out without rising.
  - Tap the FAB and a day chip. Nothing may scale, lift or rotate.
  - Now **disable** reduced motion and confirm the app animates exactly as it did before this
    change.
- **Done when**: with reduced motion on, nothing in the app translates, scales or rotates, and
  every colour/opacity transition still plays.

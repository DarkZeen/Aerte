# 002 — Gate every hover effect behind a real pointer

- **Status**: DONE (applied at 8f786bf, uncommitted)
- **Commit**: 8f786bf
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 1 file (`index.html`), ~8 CSS edits

## Problem

There is not one `@media (hover: hover)` query in the file (verified:
`grep -c "hover:hover" index.html` returns 0). Aerte is a touch-first PWA installed to an
iPhone home screen, and on iOS a tap latches `:hover` on the tapped element until the user
taps somewhere else.

The most visible casualty is the floating action button — the app's primary control:

```css
/* index.html:357 — current */
  .addbtn:hover{transform:scale(1.08) rotate(90deg);}.addbtn:active{transform:scale(.9);}
```

Tapping `+` opens a sheet. The FAB stays visible above the scrim, stuck at 1.08× and rotated
90°, until the user taps elsewhere. It reads as a rendering bug.

The card lifts have the same problem — tapped cards stay floating 2–3px above their neighbours:

```css
/* index.html:135 — current */
  .dchip:hover{transform:translateY(-2px);border-color:var(--stroke-2);}
```
```css
/* index.html:238 — current */
  .rcard:hover{border-color:var(--stroke-2);transform:translateY(-3px);}
```
```css
/* index.html:499 — current */
  .lib-card:hover{border-color:var(--stroke-2);transform:translateY(-3px);}
```
```css
/* index.html:6960 — current (liquid layer, overrides the base rule) */
  .daystrip .dchip:hover{transform:translateY(-2px);}
```

And the pointer-tracked sheen, which is pure decoration that a touch device can never
meaningfully display, yet still latches on:

```css
/* index.html:6719 — current */
  .rcard:hover::after,.lib-card:hover::after,.trow:hover::after,.mealslot:hover::after{opacity:1;}
```

The day-strip code already had to work around a symptom of this rather than the cause:

```css
/* index.html:6955 — current */
  html.dsel-on .daystrip .dchip.sel:hover{transform:none;}
```

## Target

Every hover rule that changes `transform`, or that reveals a decorative layer, only applies on
devices with a real hovering pointer:

```css
/* target pattern */
@media (hover: hover) and (pointer: fine){
  .addbtn:hover{transform:scale(1.08) rotate(90deg);}
}
```

Colour and border-colour hover feedback may stay ungated — it is harmless if it latches, and
removing it would cost desktop users useful affordance. **Only movement and the sheen get
gated.**

`:active` rules stay exactly as they are: they are the correct touch feedback and already
exist for all of these elements ([index.html:6722](../index.html),
[index.html:6961](../index.html), [index.html:357](../index.html)).

## Repo conventions to follow

- Media queries in this file are written without a space after the colon and are placed
  immediately after the rules they modify — see [index.html:107](../index.html)
  (`@media (prefers-reduced-motion:reduce){...}` sitting directly under the `slosh` keyframes)
  and [index.html:236](../index.html) (`@media(min-width:560px)`).
- The base stylesheet ends at [index.html:857](../index.html); the motion layer is a separate
  `<style id="motion-layer">` at [index.html:6698](../index.html); the liquid layer is
  `<style id="liquid-layer">` at [index.html:6914](../index.html). Edit each rule **in the
  block where it already lives** — do not consolidate across blocks, because later blocks
  deliberately override earlier ones.

## Steps

1. **FAB.** Replace [index.html:357](../index.html) exactly:

   ```css
   /* from */
     .addbtn:hover{transform:scale(1.08) rotate(90deg);}.addbtn:active{transform:scale(.9);}
   /* to */
     @media (hover:hover) and (pointer:fine){.addbtn:hover{transform:scale(1.08) rotate(90deg);}}
     .addbtn:active{transform:scale(.9);}
   ```

2. **Day chip (base sheet).** Replace [index.html:135](../index.html):

   ```css
   /* from */
     .dchip:hover{transform:translateY(-2px);border-color:var(--stroke-2);}
   /* to */
     .dchip:hover{border-color:var(--stroke-2);}
     @media (hover:hover) and (pointer:fine){.dchip:hover{transform:translateY(-2px);}}
   ```

3. **Recipe card.** Replace [index.html:238](../index.html):

   ```css
   /* from */
     .rcard:hover{border-color:var(--stroke-2);transform:translateY(-3px);}
   /* to */
     .rcard:hover{border-color:var(--stroke-2);}
     @media (hover:hover) and (pointer:fine){.rcard:hover{transform:translateY(-3px);}}
   ```

4. **Library card.** Replace [index.html:499](../index.html) using the same pattern as step 3,
   with the selector `.lib-card`.

5. **Sheen reveal (motion layer).** Replace [index.html:6719](../index.html):

   ```css
   /* from */
     .rcard:hover::after,.lib-card:hover::after,.trow:hover::after,.mealslot:hover::after{opacity:1;}
   /* to */
     @media (hover:hover) and (pointer:fine){
       .rcard:hover::after,.lib-card:hover::after,.trow:hover::after,.mealslot:hover::after{opacity:1;}
     }
   ```

6. **Day strip (liquid layer).** Replace [index.html:6960](../index.html):

   ```css
   /* from */
     .daystrip .dchip:hover{transform:translateY(-2px);}
   /* to */
     @media (hover:hover) and (pointer:fine){.daystrip .dchip:hover{transform:translateY(-2px);}}
   ```

7. **Gear button reveal.** The dev-mode gear reveals on `.fab-group:hover`
   ([index.html:509](../index.html), the rule reading
   `.fab-group:hover .gear-btn{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}`).
   Wrap that single rule in `@media (hover:hover) and (pointer:fine){ … }` too. **Read the
   surrounding lines first** — if the gear has no other way to appear on touch, STOP and
   report rather than making it unreachable on the phone.

8. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT gate hover rules that only change `color`, `background`, `border-color`, or
  `box-shadow`. Leave [index.html:86](../index.html), [index.html:98](../index.html),
  [index.html:171](../index.html), [index.html:181](../index.html) and the ~40 similar rules
  untouched.
- Do NOT remove or alter any `:active` rule.
- Do NOT delete the workaround at [index.html:6955](../index.html) in this plan even though it
  becomes redundant on touch — it still applies on desktop, where the traveller outline is
  measured from the chip's rendered rect.
- Do NOT add dependencies or restructure the stylesheets.

## Verification

- **Mechanical**: `grep -c "hover:hover" index.html` returns 7 (or 6 if step 7 was reported and
  skipped). The page loads with no console errors.
- **Feel check**: open the app in Safari on an iPhone, or in Chrome DevTools device emulation
  with touch emulation forced on (Rendering panel → "Emulate touch" / device toolbar).
  - Tap the `+` FAB, then tap the scrim to dismiss. The FAB must be upright and unscaled the
    whole time. Before the fix it stays rotated 90°.
  - Tap a recipe card, then close the sheet. The card must sit flush with its neighbours, not
    3px proud.
  - Tap a day chip in the strip. The red traveller outline must stay aligned with the chip —
    no vertical offset.
  - On a desktop browser with a mouse, hover each of the same elements and confirm the lift,
    the FAB rotate, and the card sheen **still work**. If they stopped on desktop, the media
    query is wrong.
- **Done when**: no element retains a transform after a touch tap, and every hover effect
  still plays with a mouse.

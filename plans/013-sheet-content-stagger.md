# 013 — Land the sheet's contents with the sheet

- **Status**: DONE (applied at 8f786bf, uncommitted)
- **Commit**: 8f786bf
- **Severity**: MEDIUM
- **Category**: Interruptibility / Easing & duration
- **Estimated scope**: 1 file (`index.html`), 2 CSS edits

## Problem

Every direct child of the sheet body fades up on its own keyframe animation, with a stagger:

```css
/* index.html:226-228 — current */
  .sheet-inner>*{opacity:0;transform:translateY(8px);animation:fadeup .5s var(--ease) forwards;}
  .sheet-inner>*:nth-child(2){animation-delay:.04s}.sheet-inner>*:nth-child(3){animation-delay:.08s}.sheet-inner>*:nth-child(4){animation-delay:.12s}.sheet-inner>*:nth-child(n+5){animation-delay:.16s}
  @keyframes fadeup{to{opacity:1;transform:none;}}
```

The sheet itself takes 450ms to arrive ([index.html:218](../index.html), 400ms after plan 005).
Its contents take **500ms + up to 160ms of delay = 660ms**. So the sheet stops moving and the
user is still watching text fade in for another 210ms. The container lands before its contents,
which inverts the physical story — a drawer's contents arrive *with* the drawer.

Two secondary problems:

1. **These are keyframes, so they restart from zero.** `openSheet()` replaces
   `sInner.innerHTML` wholesale ([index.html:2451](../index.html)), and several flows re-render
   an open sheet in place — `openDay()` calls itself after the done toggle
   ([index.html:4138](../index.html)), and `openDedupeSheet` reopens itself
   ([index.html:2862](../index.html)). Each re-render replays the full 660ms fade over content
   the user is already reading.
2. **The stagger applies to every child**, including the sheet's `<h3>` title and `.meta` line,
   which are the first things the user looks for.

The grabber already had to be exempted by hand, which is the tell that this rule is too broad:

```css
/* index.html:229 — current */
  .grabber{width:38px;height:5px;border-radius:3px;background:var(--stroke-2);margin:10px auto 14px;animation:none!important;opacity:1!important;transform:none!important;}
```

## Target

Contents settle inside the sheet's own travel time, and the stagger stops after the first few
elements:

```css
/* target — index.html:226-227 */
  .sheet-inner>*{opacity:0;transform:translateY(6px);animation:fadeup .22s var(--ease) forwards;}
  .sheet-inner>*:nth-child(2){animation-delay:.03s}.sheet-inner>*:nth-child(3){animation-delay:.06s}.sheet-inner>*:nth-child(n+4){animation-delay:.09s}
```

Longest total: 90ms delay + 220ms = **310ms**, comfortably inside the sheet's 400ms slide. The
travel drops from 8px to 6px because a shorter animation over the same distance looks faster
and slightly frantic; less distance keeps it calm.

The stagger caps at the third child instead of the fifth. Beyond three elements the eye stops
reading it as a sequence anyway, and every additional step is time the user waits.

## Repo conventions to follow

- `--ease:cubic-bezier(.22,.9,.32,1)` at [index.html:37](../index.html).
- The `fadeup` keyframe at [index.html:228](../index.html) is a `to`-only keyframe — the
  starting state lives on the rule. Keep that shape; do not convert it to `from`/`to`.
- Stagger steps elsewhere in this file are 18–70ms
  ([index.html:6779-6781](../index.html)). 30ms is in range.

## Steps

1. Replace [index.html:226](../index.html):

   ```css
   /* from */
     .sheet-inner>*{opacity:0;transform:translateY(8px);animation:fadeup .5s var(--ease) forwards;}
   /* to */
     .sheet-inner>*{opacity:0;transform:translateY(6px);animation:fadeup .22s var(--ease) forwards;}
   ```

2. Replace [index.html:227](../index.html):

   ```css
   /* from */
     .sheet-inner>*:nth-child(2){animation-delay:.04s}.sheet-inner>*:nth-child(3){animation-delay:.08s}.sheet-inner>*:nth-child(4){animation-delay:.12s}.sheet-inner>*:nth-child(n+5){animation-delay:.16s}
   /* to */
     .sheet-inner>*:nth-child(2){animation-delay:.03s}.sheet-inner>*:nth-child(3){animation-delay:.06s}.sheet-inner>*:nth-child(n+4){animation-delay:.09s}
   ```

3. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT change the `fadeup` keyframe itself at [index.html:228](../index.html).
- Do NOT remove the `.grabber` exemption at [index.html:229](../index.html).
- Do NOT change `.sheet` or `.scrim` — the sheet's own timing is plan 005.
- Do NOT change `openSheet()` or `closeSheet()` at
  [index.html:2451-2459](../index.html).
- Do NOT convert these keyframes to CSS transitions in this plan. Doing so properly needs
  `@starting-style` or a mount flag, and the payoff (interruptibility on re-render) is small
  once the total duration is 310ms. If you think it is worth doing, report it rather than
  attempting it here.
- Do NOT reduce the `nth-child` stagger to zero — some sequence is what keeps a dense sheet
  from arriving as a wall of text.

## Verification

- **Mechanical**: `grep -c "fadeup .5s" index.html` returns 0. Page loads clean.
- **Feel check**:
  - Open several different sheets: a day card (Week tab, tap a day), the item picker (tap an
    empty meal slot), a recipe editor, and Profile. In each, the content must be fully settled
    by the time the sheet stops moving. Watch the sheet's top edge — when it stops, nothing
    should still be fading.
  - Open a sheet with many children (the recipe editor is the densest). The last element must
    not lag noticeably behind the first.
  - Open a training day sheet and tap the done toggle. The sheet re-renders — the content
    re-fade should now be brief enough not to interrupt reading. (Plan 001 removes the list
    replay behind it; this plan shortens what remains.)
  - Open DevTools → Animations, set playback to 25%, and open a sheet. Confirm the sheet's
    transform track and the last child's `fadeup` track both finish within the sheet's slide.
  - Turn on reduced motion and confirm the sheet contents appear at full opacity with no
    movement (handled by plan 007 / the existing rule at
    [index.html:360](../index.html)).
- **Done when**: no sheet has content still animating after the sheet itself has stopped.

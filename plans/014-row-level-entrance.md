# 014 — Animate the row that changed, not the whole list

- **Status**: TODO
- **Commit**: 8f786bf
- **Severity**: MEDIUM (additive)
- **Category**: Missed opportunity — preventing a jarring change
- **Depends on**: plan 001 (must land first)

## Problem

Plan 001 stops entrance staggers replaying on in-place re-renders. That is the right fix, but
it leaves a gap: when a row genuinely **is** new, it will now appear with no bridge at all —
one frame it does not exist, the next it is there, pushing everything below it down.

Adding a custom shopping item re-renders the entire list today:

```js
/* index.html:3228 — current (end of the custom-product editor save handler) */
    await saveShopCustom();closeSheet();renderShop();
```

Deleting one does the same:

```js
/* index.html:3230 — current */
  const del=document.getElementById('cpDel');if(del)del.onclick=async()=>{SHOP_CUSTOM=SHOP_CUSTOM.filter(x=>x.id!==editId);await saveShopCustom();closeSheet();renderShop();};
```

Neither is covered by plan 001, because both really are content changes — but "the whole list
re-animates" is still the wrong answer to "one row was added".

**Gate record.** Frequency: occasional — adding items happens a handful of times per shopping
session, not per minute. Purpose: *preventing a jarring change* — a row appearing under the
user's finger with no transition, shifting the rows below it. Speed: 200ms, inside budget.
Function: this is a list the user acts on rather than reads continuously, and the motion is
confined to the one row that changed, so it does not interfere with scanning the rest.

## Target

A single-element entrance, applied to just the row that appeared:

```css
/* target — added to <style id="motion-layer"> */
  @keyframes m-row-in{from{opacity:0;transform:translateY(-6px) scale(.99);}to{opacity:1;transform:none;}}
  .m-row-in{animation:m-row-in .2s var(--ease) both;}
```

`translateY(-6px)` — the row settles **downward** into the gap that opened for it, rather than
rising from below like the bulk-entrance animation. That difference is the point: it reads as
"this one is new" rather than "the list reloaded".

And a helper on the existing motion API:

```js
/* target — added to window.__motion at index.html:6768-6775 */
    enter(el){
      if(!el||reduce) return;
      el.classList.remove('m-row-in'); void el.offsetWidth; el.classList.add('m-row-in');
      el.addEventListener('animationend',()=>el.classList.remove('m-row-in'),{once:true});
    },
```

Call sites become: quiet the re-render, then animate the one row.

```js
/* target — index.html:3228 */
    await saveShopCustom();closeSheet();
    mQuiet(()=>renderShop());
    mEnter(document.querySelector('.shop-item[data-customedit="'+newId+'"]'));
```

## Repo conventions to follow

- `window.__motion` is defined at [index.html:6768-6775](../index.html) and already exposes
  `quiet(fn)` and `isQuiet`. Add `enter` as a third method on that object.
- The app script accesses it through a thin global wrapper so it works before the motion layer
  loads — [index.html:1048](../index.html):
  `function mQuiet(fn){ return (window.__motion&&window.__motion.quiet)?window.__motion.quiet(fn):fn(); }`
  Add `mEnter` next to it in exactly the same shape.
- The reflow-then-replay idiom (`remove class; void offsetWidth; add class`) is already used at
  [index.html:6860](../index.html) (`tabIn`) and [index.html:4136](../index.html)
  (`.wcell.flip`). Imitate `tabIn` — it is the closest match, including the `animationend`
  cleanup.
- `reduce` is in scope inside the motion-layer IIFE ([index.html:6759](../index.html)).

## Steps

1. **Add the keyframe and class.** In `<style id="motion-layer">`, immediately after the
   `m-tabin` rule at [index.html:6712](../index.html), insert the two CSS rules from the Target
   section.

2. **Add the `enter` method.** In the `window.__motion` object literal at
   [index.html:6768-6775](../index.html), add the `enter(el){…}` method from the Target section
   after the `quiet(fn)` method. Mind the comma between methods.

3. **Add the global wrapper.** Immediately after [index.html:1048](../index.html), add:

   ```js
   function mEnter(el){ if(window.__motion&&window.__motion.enter) window.__motion.enter(el); }
   ```

4. **Wire the custom-item add.** Replace [index.html:3227-3228](../index.html):

   ```js
   /* from */
       else { SHOP_CUSTOM.push(Object.assign({id:'c'+Date.now(),checked:false},data)); }
       await saveShopCustom();closeSheet();renderShop();
   /* to */
       else { SHOP_CUSTOM.push(Object.assign({id:'c'+Date.now(),checked:false},data)); }
       const newId=SHOP_CUSTOM.length?SHOP_CUSTOM[SHOP_CUSTOM.length-1].id:null;
       await saveShopCustom();closeSheet();
       mQuiet(()=>renderShop());
       mEnter(document.querySelector('.shop-item[data-customedit="'+newId+'"]'));
   ```

   **Verify the selector before relying on it.** `renderShop()` emits custom rows as
   `<div class="shop-item ${it.checked?'checked':''}" data-customedit="${it.id}">` at
   [index.html:3016](../index.html). Confirm with `grep -n 'data-customedit=' index.html` —
   it should return lines 3016 and 3059.

   Note the branch structure: `newId` is only correct for the branch that **pushes**. The
   preceding branches — edit-in-place (`if(isEdit){ Object.assign(it,data); }` at
   [index.html:3219](../index.html)) and fold-into-existing
   ([index.html:3222-3223](../index.html)) — modify an existing row and should get no entrance.
   If capturing `newId` cleanly across those branches is awkward, set a `let newId=null;` before
   the branch chain and assign it inside each `push` branch only.

5. **Wire the delete.** Replace [index.html:3230](../index.html)'s `renderShop()` with
   `mQuiet(()=>renderShop())`. There is no exit animation here — the row's own sheet has
   already closed over it, which is bridge enough. Do not add one.

6. **Other candidate sites — verify before wiring.** The same pattern applies to
   [index.html:3196](../index.html), [index.html:3224](../index.html),
   [index.html:3551](../index.html) and [index.html:3570](../index.html), which also push into
   `SHOP_CUSTOM`. For each: read the surrounding function, confirm it ends in a `renderShop()`,
   and confirm the pushed object's `id` is reachable. Wire the ones that are
   straightforward; **skip and report** any that are not. Do not restructure a function to make
   it fit.

7. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT apply `mEnter` to rows that merely changed state (a ticked checkbox, an edited amount).
  Only rows that did not exist a moment ago.
- Do NOT add exit animations for removed rows in this plan. Removal needs the element to
  outlive its own deletion, which means changing how `renderShop()` rebuilds — out of scope.
- Do NOT change `stagger()`, `GROUPS`, or the MutationObserver wiring.
- Do NOT wire this into `dayDetail` meal groups in this plan. The meal-slot add path closes a
  sheet and re-renders a different container, and it needs its own read.
- Do NOT add dependencies.
- If plan 001 has not landed, STOP — without it these renders still replay the whole list and
  the single-row entrance will be invisible underneath.

## Verification

- **Mechanical**: `grep -c "m-row-in" index.html` returns 3. `grep -c "mEnter" index.html`
  returns at least 3. Page loads clean.
- **Feel check**: Shopping tab.
  - Add a custom item. The list must stay still except for the new row, which settles down into
    place over ~200ms. Nothing else may move or fade.
  - Add a second item with a name matching an existing product, so it folds into the existing
    line instead of creating a new one. **Nothing should animate** — this is the check that the
    branch handling in step 4 is right.
  - Delete a custom item. The list reflows with no entrance replay.
  - Tick a checkbox (plan 001's path). Still nothing moves.
  - Turn on reduced motion, add an item: the row must appear instantly with no movement.
  - Scroll the list while adding an item from the sheet, so the new row lands off-screen.
    Confirm nothing janks and no stray animation plays when you scroll back to it.
- **Done when**: adding a row animates exactly one row, and folding into an existing row
  animates nothing.

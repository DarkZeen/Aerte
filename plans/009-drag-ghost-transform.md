# 009 — Move the drag ghost with `transform`, not `left`/`top`

- **Status**: TODO
- **Commit**: 8f786bf
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file (`index.html`), 2 edits in `attachRowDrag()`

## Problem

Dragging a training row to swap two days builds a cloned "ghost" element and repositions it on
every `pointermove` using layout properties:

```js
/* index.html:4071-4076 — current */
        ghost.style.left=(ev.clientX-el.offsetWidth/2)+'px';
        ghost.style.top=(ev.clientY-el.offsetHeight/2)+'px';
        const under=document.elementFromPoint(ev.clientX,ev.clientY);
        const row=under&&under.closest('.trow');
        if(target&&target!==row)target.classList.remove('dragover');
        if(row&&row!==el){row.classList.add('dragover');target=row;}else target=null;
```

Three costs stacked on the most frame-sensitive interaction in the app:

1. `left`/`top` on a `position:fixed` element trigger layout, then paint, then composite —
   every frame of the drag. `transform` is composite-only.
2. `elementFromPoint()` forces a synchronous layout flush, and it runs on **every**
   `pointermove` event, not once per frame. There is no rAF coalescing here at all.
3. `el.offsetWidth` and `el.offsetHeight` are read inside the move handler on every event
   ([4071-4072](../index.html)), each one another forced layout — and they never change during
   a drag.

The ghost is created with the right idea already — transitions and animations explicitly
disabled so it tracks the finger exactly:

```js
/* index.html:4064-4069 — current */
        ghost=el.cloneNode(true);ghost.classList.remove('dragging');
        Object.assign(ghost.style,{position:'fixed',zIndex:999,pointerEvents:'none',
          width:el.offsetWidth+'px',height:el.offsetHeight+'px',opacity:'.92',
          transform:'scale(1.03)',boxShadow:'0 18px 50px rgba(255,69,58,0.45)',
          transition:'none',animation:'none',margin:0});
        document.body.appendChild(ghost);
```

Note it already sets `transform:'scale(1.03)'` — so the fix must **compose** translate with
that scale, not replace it.

## Target

- Ghost anchored once at `left:0; top:0` and moved with
  `transform: translate3d(x, y, 0) scale(1.03)`.
- Dimensions measured once, at ghost creation, and reused.
- The whole move handler coalesced to one `requestAnimationFrame` per frame, so
  `elementFromPoint` runs at most 60 times a second instead of once per raw pointer event.

```js
/* target — inside the move handler */
      ghost.style.transform='translate3d('+(ev.clientX-gw/2)+'px,'+(ev.clientY-gh/2)+'px,0) scale(1.03)';
```

## Repo conventions to follow

- This block is in the main app script, which uses `const`/`let`, arrow functions, and packs
  statements densely — see [index.html:4052-4098](../index.html). Match that style.
- rAF coalescing elsewhere in this file uses a boolean latch plus a stored event — see
  [index.html:6873-6884](../index.html) (`sheenQueued` / `lastEv`) and
  [index.html:6900-6904](../index.html). Imitate that shape.
- `pointerdown`/`pointermove`/`pointerup` on `document` with manual removal in `up()` is the
  established pattern here; keep it.

## Steps

1. **Hoist the measurements and add the frame latch.** Replace
   [index.html:4058](../index.html):

   ```js
   /* from */
       let ghost=null,started=false,target=null;
   /* to */
       let ghost=null,started=false,target=null,gw=0,gh=0,queued=false,lastEv=null;
   ```

2. **Anchor the ghost and record its size.** Replace
   [index.html:4064-4069](../index.html):

   ```js
   /* from */
           ghost=el.cloneNode(true);ghost.classList.remove('dragging');
           Object.assign(ghost.style,{position:'fixed',zIndex:999,pointerEvents:'none',
             width:el.offsetWidth+'px',height:el.offsetHeight+'px',opacity:'.92',
             transform:'scale(1.03)',boxShadow:'0 18px 50px rgba(255,69,58,0.45)',
             transition:'none',animation:'none',margin:0});
           document.body.appendChild(ghost);
   /* to */
           gw=el.offsetWidth; gh=el.offsetHeight;
           ghost=el.cloneNode(true);ghost.classList.remove('dragging');
           Object.assign(ghost.style,{position:'fixed',zIndex:999,pointerEvents:'none',
             left:'0',top:'0',willChange:'transform',
             width:gw+'px',height:gh+'px',opacity:'.92',
             transform:'translate3d(0,0,0) scale(1.03)',boxShadow:'0 18px 50px rgba(255,69,58,0.45)',
             transition:'none',animation:'none',margin:0});
           document.body.appendChild(ghost);
   ```

3. **Coalesce the move work.** Replace [index.html:4071-4076](../index.html) (the tail of the
   `move` function, after the `started` block):

   ```js
   /* from */
         ghost.style.left=(ev.clientX-el.offsetWidth/2)+'px';
         ghost.style.top=(ev.clientY-el.offsetHeight/2)+'px';
         const under=document.elementFromPoint(ev.clientX,ev.clientY);
         const row=under&&under.closest('.trow');
         if(target&&target!==row)target.classList.remove('dragover');
         if(row&&row!==el){row.classList.add('dragover');target=row;}else target=null;
   /* to */
         lastEv=ev;
         if(queued)return;
         queued=true;
         requestAnimationFrame(()=>{
           queued=false;
           if(!ghost)return;
           ghost.style.transform='translate3d('+(lastEv.clientX-gw/2)+'px,'+(lastEv.clientY-gh/2)+'px,0) scale(1.03)';
           const under=document.elementFromPoint(lastEv.clientX,lastEv.clientY);
           const row=under&&under.closest('.trow');
           if(target&&target!==row)target.classList.remove('dragover');
           if(row&&row!==el){row.classList.add('dragover');target=row;}else target=null;
         });
   ```

   The `if(!ghost)return;` guard matters: `up()` removes the ghost, and a queued frame can
   still fire after that.

4. **Clear the latch on release.** In `up()` ([index.html:4078-4094](../index.html)), add
   `queued=false;lastEv=null;` immediately after `if(ghost)ghost.remove();`.

5. **Quiet the post-drop re-render** — if plan 001 has not landed yet, apply its step 4 here
   as well, otherwise the swap confirmation bump plays against a full-list entrance replay.
   If plan 001 has landed, skip this step.

6. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT change the 8px drag threshold at [index.html:4061](../index.html).
- Do NOT change the swap logic, `WPLAN` writes, or `saveWPlan()` at
  [index.html:4083-4088](../index.html).
- Do NOT change the drop confirmation bump at [index.html:4089-4091](../index.html) — plan 006
  covers its hardcoded easing.
- Do NOT change `.trow.dragging` or `.trow.dragover` CSS at
  [index.html:126-127](../index.html).
- Do NOT add a drag library or any dependency.
- Do NOT add spring physics or momentum to the ghost — it must track the finger exactly, which
  is why `transition:'none'` is already set.

## Verification

- **Mechanical**: page loads clean. `grep -c "translate3d" index.html` increases by 2.
- **Feel check**: Training tab, on a touch device or with DevTools touch emulation.
  - Press and drag a training row. The ghost must sit centred under your finger and track it
    with no lag or drift. Any visible offset means the `gw`/`gh` centring is wrong.
  - Drag over another row. It must highlight (`.dragover` — red border, tinted background) and
    un-highlight as you leave. This proves `elementFromPoint` still works inside the rAF.
  - Drop onto another row. The two days must swap and the target row must play its scale bump.
  - Drop outside any row. Nothing should swap and the ghost must disappear cleanly.
  - Start a drag and release without moving 8px. The row must open its day sheet as a normal
    tap — the drag threshold must be intact.
  - In DevTools → Performance, record a drag across the full list. Before the fix you will see
    Layout entries on nearly every frame; after, the frames should show composite-only work for
    the ghost, with `elementFromPoint` layout costs capped at one per frame.
- **Done when**: the drag holds 60fps in a Performance trace and every drop/highlight behaviour
  is unchanged.

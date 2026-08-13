# 016 — Bridge the hard cut between guided sequence moves

- **Status**: TODO
- **Commit**: 8f786bf
- **Severity**: MEDIUM (additive)
- **Category**: Missed opportunity — preventing a jarring change

## Problem

The guided warmup / stretch overlay is a full-screen, high-focus surface: dark background,
20px backdrop blur, a 72px countdown, and one exercise at a time
([index.html:390-408](../index.html), markup at [index.html:949](../index.html)).

Every field is replaced with a bare `textContent` assignment, so moving from one move to the
next is a hard cut:

```js
/* index.html:1445-1456 — current */
  document.getElementById('seqName').textContent=item.name;
  document.getElementById('seqCues').textContent=item.cues;
  const sideEl=document.getElementById('seqSide');
  if(bilateral){
    sideEl.classList.remove('hide');
    sideEl.textContent=isLeft?'← LEFT SIDE':'RIGHT SIDE →';
    sideEl.className='seq-side '+(isLeft?'left':'right');
  } else {
    sideEl.classList.add('hide');
  }
  updateSeqTimer();
  document.getElementById('seqCounter').textContent=`${index+1} of ${items.length}`;
```

The overlay itself fades in and out correctly ([index.html:390-391](../index.html),
`transition:opacity .3s`), so the entrance and exit are already handled. It is only the
*internal* transition between moves that teleports — and that is the one the user actually
watches, because they are holding a stretch and staring at the screen waiting for the next
instruction. A 32px headline and a two-line cue block swapping between frames is the single
most jarring content change in the app.

The card is also driven by a 1-second `setInterval` ([index.html:1464-1468](../index.html)),
so the transition happens on a predictable beat the user is already tracking.

**Gate record.** Frequency: occasional — a warmup or stretch run happens a few times a week and
steps through 6–12 moves. Purpose: *preventing a jarring change*. Speed: 180ms in, 120ms out —
well inside budget, and it must not delay the next move's timer. Function: this is instructional
content the user reads, so the motion must be a brief fade with minimal travel — no sliding
text that has to be tracked.

## Target

A short fade-and-settle on the card body when the move changes. The timer is excluded — it is a
number counting down every second and must never move.

```css
/* target — added to the base stylesheet next to the other .seq- rules */
  @keyframes seq-in{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:none;}}
  .seq-swap{animation:seq-in .18s var(--ease) both;}
  @media (prefers-reduced-motion:reduce){.seq-swap{animation:none;}}
```

Applied to a wrapper around the changing fields only:

- `#seqName` — the move name
- `#seqCues` — the cue text
- `#seqSide` — the left/right badge
- `#seqCounter` — the "3 of 8" line

Explicitly **not** applied to `#seqTimer`, `#seqFill`, or `#seqBtns`.

## Repo conventions to follow

- The replay idiom is `el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);`
  — see `tabIn()` at [index.html:6858-6862](../index.html) and the water cell flip at
  [index.html:4136](../index.html). Use it; without the forced reflow the animation will not
  restart on the second call.
- `--ease:cubic-bezier(.22,.9,.32,1)` at [index.html:37](../index.html).
- The `.seq-*` rules live together at [index.html:389-411](../index.html). Put the new rules
  there, not in the motion layer — this is base UI, and the motion layer is for effects that
  were appended later.
- The `.hide` utility is `display:none!important` ([index.html:359](../index.html)); the code
  toggles it on `#seqSide`. Do not fight that — an element going `display:none` simply will not
  animate, which is fine.

## Steps

1. **Read the markup first.** Read [index.html:949-975](../index.html) and record the exact
   structure of `#seqOverlay`. You need to know whether `#seqName`, `#seqCues`, `#seqSide` and
   `#seqCounter` share a common parent that excludes `#seqTimer` and `#seqBtns`.

   - If they do, use that element as the swap target.
   - If they do not, apply `.seq-swap` to each of the four elements individually in step 3.
     Do **not** restructure the markup to create a wrapper.

2. **Add the CSS.** Insert the three rules from the Target section after
   [index.html:408](../index.html) (the `.seq-btn:active` rule), keeping them with the other
   `.seq-*` rules.

3. **Trigger the swap.** In `renderSeqItem()`, immediately after
   [index.html:1456](../index.html) (the `seqCounter` assignment, which is the last of the
   content writes), add:

   ```js
     const swapEls = [document.getElementById('seqName'),document.getElementById('seqCues'),
                      document.getElementById('seqSide'),document.getElementById('seqCounter')];
     swapEls.forEach(el=>{ if(!el) return; el.classList.remove('seq-swap'); void el.offsetWidth; el.classList.add('seq-swap'); });
   ```

   If step 1 found a single shared wrapper, use it instead of the four-element array — one
   reflow is cheaper than four.

4. **Do not animate the first render.** `renderSeqItem()` is called once from
   `startSequence()` at [index.html:1428](../index.html), while the overlay itself is already
   fading in from [index.html:1424](../index.html). Two overlapping fades on the first move
   look muddy. Guard it: in `startSequence()`, set a flag before the call and check it in the
   swap code —

   ```js
   /* in startSequence(), replace index.html:1428 */
     seqState.firstRender=true;
     renderSeqItem();
   ```

   and in the step 3 block, wrap the `forEach` in
   `if(!seqState.firstRender){ … } seqState.firstRender=false;`

5. **Bump the cache version** in `service-worker.js` (increment `CACHE_VERSION`).

## Boundaries

- Do NOT animate `#seqTimer`. It is a countdown the user reads every second; moving it is the
  worst thing this plan could do.
- Do NOT animate `#seqFill` beyond its existing `transition:width .9s linear`
  ([index.html:400](../index.html)). A progress bar under a countdown is constant motion and
  `linear` is correct for it.
- Do NOT animate `#seqBtns` — the Next/Skip buttons must be tappable the entire time. A user
  cutting a stretch short must not have to wait for a fade.
- Do NOT delay `advanceSeq()` or the `setInterval` at
  [index.html:1464-1468](../index.html). The animation is decorative and runs alongside;
  the timer's behaviour must be byte-for-byte unchanged.
- Do NOT change the overlay's own fade at [index.html:390-391](../index.html).
- Do NOT restructure the markup at [index.html:949](../index.html).
- Do NOT add a slide direction. The moves are a list, not a spatial arrangement, and horizontal
  travel would imply a swipe gesture that does not exist.

## Verification

- **Mechanical**: `grep -c "seq-swap" index.html` returns 4 (keyframe, class rule,
  reduced-motion rule, JS). Page loads clean.
- **Feel check**: Training tab → open a day → tap "Start warmup".
  - Let the timer run out on a move. The next move's name and cues must fade up over ~180ms;
    the countdown number must **not** move or fade at any point.
  - Tap "Next →" mid-move. The swap must play immediately, and the next timer must start
    counting from its full value with no delay. Time it against a watch on a 30s move if in
    doubt.
  - Tap "Next →" rapidly several times. The animation must restart each time rather than
    playing only once — if it stops restarting, the `void el.offsetWidth` reflow is missing.
  - Run a bilateral move (one with a LEFT/RIGHT badge). The badge must fade in on the switch
    from left to right, and must disappear cleanly on a non-bilateral move.
  - Start a warmup and watch the very first move. The overlay fades in and the content must
    **not** double-fade on top of it.
  - Reach the end and confirm the done state still appears (`showSeqDone()`).
  - Turn on reduced motion and run a sequence: the moves must swap instantly, and the timer
    must still work.
- **Done when**: moves fade into each other, the countdown never moves, and the timer's timing
  is unchanged.

# AGENTS.md - src/

- `this.qs()` / `this.qsa()` come from `@substrate-system/web-component`'s
  `WebComponent` base class. `qsa` actually returns a real `NodeList`
  (`this.querySelectorAll(selector)`), but the package's `.d.ts` types it
  as returning a single element or `null` -- don't trust that typing.
  Use `Array.from(this.querySelectorAll<T>(selector))` when you need to
  iterate. Also always pass an explicit generic to `this.qs<T>(selector)`
  when you plan to call type-specific methods (e.g.
  `addEventListener('pointerdown', ...)`) on the result -- otherwise the
  inferred type is the generic `Element`, and `tsc` fails during
  `npm run build`'s `--emitDeclarationOnly` step (not during
  `esbuild`/tape-run) with a "No overload matches this call" error.
- For drag-style pointer interactions (see `crop.ts`), snapshot the
  *start* rect and pointer position on `pointerdown`, then always
  recompute the new rect from that snapshot plus the *total*
  `(current - start)` delta on each `pointermove`. Don't accumulate
  incremental per-event deltas onto the live rect -- it drifts.
- `setPointerCapture` calls should be wrapped in `try/catch`: synthetic
  `PointerEvent`s dispatched in tests don't correspond to a real active
  pointer session, and some environments throw when capture is
  requested for a pointer id with no active pointer.
- `image-input`'s drop-target box (`.box`) is a `<div>`, not the
  `<label>` -- `<button>` is labelable content, and a `<label>` may
  not contain labelable descendants other than its own control, so
  wrapping the whole box in a label would be invalid HTML once the
  overlay's edit/remove buttons are inside it. The `<label
  class="picker">` wraps only the `<input type="file">`, as a sibling
  layer inside `.box`, not the whole box. See
  `docs/tasks/drop-target.md` for the full rationale and remaining
  drag/drop/keyboard/CSS work built on top of this markup.
- The file input is hidden with a clip-path/absolute-position CSS
  trick (`src/index.css`), never `display:none`, `visibility:hidden`
  or the `hidden` attribute -- those three make the control
  unfocusable and stop the browser from reporting `required` on it.
- `clip-path: inset(50%)` also clips the element's hit-test region, not
  just its paint -- Playwright's ref-based `browser_click` on the raw
  `<input>` fails with "element intercepts pointer events" once this
  style applies. That's correct: only the wrapping `<label>` should be
  clickable by a mouse user. When verifying manually, open the picker
  with `input.click()` via `browser_evaluate` (or click the label/box
  at real coordinates), not a ref-click on the input itself.
- `.box.has-image .picker` is `position: absolute; inset: 0`, and
  `.preview` has `pointer-events: none` so a click on the `<img>` falls
  through to the label underneath it. `.overlay > *` already has
  `pointer-events: auto` (from the US-001 overlay work), and the
  overlay buttons paint after the label in DOM order, so ALT/edit/
  remove stay clickable without any `z-index`. The *empty* box has no
  in-flow content yet (no prompt/icon markup), so it still collapses to
  zero size and isn't meaningfully click-testable until that markup
  (and its in-flow-vs-absolute toggle) lands.
- `Object.values(record).find(f => ...)` (where `record` is
  `DropRecord`/`Record<string, File>` from `@substrate-system/
  drag-drop`) fails `tsc --emitDeclarationOnly` with `'f' is of type
  'unknown'` when chained directly, in this project's tsconfig
  (`strict: true` + `noImplicitAny: false` + the DOM/WebWorker lib
  combo). `Object.values`'s generic overload doesn't get matched, so it
  silently degrades to an `unknown[]`-returning overload instead of
  erroring outright. Fix: assign to an explicitly typed intermediate
  variable first -- `const files:File[] = Object.values(record)` --
  then call `.find`/etc. on that. This class of bug won't show up in
  `esbuild`/tape-run, only in the `tsc` build step.

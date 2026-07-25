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
- `#syncInputFiles(file:File)` writes a picked/dropped/cropped file
  into the native `<input>`'s `.files` so a surrounding `<form>` sees
  it: build a `new DataTransfer()`, `dt.items.add(file)`, then assign
  `input.files = dt.files` (a `FileList` cannot be constructed or
  assigned to directly). Wrap the `DataTransfer` construction in
  `try/catch` -- it is not constructible in every environment -- and
  let the emitted `image-input:change` carry the file regardless of
  whether the sync succeeded, since consumers should not depend on
  `input.files` alone.
- Neither `<dialog>` markup in `dialogs.ts` carries an `id`. `image-input`
  is a light-DOM component, so any `id` its markup used would leak into
  the page's global id space -- ten `<image-input>` elements on one page
  would produce ten duplicate `#alt-dialog`/`#crop-dialog` ids. Each
  dialog is labeled with `aria-label` instead of `aria-labelledby`, and
  the alt `<textarea>` relies on implicit labelling (it is its wrapping
  `<label>`'s own control), so no `for`/`id` pair is needed there either.
- `#getOrCreateCropEl()` in `index.ts` creates the `<image-crop>` element
  lazily, on the first `edit` click, rather than including it in the
  initial `render()` output. `ImageCrop.connectedCallback` sets up window
  listeners for its pointer-drag handles; creating one eagerly per
  `image-input` would mean idle listeners on every page that never opens
  the crop dialog. Once created, the element is left in `.crop-slot` and
  reused on subsequent opens rather than being torn down on close.
- The dialog buttons use one class per button per dialog
  (`.alt-cancel`/`.alt-save`, `.crop-cancel`/`.crop-save`) instead of a
  shared `.cancel`/`.save` pair. `this.qs()` only returns the first
  match (see the trap above) and both dialogs render into the same
  light-DOM subtree, so a shared class name would mean `this.qs('.save')`
  silently binds only the first dialog's button, leaving the other
  dialog's Save permanently unwired.
- The dialog open/close animation (`src/index.css`) uses
  `@starting-style` and `transition-behavior: allow-discrete`, both
  Baseline since 2024-08-06, so the entry fade/scale works in every
  current browser. The `overlay` value in `transition-property`, which
  keeps a closing dialog painted for the duration of its exit
  transition, is Chromium-only. Firefox and Safari therefore animate the
  open but close instantly -- that gap is a documented limitation of
  only specifying an entry animation, not a bug to fix here.
- `@substrate-system/drag-drop`'s `dragDrop(elem, listeners)` (used for
  the box's drop target) returns a cleanup function that removes all
  four of its listeners (`dragenter`/`dragover`/`dragleave`/`drop`) --
  call it in `disconnectedCallback`. It adds the class `drag` to the
  element itself on `dragenter` and removes it on `dragleave`/`drop`,
  so the drag-over border is pure CSS; do not add hand-written
  `dragenter`/`dragleave` handlers. Its `onDrop(record, ...)` callback
  is `async`, so tests dispatching a synthetic `drop` `DragEvent` must
  await a tick before asserting. `record` is `Record<string, File>`
  and covers files recursed out of a dropped *directory*; the raw
  `dataTransfer.files` does not, so scan `record`, not `files`.
- `#setFile(file:File|Blob, name?:string)` is the single place that
  normalizes every input path (pick, drop, `setImage()`) to a `File`
  and calls `#syncInputFiles`. A plain `Blob` (or a `File` passed with
  an explicit `name` override) gets wrapped with `new File([file],
  name ?? this.#deriveName(file.type), { type: file.type })` before
  anything else happens -- `#deriveName` must read `this.#file` (the
  *previous* file, for its base name) before `#setFile` overwrites
  `this.#file` with the new one. Because of this, `#file` is always a
  `File`, never a bare `Blob`, so callers/tests can assume
  `detail.file instanceof File` on every `image-input:change`/`:edit`/
  `:alt` event, even after a `setImage(croppedBlob)` call.

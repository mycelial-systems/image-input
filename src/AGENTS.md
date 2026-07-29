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
  `esbuild`/tapout) with a "No overload matches this call" error.
- For drag-style pointer interactions (see `crop.ts`), snapshot the
  *start* rect and pointer position on `pointerdown`, then always
  recompute the new rect from that snapshot plus the *total*
  `(current - start)` delta on each `pointermove`. Don't accumulate
  incremental per-event deltas onto the live rect -- it drifts.
- A pointer-drag surface must set `touch-action: none` in CSS or it
  simply does not work on a touchscreen. `.crop-rect` does. Without
  it the browser's gesture recognizer claims the drag as a page pan
  after a couple of pixels, fires `pointercancel`, and pans the page;
  `#handlePointerEnd` treats that cancel as the end of the drag, which
  is correct behavior on its part. `e.preventDefault()` in
  `pointerdown` does *not* prevent this. The declaration goes on
  `.crop-rect` rather than the frame because the effective value for a
  touch is the intersection of the hit element's with all its
  ancestors' -- so it covers the `.handle` children too, while leaving
  the dimmed area outside the rect free to pan the page. Keep the
  handles as descendants of `.crop-rect` or that coverage silently
  disappears. `test/crop.ts` asserts both halves; note this is only
  testable because `test/index.html` loads the real bundled stylesheet
  (built by `npm run build-tests`).
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
  `esbuild`/tapout, only in the `tsc` build step.
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
- Each dialog's Cancel/Save buttons sit in `<li>` wrappers inside the
  `<menu>`. `<menu>`'s content model is `li` plus script-supporting
  elements, and it maps to `role="list"`, so bare buttons make
  assistive tech announce a list with zero items. `src/index.css`
  turns the `<menu>` into an end-justified flex row with `padding: 0`
  and `list-style: none`, which is where the UA's 40px indent, block
  margin and markers get removed.
- `ImageCrop.setFile()` zeroes `#naturalWidth`, `#naturalHeight` and
  `#crop`, not just `#handleImageLoad`. The `<img>` load event is
  asynchronous, and `ImageInput.handleEdit` opens the crop dialog
  synchronously right after calling `setFile()`, so without the reset
  there is a real window in which Save is clickable while the crop
  rect still describes the *previous* image. `ctx.drawImage` with an
  undecoded image is a silent no-op, so that window used to produce a
  blank blob at stale dimensions and destroy the user's image.
  `getBlob()` rejects while `#naturalWidth` is 0, and
  `handleCropSave` catches that, leaves the dialog open, and reports
  through `debug()`. `handleCropSave` also holds a `#cropInFlight`
  boolean across its `await`, so a double Save click, or an Esc press
  mid-crop, cannot apply the crop twice or apply it to a dismissed
  dialog.
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
  and calls `#syncInputFiles`. It hands the promotion itself to
  `toFile()` in `src/file.ts`, but must read `this.#file?.name` (the
  *previous* file's name) in that same call, before reassigning
  `this.#file` to the new one -- `toFile()` falls back to that name
  when none is passed, so reading it after reassignment would name a
  cropped image after itself. Because of this, `#file` is always a
  `File`, never a bare `Blob`, so callers/tests can assume
  `detail.file instanceof File` on every `image-input:change`/`:edit`/
  `:alt` event, even after a `setImage(croppedBlob)` call.
- `src/html.ts` is the only place this package's markup is written.
  `ImageInput.render()` calls `html()` rather than keeping its own
  template. The two used to be separate copies and drifted: `html()`
  was still emitting a `.wrapper` div long after `render()` moved to
  `.box`/`.picker`/`.prompt`, so every stylesheet rule missed it.
  `test/index.ts`'s "render() and html() produce the same markup"
  test is what holds the two together -- do not delete it, and do not
  reintroduce a second template.
- `image-input:not(:defined, :has(.box))` in `src/index.css` hides an
  un-upgraded element only while it is empty. Server-rendered markup
  from `html()` contains a `.box`, so it stays visible before (or
  without) the custom element upgrading. Plain `:not(:defined)` would
  hide the whole static markup path, and `:empty` would not work
  because `<image-input>\n</image-input>` contains a whitespace text
  node. The combined `:not(a, b)` form is required by stylelint's
  `selector-not-notation` rule; it is De Morgan equivalent to
  `:not(:defined):not(:has(.box))`.
- `src/events.ts` is the single definition of the `image-input:*`
  events and their `detail` shapes (`ImageInputEventMap`). Both
  `ImageInput` and `ImageInputClient` dispatch that same set, which is
  why it lives in its own module rather than in either one. It emits no
  JS, so `index.ts` pulls it in with a *type-only* import -- that is
  still enough to activate its `declare global` augmentation of
  `HTMLElementEventMap` in a consumer's program, and it keeps a dead
  import of an empty module out of `dist/index.js`. When adding or
  changing an event, update the interface, the `declare global` block
  under it, and the README's Events section together.
- `ImageInput.on()`/`.off()` override the base class's with overloads
  keyed to `ImageInputEventMap`, so `el.on('change', ev => ...)` infers
  `ev`. Each one needs *two* overload signatures: the callback form and
  an `EventListenerObject` form. The base class declares both, a
  subclass's implementation signature is not part of its public type,
  and so a single-overload override is not assignable to the inherited
  member -- `tsc` rejects the whole class with TS2416 ("Property 'on'
  in type 'ImageInput' is not assignable to the same property in base
  type 'WebComponent'"). Note also that `noImplicitAny: false` in this
  project's tsconfig means a *failed* inference degrades silently to
  `any` instead of erroring, so a clean `tsc` run does not by itself
  prove these overloads work. Verify with a throwaway file that reads
  a bogus `detail` field and check that it errors.
- Every `ImageInput` method meant to be called from outside the
  component is written as a *static* taking the instance as its first
  argument, with a one-line instance method delegating to it
  (`clear()` calls `ImageInput.clear(this)`). The static holds the
  implementation, which is why it can touch `#file`/`#previewUrl` --
  private fields are reachable from a static method of the same class.
  Keep the pair in that direction: an instance method holding the body
  with a static that calls back into it would not survive being passed
  around without a `this` binding, which is the point of the static
  form (`els.forEach(ImageInput.clear)`). This applies to `setImage`
  and `clear`; it does not apply to `on`/`off` (overrides of the base
  class's, keyed to `ImageInputEventMap`) or to the lifecycle and
  `handleChange_*` callbacks the base class calls on an instance.
  `ImageInputClient` deliberately does not follow this -- it is
  constructed per host and always has an instance to hand.
- `clear()` does not emit `image-input:remove`, and must not start:
  that event means the user clicked the remove button. `handleRemove`
  calls `this.clear()` and then emits it. Code that calls `clear()`
  already knows it cleared the input; a consumer syncing its own state
  off `:remove` would otherwise see an event it caused itself.
- `src/file.ts` holds the Blob-to-File promotion both `ImageInput` and
  `ImageInputClient` use. Both must guarantee the file they hold is a
  `File`: `ImageCrop.setFile()` requires one, and consumers read
  `detail.file.name`. Don't copy the logic into either caller.

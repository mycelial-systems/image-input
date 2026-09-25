# Stored Image Source Implementation Plan -- Phase 6: `ImageInputClient` parity

**Goal:** Server-rendered markup wired by `ImageInputClient` behaves
like `<image-input>` for stored images, `edit()`, `required` and
errors.

**Architecture:** The client mirrors Phase 4 and Phase 5 with its own
DOM wiring. It shares the Phase 1 helpers rather than delegating to
`ImageInput`. The client has no reflected attributes, so it keeps a
private `#storedSrc` seeded from the rendered `<img src>` and exposes
`setSrc(url)`. It reads `required` intent from the input's
`data-required`, `nocrop`/`crop` from the host, and `crossorigin` from
the host or else the rendered `<img>`.

**Tech Stack:** TypeScript, tapzero.

**Scope:** Phase 6 of 7 from
`docs/design-plans/2026-09-24-src-attribute.md`

**Codebase verified:** 2026-09-24

---

## Acceptance Criteria Coverage

This phase implements and tests:

### src-attribute.AC7: `html()` and `ImageInputClient`
- **src-attribute.AC7.3 Success:** `ImageInputClient` over `html({src})` shows the image, and ALT opens the alt dialog with `alt` detail `{file:null, src, alt}`.
- **src-attribute.AC7.4 Success:** Client `setSrc(url)` drops a held file with no event. `setSrc(null)` empties the preview.
- **src-attribute.AC7.5 Success:** Client `edit()` meets AC3.1 to AC3.4.
- **src-attribute.AC7.6 Success:** The client emits `error` for `not-an-image` and `crop-failed`, and after Remove its input is `required` again when it was rendered with `data-required`.

---

## Codebase notes for the implementor

`src/client.ts` (312 lines) today:
- The constructor (lines 50-85) builds `#emit`, `#getAlt`, `#setAlt`
  and `#resetAlt`, then calls `#setup()`.
- `#qs` is at line 87. `#setup` (91-105) and `destroy` (115-132) attach
  and remove listeners.
- `#handleFileSelect` (134-143) silently ignores a non-image.
- `#handleRemove` is at 145-149. `#handleEdit` (151-178) needs a
  `#file`, emits `edit` with `{file}`, forwards the host's `crop`, calls
  `setFile`, and opens the dialog.
- `#handleAlt` (180-193) needs a `#file`.
- `#getOrCreateCropEl` is at 215-225. `#handleCropSave` (227-256) and
  `#handleCropCancel` (258-262) mirror `ImageInput`.
- `setImage` (268-271) emits `change` without `source`. `#setFile` is
  at 273-286, `clear` at 292-304, and `#revokePreviewUrl` at 306-311.
- The client has no drop handling, so its `change.source` is only
  `'pick'`, `'crop'` or `'api'`.
- Its imports are `toFile` from `./file.js`, `openDialog`/`closeDialog`,
  and `ImageCrop`.

Tests are in `test/client.ts`:
- `mount(className)` puts `html()` into a plain `<div>` host and
  constructs the client.
- `selectFile(host, file)` is also exported there.
- To test stored images, mount with options. Add a sibling helper or
  extend `mount` to take `ImageInputHtmlOptions` (for example
  `mount(className, opts = {})` passing `opts` to `html(opts)`). Keep
  the existing calls working.

Phase 5's pending-edit record and its stale-`close` guard apply here
unchanged. Read `src/index.ts` `static edit` and `#settleEdit` after
Phase 5 and mirror them.

---

<!-- START_SUBCOMPONENT_A (tasks 1-2) -->
<!-- START_TASK_1 -->
### Task 1: Client stored source, `setSrc`, `edit()`, errors

**Verifies:** src-attribute.AC7.3-AC7.6 (tested in Task 2)

**Files:**
- Modify: `src/client.ts` (imports, fields, constructor, handlers,
  `setImage`, `#setFile`, `clear`; new `setSrc`, `edit`, `#hasImage`,
  `#dropFile`, `#syncView`, `#settleEdit`, `#crossorigin`)

**Implementation:**

Imports:
`import { toFile, storedSrc, inputRequired, encodableType, guessType, cropName } from './file.js'`
(break it across lines to stay within 80 columns) and
`import type { ChangeSource } from './events.js'`.

Fields:
- `#storedSrc:string|null = null`
- `#renderedCrossorigin:string|null = null`: the preview img's
  `crossorigin` as rendered. It is captured once, because `#syncView`
  later writes that attribute itself.
- `#edit`, with the same shape as `ImageInput`'s: `promise`, `resolve`,
  `onClose`, `src` and `type`.

Constructor: before `#setup()`, seed the stored source from the
rendered markup:

```ts
const img = this.#qs<HTMLImageElement>('.preview img')
this.#storedSrc = storedSrc(img?.getAttribute('src'))
this.#renderedCrossorigin = img?.getAttribute('crossorigin') ?? null
```

Helpers:

```ts
/**
 * From the host, or else as the preview img was rendered. Not read
 * live from the img, since #syncView writes it: a host value, once
 * applied, could never be cleared.
 */
#crossorigin ():string|null {
    return this.host.getAttribute('crossorigin') ??
        this.#renderedCrossorigin
}

#hasImage ():boolean {
    return !!this.#file || this.#storedSrc !== null
}

#dropFile ():void {
    this.#revokePreviewUrl()
    this.#file = null
    const input = this.#qs<HTMLInputElement>('input')
    if (input) input.value = ''
}

#syncView ():void {
    const src = this.#previewUrl ?? this.#storedSrc
    const img = this.#qs<HTMLImageElement>('.preview img')
    if (img) {
        const crossorigin = this.#crossorigin()
        if (crossorigin == null) {
            img.removeAttribute('crossorigin')
        } else {
            img.setAttribute('crossorigin', crossorigin)
        }
        if (src === null) {
            img.removeAttribute('src')
        } else if (img.getAttribute('src') !== src) {
            img.setAttribute('src', src)
        }
    }
    const hasImage = src !== null
    this.#qs('.preview')?.classList.toggle('has-image', hasImage)
    this.#qs('.box')?.classList.toggle('has-image', hasImage)

    const input = this.#qs<HTMLInputElement>('input')
    if (input) {
        input.required = inputRequired(
            input.dataset.required !== undefined,
            this.#storedSrc !== null
        )
    }
}
```

Public `setSrc`:

```ts
/**
 * Show a stored image URL, or clear it with null (or ''). A non-empty
 * URL drops any held file. No event is emitted, and nothing is
 * fetched.
 */
setSrc (url:string|null):void {
    const src = storedSrc(url)
    if (src !== null) this.#dropFile()
    this.#storedSrc = src
    this.#syncView()
}
```

`#setFile(file, source:ChangeSource, name?)` mirrors Phase 4. It sets
the file and object URL, sets `this.#storedSrc = null`, calls
`#syncView()`, emits `change` with `{file, alt: this.#getAlt(), source}`,
and returns the file. Callers:
- `#handleFileSelect`: return if there is no file. For an image, call
  `#setFile(file, 'pick')`. For anything else,
  `this.#emit('error', { reason: 'not-an-image' })`.
- `setImage(blob, name?)`: `this.#setFile(blob, 'api', name)`.

`clear()`: `#dropFile()`, `#storedSrc = null`, `#syncView()`,
`#resetAlt()`.

`#handleAlt`: guard with `#hasImage()`. Emit
`{file: this.#file, src: this.#file ? null : this.#storedSrc, alt}`.

`edit():Promise<File|null>` mirrors `ImageInput.edit` from Phase 5,
with these differences:
- `nocrop` is `this.host.hasAttribute('nocrop')`, read live.
- `crop` is `this.host.getAttribute('crop')`.
- The src-only path sets `cropEl.crossorigin = this.#crossorigin()`,
  then `cropEl.src = src`.
- `edit` is emitted through `this.#emit('edit', {file, src})`.

The client reuses a pending edit only while the dialog is open, as in
Phase 5. If `#edit` is set but the dialog is closed, it calls
`#settleEdit(null)` and opens a fresh session. Do this first in
`edit()`, before the `nocrop` and has-image checks.

`#handleEdit` becomes `event.preventDefault(); this.edit()`.

`#handleCropCancel` calls `this.#settleEdit(null)` before
`closeDialog`, as in Phase 5.

`#settleEdit(file)` mirrors Phase 5.

`#handleCropSave` mirrors Phase 5, including the session guard after
the await:
`if (this.#edit !== pending || (dialog && !dialog.open)) return`.
It calls `getBlob({type: pending?.type})`. On rejection it runs
`this.#emit('error', { reason: 'crop-failed' })` and returns. On
success it takes the name from `cropName` when `pending.src` is set,
runs `this.#setFile(blob, 'crop', name)`, then `#settleEdit(file)`,
then `closeDialog`.

`destroy()`: also settle a pending edit with `null` (call
`this.#settleEdit(null)` before removing listeners), so a caller
awaiting `edit()` is not left hanging.

Update the class doc comment to mention stored images and `setSrc`.

**Verification:**
Run: `npm run lint && npm run build`
Expected: Succeeds.

**Commit:** `feat(client): stored src, setSrc, edit(), required, errors`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Client tests

**Verifies:** src-attribute.AC7.3-AC7.6

**Files:**
- Test: `test/client.ts` (browser integration)

**Testing:**
- AC7.3: mount `html({src: '/fixtures/photo.png'})`. `.box`/`.preview`
  have `has-image`. Click `.alt-badge`: `alt` detail deep-equals
  `{file: null, src: '/fixtures/photo.png', alt: ''}`, and `.alt-dialog`
  is open.
- AC7.4:
  - `selectFile` a file, then `client.setSrc('/fixtures/photo.png')`
    while recording `change`, `remove` and `alt-change`. No events
    fire, `input.files` is empty, and the preview src is the URL.
  - `client.setSrc(null)` removes `has-image` and the img `src`.
  - `client.setSrc('')` behaves like `null`.
- AC7.5 (mirror the Phase 5 tests at a smaller scale):
  - `edit()` on a file resolves the cropped `File` after `change` with
    `source: 'crop'`.
  - `edit()` on src-only emits `edit` with
    `{file: null, src: '/fixtures/photo.png'}`, and saving gives a file
    named `photo.png` of type `image/png`.
  - Cancel resolves `null`. So does the Esc path, simulated with
    `dialog.close()`. Do not dispatch a synthetic `cancel` event,
    because it does not close the dialog.
  - `edit()`, then `dialog.close()`, then `edit()` in the same tick:
    the first promise resolves `null`, the second is a new promise, and
    the dialog is open.
  - `nocrop` on the host, no image, or a canceled `edit` resolve
    `null`.
  - Calling twice while open returns the same promise. Exactly one
    `edit` event fires, and the dialog stays open.
  - In-flight Save across sessions (mirrors Phase 5): stub `getBlob`
    with a deferred promise, click Save, `dialog.close()`, then call
    `edit()` again, then resolve the deferred. The first promise
    resolves `null`, no `change` fires, and the second is still
    pending. Cancel it and remove the stub.
- AC7.6:
  - Picking a non-image (`new File(['x'], 'a.txt', {type: 'text/plain'})`
    through `selectFile`) emits `error` with `reason: 'not-an-image'`.
  - Stubbing `getBlob` on the crop instance to reject, then clicking
    Save, emits `error` with `reason: 'crop-failed'`, and the dialog
    stays open. Remove the stub afterwards with
    `Reflect.deleteProperty(cropEl, 'getBlob')`.
  - Mounting `html({required: true, src: '/fixtures/photo.png'})` gives
    `input.required === false`. Clicking `.remove` makes it `true`.
- `change` from a pick has `source: 'pick'`, and `setImage` has
  `source: 'api'`.

Existing client tests: `test/client.ts` has no `deepEqual` on event
details (verified), so none need changing for the new shapes.

**Verification:**
Run: `npm test`
Expected: Lint, build and all tests pass.

**Commit:** `test: ImageInputClient stored source and edit()`
<!-- END_TASK_2 -->
<!-- END_SUBCOMPONENT_A -->

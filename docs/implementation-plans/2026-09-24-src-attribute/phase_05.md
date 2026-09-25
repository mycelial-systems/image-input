# Stored Image Source Implementation Plan -- Phase 5: `ImageInput.edit()` and cropping a stored image

**Goal:** A public, awaitable crop step that works on a held file and
on a stored URL.

**Architecture:** A static `ImageInput.edit(el)` plus an instance
`edit()` hold one pending-edit record. The record carries the promise's
resolver, the dialog `close` listener, and the crop's source URL and
output type, fixed when the dialog opens. Save resolves the record with
the new `File` after `change` has been emitted. The dialog's `close`
event resolves it with `null`. A failed `getBlob()` emits `error` with
`crop-failed` and leaves the record pending. `handleEdit` just calls
`edit()`.

**Tech Stack:** TypeScript, tapzero.

**Scope:** Phase 5 of 7 from
`docs/design-plans/2026-09-24-src-attribute.md`

**Codebase verified:** 2026-09-24

---

## Acceptance Criteria Coverage

This phase implements and tests:

### src-attribute.AC2: Actions on a stored image, crop type and name
- **src-attribute.AC2.2 Success:** Edit on a src-only image hands the URL to `<image-crop>`. Saving emits `change` with `source:'crop'` and a `File` whose base name comes from the URL, and `src` is removed afterwards.

### src-attribute.AC3: `edit()` (`<image-input>`)
- **src-attribute.AC3.1 Success:** `edit()` opens the crop dialog, emits `edit` with `{file, src}`, and resolves with the cropped `File` after Save, once `change` with `source:'crop'` has been emitted.
- **src-attribute.AC3.2 Success:** `edit()` resolves `null` when the dialog closes without saving (Cancel or Esc).
- **src-attribute.AC3.3 Failure:** `edit()` resolves `null` without opening the dialog under `nocrop`, with no image, or when a listener cancels `edit`.
- **src-attribute.AC3.4 Edge:** Calling `edit()` while the dialog is open returns the same promise and does not reopen the dialog.
- **src-attribute.AC3.5 Success:** Clicking the Edit button behaves exactly as calling `edit()`.

### src-attribute.AC4: Crop failure
- **src-attribute.AC4.1 Failure:** When `getBlob()` rejects on Save, `error` is emitted with `reason:'crop-failed'`, the dialog stays open, the image is unchanged, and no `change` is emitted.
- **src-attribute.AC4.2 Edge:** A failed save does not settle `edit()`'s promise. A later Cancel resolves it `null`.

---

## Codebase notes for the implementor

- After Phase 4, `src/index.ts` has `#storedSrc()`, `#hasImage()`,
  `#syncView()`, and `#setFile(file, source, name?)`, which emits
  `change`.
- `handleEdit` (around former lines 235-263) checks `nocrop` and
  `#file`, emits `edit`, forwards the host's `crop` attribute to the
  cropper, calls `setFile`, and opens `.crop-dialog` with
  `openDialog()`.
- `handleCropSave` (around former lines 293-322) guards with
  `#cropInFlight`, awaits `getBlob()`, returns silently on a
  rejection, returns if the dialog closed during the await, and
  otherwise applies the blob and calls `closeDialog()`.
- `handleCropCancel` calls `closeDialog()`. Esc closes the modal
  natively.
- `openDialog(d)` is `if (!d.open) d.showModal()`, and `closeDialog(d)`
  is `d.close()` (`src/dialogs.ts:84-94`).
- A dialog's `close` event is queued as a task, not fired
  synchronously. A `close` from one session can therefore arrive after
  a new `edit()` has reopened the dialog. The listener ignores `close`
  while `dialog.open` is true, and it is removed when the edit
  settles, so a stale event cannot settle a newer edit.
- `ImageCrop` after Phase 2 reflects `crossorigin` and resets itself on
  a non-`setFile` `src`. `getBlob({type})` overrides the output type.
- File-based crops keep today's naming: `toFile(blob, undefined,
  prevName)` goes through `deriveName`. URL crops pass
  `cropName(src, blob.type)` as the name.
- Test pattern: see the "clicking .crop-save calls getBlob..." test in
  `test/index.ts` (around lines 983-1033). It uses `makeImageFile`,
  `waitForImageLoad(cropEl)`, and waits for `image-input:change`.
- The design allows stubbing one method for the failure path: set
  `getBlob` on the `<image-crop>` instance to
  `() => Promise.reject(new Error('tainted'))`. Nothing else is
  stubbed.

---

<!-- START_SUBCOMPONENT_A (tasks 1-2) -->
<!-- START_TASK_1 -->
### Task 1: `edit()` and the crop save/close flow

**Verifies:** src-attribute.AC2.2, src-attribute.AC3.1-AC3.5,
src-attribute.AC4.1-AC4.2 (tested in Task 2)

**Files:**
- Modify: `src/index.ts` (imports; new field, `static edit`, `edit`,
  and `#settleEdit`; `handleEdit`; `handleCropSave`)

**Implementation:**

Imports: add `encodableType`, `guessType` and `cropName` to the
`./file.js` import.

Field:

```ts
/**
 * The open crop session, if any. `type` and `src` are fixed when the
 * dialog opens, so a `src` change while it is open cannot mix one
 * image's type with another's name.
 */
#edit:{
    promise:Promise<File|null>
    resolve:(file:File|null) => void
    onClose:() => void
    src:string|null
    type:string|undefined
}|null = null
```

Static and instance methods (next to `setImage`/`clear`, following
their pattern and doc style):

```ts
/**
 * Open the crop step. Resolves with the cropped File after Save
 * (after `change` with `source:'crop'` has been emitted), or with
 * null when the dialog closes without saving. Resolves null at once
 * under `nocrop`, with no image, or when a listener cancels `edit`.
 * While the dialog is open, returns the pending promise.
 */
static edit (el:ImageInput):Promise<File|null> {
    const dialog = el.qs<HTMLDialogElement>('.crop-dialog')
    if (el.#edit) {
        // Reuse the session only while its dialog is open. `close` is
        // queued as a task, so code that closes the dialog and calls
        // edit() in the same tick must end the old session here and
        // open a new one.
        if (dialog?.open) return el.#edit.promise
        el.#settleEdit(null)
    }
    if (el.nocrop || !el.#hasImage()) return Promise.resolve(null)

    const file = el.#file
    const src = file ? null : el.#storedSrc()
    const notCanceled = el.emit('edit', { detail: { file, src } })
    if (!notCanceled) return Promise.resolve(null)

    const cropEl = el.#getOrCreateCropEl()
    if (!dialog || !cropEl) return Promise.resolve(null)

    if (el.crop == null) {
        cropEl.removeAttribute('crop')
    } else {
        cropEl.setAttribute('crop', el.crop)
    }
    if (file) {
        cropEl.setFile(file)
    } else if (src !== null) {
        // crossorigin before src, so the cropper's load and the
        // preview's load use one CORS mode
        cropEl.crossorigin = el.crossorigin
        cropEl.src = src
    }

    let resolve:(file:File|null) => void = () => {}
    const promise = new Promise<File|null>(res => { resolve = res })
    const onClose = () => {
        // a close queued by an earlier session can land after this
        // one reopened the dialog
        if (dialog.open) return
        el.#settleEdit(null)
    }
    el.#edit = {
        promise,
        resolve,
        onClose,
        src,
        type: src === null ? undefined : encodableType(guessType(src))
    }
    dialog.addEventListener('close', onClose)
    openDialog(dialog)
    return promise
}

edit ():Promise<File|null> {
    return ImageInput.edit(this)
}

#settleEdit (file:File|null):void {
    const pending = this.#edit
    if (!pending) return
    this.#edit = null
    this.qs('.crop-dialog')?.removeEventListener('close', pending.onClose)
    pending.resolve(file)
}
```

`handleEdit` delegates:

```ts
handleEdit = (event:Event) => {
    event.preventDefault()
    this.edit()
}
```

`handleCropCancel` settles right away rather than waiting for the
queued `close` event:

```ts
handleCropCancel = (event:Event) => {
    event.preventDefault()
    this.#settleEdit(null)
    const dialog = this.qs<HTMLDialogElement>('.crop-dialog')
    if (dialog) closeDialog(dialog)
}
```

The `close` listener still covers Esc, the backdrop, and a
programmatic `dialog.close()`.

The existing test "reopening the crop dialog reuses the existing
image-crop" (`test/index.ts:955-981`) calls `cropDialog.close()` and
then `editBtn.click()` in the same tick, and expects the dialog to be
open. The `dialog?.open` check above is what keeps that test passing.

`handleCropSave`: keep the structure and the comments. Change the
`getBlob` call, the catch, and the apply step:

```ts
const pending = this.#edit
let blob:Blob
try {
    blob = await cropEl.getBlob({ type: pending?.type })
} catch (err) {
    // Not decoded yet, or a tainted canvas (a cross-origin image
    // loaded without CORS). Leave the dialog open, the image
    // untouched, and edit() pending.
    debug('crop save failed', err)
    this.emit('error', { detail: { reason: 'crop-failed' } })
    return
} finally {
    this.#cropInFlight = false
}

// The dialog closing during the await means the user canceled. A
// changed session means that one was canceled and a new edit()
// opened meanwhile -- this blob belongs to neither.
if (this.#edit !== pending || (dialog && !dialog.open)) return

const name = pending?.src ?
    cropName(pending.src, blob.type) :
    undefined
const file = this.#setFile(blob, 'crop', name)
this.#settleEdit(file)
if (dialog) closeDialog(dialog)
```

`#setFile` emits `change` before `#settleEdit` resolves, and it removes
`src` (AC2.2).

`disconnectedCallback`: add `this.#settleEdit(null)` so that removing
the element while its dialog is open does not leave an `edit()` caller
hanging. No `close` event fires in that case. The client does the same
in `destroy()` (Phase 6).

Update the class and README-facing doc comments where `handleEdit` was
described, so they refer to `edit()`.

**Verification:**
Run: `npm run lint && npm run build`
Expected: Succeeds.

**Commit:** `feat: public edit() and crop of a stored image`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Tests for `edit()`, stored-image crop and crop failure

**Verifies:** src-attribute.AC2.2, src-attribute.AC3.1-AC3.5,
src-attribute.AC4.1-AC4.2

**Files:**
- Test: `test/index.ts` (browser integration)

**Testing** (reuse `makeImageFile`, `selectFile`, `waitForImageLoad`,
and the `/fixtures/photo.png` fixture):
- AC2.2 and plan test 12:
  1. Seed `src="/fixtures/photo.png"` and click `.edit`.
  2. The `image-crop` inside the dialog has
     `getAttribute('src') === '/fixtures/photo.png'`.
  3. `await waitForImageLoad(cropEl)`, click `.crop-save`, and await
     `change`.
  4. Check `detail.source === 'crop'`, `detail.file.name === 'photo.png'`,
     `detail.file.type === 'image/png'`, and
     `el.hasAttribute('src') === false`.
- Plan test 12 fallback: seed `src` with `imageDataUrl()` (no
  extension), crop and save. The file type is `image/jpeg`, and the
  name is `image.jpg`.
- AC3.1:
  1. `selectFile` a `makeImageFile(200, 100)` and record `edit`.
  2. `const p = el.edit()`. The dialog is open, and the `edit` detail
     has `file` equal to the held file and `src === null`.
  3. Wait for the load, record the order of `change` against the
     resolution of `p`, and click Save.
  4. `await p` gives a `File` equal to `change`'s `detail.file`, and
     `change` was recorded before `p` resolved.
- AC3.1 src-only: the `edit` detail deep-equals
  `{file: null, src: '/fixtures/photo.png'}`.
- AC3.2: `el.edit()`, then click `.crop-cancel`, resolves `null`. Do it
  again for the Esc path by calling `dialog.close()`, which is what Esc
  ends in; it resolves `null`. Do not dispatch a synthetic `cancel`
  event: it does not close a dialog, so the test would hang.
- AC3.2 stale close: `const p = el.edit()`, wait for the crop image to
  load, click `.crop-save`, `await p`, then immediately call
  `el.edit()` again. The second promise is still
  pending after the stale `close` task runs (await a `setTimeout(0)`),
  and the dialog is open. Then cancel it.
- In-flight Save across sessions:
  1. Open with `edit()` (promise `a`) and wait for the load.
  2. Stub `cropEl.getBlob` to return a deferred promise you resolve
     by hand.
  3. Click Save, then `dialog.close()`, then `const b = el.edit()`.
  4. Resolve the deferred with `imageBlob('image/png')`.
  5. `a` resolves `null`, no `change` fires, and `b` is still pending
     after a `setTimeout(0)`.
  6. Cancel `b`, and remove the stub with `Reflect.deleteProperty`.
- Close then edit in one tick: `const a = el.edit()`, then
  `dialog.close()`, then `const b = el.edit()`, all synchronously. `a`
  resolves `null`, `b !== a`, and the dialog is open. Cancel `b`, and
  it resolves `null`.
- AC3.3: each of these resolves `null` and leaves the dialog closed:
  - `nocrop` with an image.
  - No image.
  - A listener that calls `preventDefault()` on `image-input:edit`.
- AC3.4: `const a = el.edit(); const b = el.edit()` gives `a === b`.
  Only one `edit` event fires, and the dialog stays open.
- AC3.5: clicking `.edit` opens the dialog and emits `edit` with the
  same `{file, src}` detail as `edit()`. A following Save emits
  `change` with `source: 'crop'`.
- AC4.1:
  1. Open with `edit()` and wait for the load.
  2. Set `cropEl.getBlob = () => Promise.reject(new Error('tainted'))`.
  3. Click Save and await `error`. Its `reason` is `'crop-failed'`.
  4. The dialog is still open, the preview img src is unchanged, and
     no `change` fired.
- AC4.2: continuing from the above, the `edit()` promise is still
  pending (race it against a resolved sentinel after a `setTimeout(0)`).
  Click `.crop-cancel`, and it resolves `null`. Remove the instance
  stub afterwards (`Reflect.deleteProperty(cropEl, 'getBlob')`) so
  later tests see the prototype method.
- Plan test 12, unknown extension: Phase 1's unit tests cover
  `guessType('/a.bmp') === null` and `cropName(url, 'image/jpeg')`.
  The element-level fallback above uses a data URL. Together these
  cover "unknown extension -> `image/jpeg`, named `<base>.jpg`", with
  no extra fixture.

Known and accepted: reopening `edit()` on the same stored URL after a
Cancel keeps the crop rect from the canceled session. `ImageCrop`'s
`handleChange_src` returns early when the value is unchanged, so the
image is not reloaded. A `setFile` session always resets. FDR-006
records this (Phase 7).

Existing tests: none deep-equal the `edit` detail (verified), so none
need changing for the new shape. The existing "save before load" test
(around `test/index.ts:1082`) still passes, and Save now also emits
`crop-failed`.

**Verification:**
Run: `npm test`
Expected: Lint, build and all tests pass.

**Commit:** `test: edit() and stored-image crop`
<!-- END_TASK_2 -->
<!-- END_SUBCOMPONENT_A -->

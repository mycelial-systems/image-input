# Stored Image Source Implementation Plan -- Phase 4: `ImageInput` stored source

**Goal:** `<image-input>` shows, replaces and clears a stored image
with no events, and keeps `required` correct.

**Architecture:** `src` and `crossorigin` become reflected attributes.
One private `#syncView()` re-derives the preview `img` (crossorigin,
then src), `.has-image` on `.box`/`.preview`, and `input.required` from
`#file`, `#previewUrl`, `src` and `required`. Every transition in the
design's state table ends by calling it. `#setFile` takes a `source`,
removes `src`, and emits `change` itself, so no caller can forget the
`source` field. A `#connectedOnce` flag keeps a seeded `alt` from
emitting `alt-change`.

**Tech Stack:** TypeScript, `@substrate-system/web-component`,
tapzero.

**Scope:** Phase 4 of 7 from
`docs/design-plans/2026-09-24-src-attribute.md`

**Codebase verified:** 2026-09-24

---

## Acceptance Criteria Coverage

This phase implements and tests:

### src-attribute.AC1: Seeding and replacing a stored source (`<image-input>`)
- **src-attribute.AC1.1 Success:** Setting `src` shows the image (`.has-image` on `.box` and `.preview`, preview `img.src` is the URL) and emits no `change`, `alt-change` or `remove`.
- **src-attribute.AC1.2 Success:** After setting `src`, `input.files` is empty.
- **src-attribute.AC1.3 Success:** Setting `src` while a file is held drops the file: `input.files` is empty, the preview shows the URL, and no event is emitted.
- **src-attribute.AC1.4 Edge:** `src=""`, whether set as an attribute or as the property, shows no image.
- **src-attribute.AC1.5 Success:** Removing `src` with no file held empties the preview and emits nothing. Removing it while a file is held leaves the file preview in place.
- **src-attribute.AC1.6 Success:** Picking or dropping a file while `src` is set emits `change` with `source` `'pick'`/`'drop'`, shows the new preview, and removes the `src` attribute.
- **src-attribute.AC1.7 Success:** With `required` and a src-only image, the inner input is not `required`. After Remove or `clear()`, it is `required` again. Without `required` on the host, it is never `required`.
- **src-attribute.AC1.8 Success:** `crossorigin` on the host is applied to the preview `<img>` (`img.crossOrigin`).

### src-attribute.AC2: Actions on a stored image, crop type and name
- **src-attribute.AC2.1 Success:** ALT on a src-only image emits `alt` with `{file:null, src, alt}` and opens the alt dialog. Saving emits `alt-change` and no `change`.

### src-attribute.AC5: Event semantics
- **src-attribute.AC5.1 Success:** An `alt` present at parse time emits no `alt-change`, and the ALT badge still shows it.
- **src-attribute.AC5.2 Success:** Setting `alt` from code after connect emits `alt-change`.
- **src-attribute.AC5.3 Success:** `setImage()` emits `change` with `source:'api'`.

---

## Codebase notes for the implementor

Current `src/index.ts` (verify line numbers before editing, since Phase 3
touched line 20):
- Imports are at lines 1-18. `import { EXT, toFile } from './file.js'`
  is at line 12.
- Reflected attributes and declares are at lines 48-59. Private fields
  are at lines 76-79 (`#file`, `#previewUrl`, `#cleanupDrop`,
  `#cropInFlight`).
- `connectedCallback` (lines 131-135) runs `super.connectedCallback()`,
  which calls `render()` and replaces `innerHTML`, then
  `setupEventListeners()`.
- `setupEventListeners` is at lines 155-170. `handleChange_required`
  (lines 186-188) toggles `required` on the input.
- `handleChange_alt` (lines 199-212) updates the img alt and badge,
  then always emits `alt-change`.
- `handleFileSelect` (214-227) and `handleDrop` (330-341) call
  `#setFile(file)` and then emit `change` themselves, or emit `error`
  with `not-an-image`.
- `handleRemove` (229-233) is `clear()` followed by `emit('remove')`.
  `handleEdit` is at 235-263 (Phase 5 changes it). `handleAlt`
  (265-277) returns early when there is no `#file`.
- `handleCropSave` (293-322) calls `this.setImage(blob)`.
- `static setImage` (350-357) is `#setFile` plus an emit of `change`.
  `static clear` (374-386) revokes, nulls the file, empties the input
  value, removes the img src and `has-image`, and sets `alt = null`.
- `#setFile` is at 410-424, `#syncInputFiles` at 426-438,
  `#revokePreviewUrl` at 440-445, and `render()` at 447-456.
- `@substrate-system/web-component`: `attributeChangedCallback` fires
  for parse-time attributes before `connectedCallback`. At that point
  the element has no children, so `this.qs(...)` returns null.
  Reflected string setters remove the attribute on `null`/`undefined`
  and set it otherwise, including `''`. `removeAttribute` on an
  absent attribute fires no callback.
- `this.qs('img')` returns the first `<img>`, which is the preview (the
  crop dialog comes after `.box`). The new code uses
  `this.qs('.preview img')` to be explicit.
- Tests live in `test/index.ts`:
  - `selectFile(el, file)` (lines 489-495) sets `input.files` and
    dispatches `change`.
  - `waitFor(selector)` from `@substrate-system/dom` waits for the
    upgrade.
  - Elements are created with `insertAdjacentHTML`, using a unique
    class per test.
  - Serve stored images from `/fixtures/photo.png` (added in Phase 2)
    so they really load.
- Drops: existing tests (for example `test/index.ts:228-256`) build a
  `DataTransfer`, dispatch
  `new DragEvent('drop', {dataTransfer, bubbles: true, cancelable: true})`
  on `.box`, then `await new Promise(r => setTimeout(r, 0))`. Use the
  same steps.

---

<!-- START_SUBCOMPONENT_A (tasks 1-3) -->
<!-- START_TASK_1 -->
### Task 1: Reflect `src`/`crossorigin` and add `#syncView`

**Verifies:** src-attribute.AC1.1-AC1.5, src-attribute.AC1.7,
src-attribute.AC1.8 (tested in Task 3)

**Files:**
- Modify: `src/index.ts` (imports, reflected attributes, declares,
  fields, `handleChange_required`, new handlers and helpers, `clear`,
  `render`)

**Implementation:**

Imports: change line 12 to
`import { EXT, toFile, storedSrc, inputRequired } from './file.js'`.

Reflected attributes and declares:

```ts
static reflectedStringAttributes = [
    'accept', 'name', 'alt', 'label', 'crop', 'src', 'crossorigin'
]
// ...
declare src:string|null
declare crossorigin:string|null
```

Private helpers (put them next to `#revokePreviewUrl`):

```ts
/** The stored URL being shown, or null. '' counts as none. */
#storedSrc ():string|null {
    return storedSrc(this.src)
}

#hasImage ():boolean {
    return !!this.#file || this.#storedSrc() !== null
}

/** Forget the held file without touching `src`. */
#dropFile ():void {
    this.#revokePreviewUrl()
    this.#file = null
    const input = this.qs<HTMLInputElement>('input')
    if (input) input.value = ''
}

/**
 * Re-derive everything visible from state: the preview img
 * (crossorigin first, so both loads share one CORS mode), the
 * has-image classes, and the input's `required`. Every transition
 * ends here. A no-op before the first render.
 */
#syncView ():void {
    const src = this.#previewUrl ?? this.#storedSrc()
    const img = this.qs<HTMLImageElement>('.preview img')
    if (img) {
        if (this.crossorigin == null) {
            img.removeAttribute('crossorigin')
        } else {
            img.setAttribute('crossorigin', this.crossorigin)
        }
        if (src === null) {
            img.removeAttribute('src')
        } else if (img.getAttribute('src') !== src) {
            img.setAttribute('src', src)
        }
    }

    const hasImage = src !== null
    this.qs('.preview')?.classList.toggle('has-image', hasImage)
    this.qs('.box')?.classList.toggle('has-image', hasImage)

    const input = this.qs<HTMLInputElement>('input')
    if (input) {
        // keep the markup agreeing with html(): intent in
        // data-required, the effective rule in required
        input.toggleAttribute('data-required', this.required)
        input.required = inputRequired(
            this.required,
            this.#storedSrc() !== null
        )
    }
}
```

Attribute handlers (replace `handleChange_required`):

```ts
handleChange_required () {
    this.#syncView()
}

/**
 * A non-empty `src` replaces any held file, silently: a stored image
 * is never announced with `change`. An empty or removed `src` leaves
 * a held file alone.
 */
handleChange_src (_old:string|null, newValue:string|null) {
    if (storedSrc(newValue) !== null) this.#dropFile()
    this.#syncView()
}

handleChange_crossorigin () {
    this.#syncView()
}
```

`static clear` becomes:

```ts
static clear (el:ImageInput):void {
    el.#dropFile()
    el.removeAttribute('src')
    el.#syncView()
    el.alt = null
}
```

Update the doc comment on `clear` to say that it also removes `src`.

`render()` passes the stored source through:

```ts
render () {
    this.innerHTML = html({
        accept: this.accept,
        name: this.name,
        required: this.required,
        alt: this.alt,
        label: this.label ?? ImageInput.DEFAULT_LABEL,
        text: ImageInput.TEXT,
        src: this.#storedSrc(),
        crossorigin: this.crossorigin
    })
}
```

**Verification:**
Run: `npm run lint && npm run build`
Expected: Succeeds.

**Commit:** `feat: reflect src and crossorigin on image-input`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: `#setFile` with `source`, stored-image ALT, seeded `alt`

**Verifies:** src-attribute.AC1.6, src-attribute.AC2.1,
src-attribute.AC5.1-AC5.3 (tested in Task 3)

**Files:**
- Modify: `src/index.ts` (imports, `#setFile`, `handleFileSelect`,
  `handleDrop`, `static setImage`, `handleCropSave`, `handleAlt`,
  `handleChange_alt`, `connectedCallback`, new field)

**Implementation:**

`ChangeSource` is already imported from `./events.js` (Phase 3 Task
1). Do not add a second import.

`#setFile` sets state, drops `src`, syncs, and emits:

```ts
#setFile (
    file:File|Blob,
    source:ChangeSource,
    name?:string
):File {
    const asFile = toFile(file, name, this.#file?.name)

    this.#syncInputFiles(asFile)
    this.#revokePreviewUrl()
    this.#file = asFile
    this.#previewUrl = URL.createObjectURL(asFile)
    // The file replaces a stored image. #file is already set, so
    // handleChange_src keeps it.
    this.removeAttribute('src')
    this.#syncView()

    this.emit('change', {
        detail: { file: asFile, alt: this.alt ?? '', source }
    })
    return asFile
}
```

Callers:
- `handleFileSelect`: replace `this.#setFile(file)` plus its emit with
  `this.#setFile(file, 'pick')`.
- `handleDrop`: `this.#setFile(file, 'drop')`.
- `static setImage(el, blob, name?)`: `el.#setFile(blob, 'api', name)`.
- `handleCropSave`: it currently calls `this.setImage(blob)`. Change it
  to `this.#setFile(blob, 'crop')`. Phase 5 reworks this handler.

`handleAlt` works for a stored image too:

```ts
handleAlt = (event:Event) => {
    event.preventDefault()
    if (!this.#hasImage()) return
    const notCanceled = this.emit('alt', {
        detail: {
            file: this.#file,
            src: this.#file ? null : this.#storedSrc(),
            alt: this.alt ?? ''
        }
    })
    if (!notCanceled) return
    // ...rest unchanged
}
```

Seeded `alt`: add a `#connectedOnce = false` field. Set it to `true` as
the last line of `connectedCallback`. In `handleChange_alt`, guard only
the emit:

```ts
// An alt present at parse time (or set before the element is
// connected) is initial state, not a change.
if (this.#connectedOnce) {
    this.emit('alt-change', { detail: { alt: newValue ?? '' } })
}
```

The badge and img updates stay unconditional. Before the first render
they are no-ops, and `render()` writes the seeded alt through `html()`.

**Verification:**
Run: `npm run lint && npm run build`
Expected: Succeeds.

**Commit:** `feat: change source, stored-image alt, quiet seeded alt`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Tests for the stored source on `<image-input>`

**Verifies:** src-attribute.AC1.1-AC1.8, src-attribute.AC2.1,
src-attribute.AC5.1-AC5.3

**Files:**
- Test: `test/index.ts` (browser integration; add a block of tests
  near the existing `setImage`/`clear` tests)

**Testing.** Each test uses its own element class. Record events with
listeners added before the action. "No event" means the recorded list
is still empty after the action and one `await` of a resolved promise
(or a `requestAnimationFrame`).

Use `const URL1 = '/fixtures/photo.png'`.

- AC1.1: insert `<image-input>` and wait for the upgrade, then set
  `el.src = URL1`. `.box` and `.preview` have `has-image`, and the
  preview `img.getAttribute('src') === URL1`. No `change`,
  `alt-change` or `remove` fires.
- AC1.1 seeded: create a fresh container `<div>`, append it to the
  body, and attach `image-input:change`, `image-input:alt-change` and
  `image-input:remove` listeners to it. Then `insertAdjacentHTML` a
  `<image-input src="/fixtures/photo.png">` into the container. The
  image shows after the upgrade, and none of those events fire. Do not
  listen on `document.body`, because earlier tests leave elements and
  listeners there.
- AC1.2: after the above, `input.files?.length ?? 0` is 0.
- AC1.3: `selectFile(el, imageFile('a.png', 'image/png'))`, then set
  `el.src = URL1` while recording events. `input.files` is empty, the
  preview src is URL1, and no events fire.
- AC1.4: `el.setAttribute('src', '')` gives no `has-image` and no img
  `src`. The same holds for `el.src = ''`.
- AC1.5: with only src, `el.src = null` removes `has-image` and the img
  src, with no events.
- AC1.5 and AC1.4 with a file held: `selectFile` a file. Picking has
  already removed `src`, so first set `el.src = ''`. That fires
  `handleChange_src` with an empty value, and the file must be kept:
  `has-image` stays, the preview src still starts with `blob:`, and
  `input.files` still holds the file. Then call
  `el.removeAttribute('src')` and assert the same things again. No
  events fire.
- Behavior test 6 (Remove on a stored image): seed
  `src="/fixtures/photo.png"` and click `.remove`. Then:
  - `image-input:remove` fires.
  - `.box` and `.preview` lose `has-image`.
  - The preview img has no `src` attribute.
  - `el.hasAttribute('src') === false`.
- AC1.6: with `src` set, `selectFile` emits `change` with
  `source === 'pick'`, `el.hasAttribute('src') === false`, and a
  preview src starting with `blob:`. Repeat with a drop, expecting
  `source === 'drop'`.
- AC1.7:
  - `<image-input required>` with `el.src = URL1` gives
    `input.required === false`, and the input has `data-required`.
  - After clicking `.remove`, `input.required === true`.
  - Set src again and call `el.clear()`: `input.required === true`.
  - `<image-input>` with no `required`: the input is never `required`,
    whether src is set or not.
- AC1.8: `<image-input crossorigin="anonymous">` with src set gives a
  preview `img.crossOrigin === 'anonymous'`.
- AC2.1: src-only, then click `.alt-badge`. `alt` fires with detail
  deep-equal to `{file: null, src: URL1, alt: ''}`, and the
  `.alt-dialog` is open. Type into the textarea and click `.alt-save`:
  `alt-change` fires and `change` does not.
- AC5.1: `<image-input alt="seeded" src="/fixtures/photo.png">`
  inserted into a container that has an `image-input:alt-change`
  listener attached before the insert emits no `alt-change`, and
  `.alt-badge` has `has-alt`.
- AC5.2: after connect, `el.alt = 'x'` emits `alt-change` with
  `{alt: 'x'}`.
- AC5.3: `el.setImage(imageBlob('image/png'))` emits `change` with
  `source === 'api'`.

**Update existing tests:**
- `test/index.ts:691` asserts `Object.keys(detail).sort()` equals
  `['alt', 'file']`. That test is about the detail's shape, so update
  the expected list to `['alt', 'file', 'source']`.
- No other existing test needs changing (verified). The remaining
  `deepEqual`s at `test/index.ts:410, 437` (error detail) and
  `:648, 672` (alt-change detail) compare shapes this feature leaves
  unchanged. No existing test expects `alt-change` for a parsed
  `alt`.

**Verification:**
Run: `npm test`
Expected: Lint, build and all tests pass.

**Commit:** `test: stored src on image-input`
<!-- END_TASK_3 -->
<!-- END_SUBCOMPONENT_A -->

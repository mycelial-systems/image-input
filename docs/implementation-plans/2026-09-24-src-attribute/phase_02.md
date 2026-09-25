# Stored Image Source Implementation Plan -- Phase 2: `<image-crop>` and `cropDialog`

**Goal:** The cropper handles cross-origin sources and resets its state
when it switches from a file to a URL. `cropDialog` learns
`crossorigin` and guesses a URL's output type.

**Architecture:** `ImageCrop` reflects `crossorigin` and applies it to
its inner `<img>` before `src`. `handleChange_src` performs the same
reset `setFile` does whenever the new `src` is not the object URL
`setFile` just created. `cropDialog` forwards `crossorigin` and passes
`encodableType(guessType(url))` to `getBlob` for string sources.
This phase also switches the test runner to a served HTML page, so
tests can load real image URLs with a file extension.

**Tech Stack:** TypeScript, `@substrate-system/web-component`,
tapzero, and tapout (`--html` mode).

**Scope:** Phase 2 of 7 from
`docs/design-plans/2026-09-24-src-attribute.md`

**Codebase verified:** 2026-09-24

---

## Acceptance Criteria Coverage

This phase implements and tests:

### src-attribute.AC6: `<image-crop>` and `cropDialog`
- **src-attribute.AC6.1 Success:** With `crossorigin` set, the inner `<img>` has `crossOrigin` applied when `src` is set, and after `render()`.
- **src-attribute.AC6.2 Edge:** Switching a cropper from `setFile()` to a `src` URL makes `crop` read `{0,0,0,0}` and `getBlob()` reject until the new image fires `load`.
- **src-attribute.AC6.3 Success:** `cropDialog(url, {crossorigin})` sets `crossorigin` on its `<image-crop>`. For a `.png` URL with no explicit `type`, it resolves a `image/png` blob.

---

## Codebase notes for the implementor

- `src/crop.ts`:
  - `static reflectedStringAttributes = ['src']` and
    `declare src:string|null` are at lines 85-86.
  - The private fields `#file`, `#objectUrl`, `#naturalWidth`,
    `#naturalHeight` and `#crop` are at lines 102-106.
  - `handleChange_src` (lines 148-151) currently only does
    `img.src = newValue ?? ''`.
  - `setFile` (lines 205-213) revokes the old URL, sets `#file`,
    zeroes the sizes and rect, creates `#objectUrl`, then sets
    `this.src = this.#objectUrl`. That set runs `handleChange_src`
    synchronously with `newValue === this.#objectUrl`.
  - `getBlob` (lines 237-262) rejects while `#naturalWidth` is 0. Its
    default type is `encodableType(this.#file?.type)`.
  - `#revokeObjectUrl` is at lines 553-558. `render()` (lines 560-579)
    writes `<img src="${escapeAttr(this.src ?? '')}" alt="" />`.
  - `#handleImageLoad` (lines 264-308) sets the sizes and rect, then
    emits `image-crop:load`.
- `@substrate-system/web-component`: a reflected string setter removes
  the attribute for `null`/`undefined` and sets it otherwise.
  `attributeChangedCallback` calls `handleChange_<name>(old, new)`,
  including for attributes present at parse time and before
  `connectedCallback`. `connectedCallback` calls `render()`, which
  replaces `innerHTML`.
- `'crossorigin'` is not a property of `HTMLElement.prototype`, so the
  base class will define the reflected accessor. (The `<img>` property
  is the camel-case `crossOrigin`.)
- `src/crop-dialog.ts` (whole file, 110 lines):
  - `CropDialogOptions` is at lines 9-14.
  - A string source is set with `crop.setAttribute('src', source)` at
    line 61.
  - Save calls `crop.getBlob()` with no options at line 90.
  - The markup helper takes `Required<Omit<CropDialogOptions, 'crop'>>`
    at line 18. Adding an optional `crossorigin` field means it must be
    omitted there too.
- Test runner: `tapout` serves only its own runner page unless given
  `--html <file>`. With that flag it serves the file at `/` and
  statically serves files next to it (root = that file's directory),
  and it injects its harness script before `</body>`. `test/` already
  contains `cinnamon-roll.jpg` (100 KB).
- Test helpers: `waitForImageLoad(el)` in `test/helpers.ts` resolves on
  `image-crop:load`, or at once if `el.crop.width` is already non-zero.
  `makeImageFile(w, h)` gives a decodable File. `imageDataUrl()` in
  `test/fixture.ts` gives a data URL of the JPEG fixture.

---

<!-- START_TASK_1 -->
### Task 1: Serve static test fixtures

**Verifies:** None (infrastructure)

**Files:**
- Create: `test/index.html`
- Create: `test/fixtures/photo.png` (binary)
- Modify: `package.json` script `test-tapout`

**Step 1: Create the HTML page**

`test/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>image-input tests</title>
</head>
<body>
</body>
</html>
```

**Step 2: Create a real PNG fixture**

Run (macOS `sips`, a one-time generation step):

```bash
mkdir -p test/fixtures
sips -s format png -Z 240 test/cinnamon-roll.jpg \
    --out test/fixtures/photo.png
file test/fixtures/photo.png
```

Expected: `PNG image data, 240 x ...`

**Step 3: Point the runner at the page**

In `package.json`, change `test-tapout` to:

```
"test-tapout": "cat test/test-bundle.js | tapout --timeout 60000 --html test/index.html | tap-spec"
```

**Step 4: Verify operationally**

Run: `npm run build-tests && npm run test-tapout`
Expected: The existing suite passes unchanged.

**Step 5: Commit**

```bash
git add test/index.html test/fixtures/photo.png package.json
git commit -m "test: serve static fixtures through tapout --html"
```
<!-- END_TASK_1 -->

<!-- START_SUBCOMPONENT_A (tasks 2-3) -->
<!-- START_TASK_2 -->
### Task 2: `ImageCrop` `crossorigin` and the reset on a URL `src`

**Verifies:** src-attribute.AC6.1, src-attribute.AC6.2

**Files:**
- Modify: `src/crop.ts:85-86` (reflected attributes, declares)
- Modify: `src/crop.ts:148-151` (`handleChange_src`)
- Modify: `src/crop.ts:560-579` (`render`)
- Test: `test/crop.ts` (browser integration)

**Implementation:**

```ts
static reflectedStringAttributes = ['src', 'crossorigin']
declare src:string|null
declare crossorigin:string|null
```

Add a private helper. It uses an attribute rather than the property,
so `null` removes it cleanly:

```ts
#applyCrossOrigin (img:HTMLImageElement):void {
    if (this.crossorigin == null) {
        img.removeAttribute('crossorigin')
    } else {
        img.setAttribute('crossorigin', this.crossorigin)
    }
}
```

Replace `handleChange_src`:

```ts
handleChange_src (old:string|null, newValue:string|null) {
    if (newValue === old) return
    // Anything but the object URL setFile() just made means a new
    // image from outside: forget the old file, its object URL, and
    // its size and rect, exactly as setFile() does, so crop and
    // getBlob() cannot report the previous image.
    if (newValue !== this.#objectUrl) {
        this.#revokeObjectUrl()
        this.#file = null
        this.#naturalWidth = 0
        this.#naturalHeight = 0
        this.#crop = { x: 0, y: 0, width: 0, height: 0 }
    }
    const img = this.qs<HTMLImageElement>('img')
    if (!img) return
    this.#applyCrossOrigin(img)
    img.src = newValue ?? ''
}

handleChange_crossorigin () {
    const img = this.qs<HTMLImageElement>('img')
    if (img) this.#applyCrossOrigin(img)
}
```

In `render()`, write the attribute before `src` in the `<img>` tag:

```ts
const crossorigin = this.crossorigin == null ?
    '' :
    ` crossorigin="${escapeAttr(this.crossorigin)}"`
// ...
<img${crossorigin} src="${src}" alt="" />
```

**Testing** (`test/crop.ts`; follow the existing tests there):
- AC6.1, set after connect: create `<image-crop crossorigin="anonymous">`,
  append it, set `src` to `/fixtures/photo.png`, and assert that the
  inner `img.crossOrigin === 'anonymous'`.
- AC6.1, after render: create the element, set `crossorigin` before
  appending, append it (`connectedCallback` renders), and assert the
  same. Also assert that removing the attribute (`el.crossorigin = null`)
  clears `img.crossOrigin` (null).
- AC6.2:
  1. `setFile(await makeImageFile(200, 100))`, then
     `await waitForImageLoad(el)`, and assert `crop.width > 0`.
  2. Set `el.src = '/fixtures/photo.png'`. Assert that `el.crop` deep
     equals `{x:0, y:0, width:0, height:0}` and that `el.getBlob()`
     rejects.
  3. Await the next `image-crop:load` (use `waitForImageLoad`, which
     now waits because the width is 0). Assert `crop.width > 0` and
     that `getBlob()` resolves.

**Verification:**
Run: `npm run lint && npm run build-tests && npm run test-tapout`
Expected: All tests pass.

**Commit:** `feat(crop): reflect crossorigin and reset state on URL src`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: `cropDialog` `crossorigin` option and guessed type

**Verifies:** src-attribute.AC6.3

**Files:**
- Modify: `src/crop-dialog.ts:3-14` (imports, options type)
- Modify: `src/crop-dialog.ts:18` (markup param type)
- Modify: `src/crop-dialog.ts:59-61, 90` (source handling, `getBlob`)
- Test: `test/crop-dialog.ts` (browser integration)

**Implementation:**
- Import `encodableType` and `guessType` from `./file.js` next to
  `toFile`.
- Add `crossorigin?:string` to `CropDialogOptions`. It is documented as
  forwarded to the `<image-crop>` so the image loads in CORS mode.
- Change the markup parameter type to
  `Required<Omit<CropDialogOptions, 'crop'|'crossorigin'>>`.
- Before loading the source, write the attribute:
  `if (options.crossorigin !== undefined) crop.setAttribute('crossorigin', options.crossorigin)`.
  It must come before `src` is set.
- Compute the output type once, when the dialog opens:

  ```ts
  const type = typeof source === 'string' ?
      encodableType(guessType(source)) :
      undefined
  ```

  Pass it to `crop.getBlob({ type })` in `save`. For File and Blob
  sources `type` stays `undefined`, so `getBlob` keeps its current
  default (the file's own encodable type).

**Testing** (`test/crop-dialog.ts`; follow `lastDialog()` and the
existing cancel pattern):
- AC6.3, crossorigin: `cropDialog('/fixtures/photo.png', {crossorigin: 'anonymous'})`.
  Assert that the dialog's `image-crop` has
  `getAttribute('crossorigin') === 'anonymous'`, then cancel.
- AC6.3, type: `cropDialog('/fixtures/photo.png')`. Wait for the crop
  to load (`waitForImageLoad` from `./helpers.js`), click `.crop-save`,
  and assert that the resolved blob's `type === 'image/png'`.
- Also cover the fallback: `cropDialog(imageDataUrl())` resolves a
  `image/jpeg` blob, since there is no extension to guess from.

**Verification:**
Run: `npm run lint && npm run build && npm run build-tests && npm run test-tapout`
Expected: All tests pass.

**Commit:** `feat(crop-dialog): crossorigin option and URL type guess`
<!-- END_TASK_3 -->
<!-- END_SUBCOMPONENT_A -->

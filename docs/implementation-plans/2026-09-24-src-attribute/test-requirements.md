# Stored Image Source -- Test Requirements

Maps every acceptance criterion in
`docs/design-plans/2026-09-24-src-attribute.md` to automated tests or
documented human verification. Phase and task numbers refer to
`phase_01.md` through `phase_07.md` in this directory.

## Test infrastructure

- **Framework:** `@substrate-system/tapzero`. Tests are bundled by
  esbuild into `test/test-bundle.js`. `test/index.ts` is the single
  bundle entry and imports `test/file.ts`, `test/crop.ts`,
  `test/crop-dialog.ts`, `test/html.ts` and `test/client.ts`.
- **Runner:** `tapout` in a headless browser. Phase 2 Task 1 switches
  it to `tapout --timeout 60000 --html test/index.html`, so files next
  to `test/index.html` are served statically. Tests load a real
  decodable PNG from `/fixtures/photo.png`
  (`test/fixtures/photo.png`, generated once from
  `test/cinnamon-roll.jpg`). This is what lets the element tests use a
  URL with a real `.png` extension, and lets `guessType` run on a real
  load path instead of a data URL.
- **Test types used below:**
  - **unit** -- pure functions or parsed markup, run in the browser
    bundle with no element lifecycle (`test/file.ts`, `test/html.ts`).
  - **integration** -- custom elements, dialogs, real image decode and
    canvas encode in the browser (`test/crop.ts`,
    `test/crop-dialog.ts`, `test/index.ts`, `test/client.ts`).
- **Stubbing:** exactly one method is stubbed: `getBlob` on an
  `<image-crop>` instance, to force the `crop-failed` path or to hold
  a Save in flight. Stubs are removed with
  `Reflect.deleteProperty(cropEl, 'getBlob')` so later tests see the
  prototype method. Everything else uses real fixtures
  (`makeImageFile`, `imageFile`, `imageBlob`, `imageDataUrl`).
- **Esc:** tests simulate Esc with `dialog.close()`, which is what a
  native Esc ends in. A synthetic `cancel` event does not close a
  dialog, so it is never dispatched.
- **"No event"** means a recorder attached before the action is still
  empty after the action plus one `await` (resolved promise,
  `setTimeout(0)` or `requestAnimationFrame`). Seeded-markup tests
  listen on a fresh container, not `document.body`.
- **No brittle assertions:** markup is checked through DOM queries on
  parsed output, never by matching strings.

Commands: `npm run build-tests && npm run test-tapout` for the suite,
`npm test` for lint, build and tests.

## Automated tests

Columns: criterion; type; file; phase/task that creates the test; what
the test asserts.

### src-attribute.AC1: Seeding and replacing a stored source

| Criterion | Type | File | Phase/Task | Asserts |
|---|---|---|---|---|
| src-attribute.AC1.1 | integration | test/index.ts | P4 T3 | `el.src = URL1` adds `has-image` to `.box`/`.preview`, preview img `src` is URL1, no `change`/`alt-change`/`remove`. |
| src-attribute.AC1.1 (seeded) | integration | test/index.ts | P4 T3 | `<image-input src=...>` inserted into a listening container shows the image and fires none of the three events. |
| src-attribute.AC1.2 | integration | test/index.ts | P4 T3 | After setting `src`, `input.files` length is 0. |
| src-attribute.AC1.3 | integration | test/index.ts | P4 T3 | With a picked file held, `el.src = URL1` empties `input.files`, shows URL1, emits nothing. |
| src-attribute.AC1.4 (rule) | unit | test/file.ts | P1 T2 | `storedSrc('')`, `null`, `undefined` are `null`; a non-empty string is returned unchanged. |
| src-attribute.AC1.4 | integration | test/index.ts | P4 T3 | `setAttribute('src', '')` and `el.src = ''` each give no `has-image` and no img `src`. |
| src-attribute.AC1.4 (file held) | integration | test/index.ts | P4 T3 | `el.src = ''` with a file held keeps `has-image`, a `blob:` preview and `input.files`. |
| src-attribute.AC1.5 | integration | test/index.ts | P4 T3 | `el.src = null` on a src-only image removes `has-image` and img `src`, with no events. |
| src-attribute.AC1.5 (file held) | integration | test/index.ts | P4 T3 | `removeAttribute('src')` with a file held keeps the `blob:` preview and the file, with no events. |
| src-attribute.AC1.6 (pick) | integration | test/index.ts | P4 T3 | `selectFile` with `src` set emits `change` `source:'pick'`, removes `src`, preview starts with `blob:`. |
| src-attribute.AC1.6 (drop) | integration | test/index.ts | P4 T3 | A `DragEvent('drop')` on `.box` with `src` set emits `change` `source:'drop'` and removes `src`. |
| src-attribute.AC1.7 (rule) | unit | test/file.ts | P1 T2 | `inputRequired(true,false)` is true, `(true,true)` false, `(false,*)` false. |
| src-attribute.AC1.7 | integration | test/index.ts | P4 T3 | `required` host with `src`: input not `required`, has `data-required`; after `.remove` and after `clear()` it is `required`; no host `required` -> never `required`. |
| src-attribute.AC1.8 | integration | test/index.ts | P4 T3 | `crossorigin="anonymous"` host with `src` gives preview `img.crossOrigin === 'anonymous'`. |

### src-attribute.AC2: Actions on a stored image, crop type and name

| Criterion | Type | File | Phase/Task | Asserts |
|---|---|---|---|---|
| src-attribute.AC2.1 | integration | test/index.ts | P4 T3 | `.alt-badge` on src-only emits `alt` deep-equal `{file:null, src:URL1, alt:''}`, opens `.alt-dialog`; `.alt-save` emits `alt-change`, no `change`. |
| src-attribute.AC2.2 | integration | test/index.ts | P5 T2 | Edit on seeded `/fixtures/photo.png` gives the cropper that `src`; Save emits `change` `source:'crop'`, file `photo.png`, type `image/png`, `src` removed. |
| src-attribute.AC2.3 | unit | test/file.ts | P1 T2 | `guessType` maps png/PNG/jpg/jpeg/webp/gif/avif; ignores `?query#frag`; works cross-host; `null` for no ext, `.bmp` and `data:`. |
| src-attribute.AC2.4 | unit | test/file.ts | P1 T2 | `cropName('/assets/post/abc.png', 'image/png')` is `abc.png`; with `image/jpeg` it is `abc.jpg`. |
| src-attribute.AC2.4 (property) | unit | test/file.ts | P1 T2 | ~200 seeded LCG-generated URLs x each `CANVAS_TYPES` type: name ends in `.` + `EXT[type]` with a non-empty stem. |
| src-attribute.AC2.5 | unit | test/file.ts | P1 T2 | `cropName('https://example.com/', 'image/webp')` is `image.webp`; a `data:` URL with `image/png` is `image.png`. |
| src-attribute.AC2.6 | unit | test/file.ts | P1 T2 | Adding `ImageInput.EXT['image/bmp'] = 'bmp'` makes `guessType('/a.bmp')` `image/bmp`; key deleted in `finally`. |

### src-attribute.AC3: `edit()` on `<image-input>`

| Criterion | Type | File | Phase/Task | Asserts |
|---|---|---|---|---|
| src-attribute.AC3.1 (file) | integration | test/index.ts | P5 T2 | `edit()` opens the dialog, emits `edit` `{file, src:null}`; after Save the promise resolves the same `File` as `change`, and `change` came first. |
| src-attribute.AC3.1 (src-only) | integration | test/index.ts | P5 T2 | `edit` detail deep-equals `{file:null, src:'/fixtures/photo.png'}`. |
| src-attribute.AC3.2 (Cancel) | integration | test/index.ts | P5 T2 | `.crop-cancel` resolves `edit()` with `null`. |
| src-attribute.AC3.2 (Esc path) | integration | test/index.ts | P5 T2 | `dialog.close()` resolves `edit()` with `null` (real keypress: see human verification). |
| src-attribute.AC3.2 (stale close) | integration | test/index.ts | P5 T2 | After a Save, an immediate second `edit()` stays pending past the queued `close` task, dialog open. |
| src-attribute.AC3.2 (close then edit) | integration | test/index.ts | P5 T2 | `edit()`, `dialog.close()`, `edit()` in one tick: first resolves `null`, second is a new promise, dialog open. |
| src-attribute.AC3.2 (in-flight Save) | integration | test/index.ts | P5 T2 | Deferred `getBlob` stub: Save, close, re-edit, resolve: first is `null`, no `change`, second pending. |
| src-attribute.AC3.3 | integration | test/index.ts | P5 T2 | `nocrop` with image, no image, and a `preventDefault()` on `edit` each resolve `null` with the dialog closed. |
| src-attribute.AC3.4 | integration | test/index.ts | P5 T2 | Two `edit()` calls while open return the same promise; one `edit` event; dialog stays open. |
| src-attribute.AC3.5 | integration | test/index.ts | P5 T2 | Clicking `.edit` opens the dialog, emits the same `{file, src}` detail; Save emits `change` `source:'crop'`. |

### src-attribute.AC4: Crop failure

| Criterion | Type | File | Phase/Task | Asserts |
|---|---|---|---|---|
| src-attribute.AC4.1 | integration | test/index.ts | P5 T2 | With `getBlob` stubbed to reject, Save emits `error` `reason:'crop-failed'`; dialog open, preview `src` unchanged, no `change`. |
| src-attribute.AC4.2 | integration | test/index.ts | P5 T2 | After the failed Save, `edit()` is still pending (raced against a sentinel); `.crop-cancel` then resolves it `null`. |

### src-attribute.AC5: Event semantics

| Criterion | Type | File | Phase/Task | Asserts |
|---|---|---|---|---|
| src-attribute.AC5.1 | integration | test/index.ts | P4 T3 | `<image-input alt="seeded" src=...>` in a listening container emits no `alt-change`; `.alt-badge` has `has-alt`. |
| src-attribute.AC5.2 | integration | test/index.ts | P4 T3 | After connect, `el.alt = 'x'` emits `alt-change` with `{alt:'x'}`. |
| src-attribute.AC5.3 | integration | test/index.ts | P4 T3 | `el.setImage(imageBlob('image/png'))` emits `change` with `source:'api'`. |

The existing shape test at `test/index.ts:691` is updated in P4 T3 to
expect `['alt', 'file', 'source']`.

### src-attribute.AC6: `<image-crop>` and `cropDialog`

| Criterion | Type | File | Phase/Task | Asserts |
|---|---|---|---|---|
| src-attribute.AC6.1 (on src set) | integration | test/crop.ts | P2 T2 | Connected `<image-crop crossorigin="anonymous">`, then `src` set: inner `img.crossOrigin === 'anonymous'`. |
| src-attribute.AC6.1 (on render) | integration | test/crop.ts | P2 T2 | `crossorigin` set before append survives `render()`; `el.crossorigin = null` clears `img.crossOrigin`. |
| src-attribute.AC6.2 | integration | test/crop.ts | P2 T2 | After `setFile` + load, setting `src` zeroes `crop` and `getBlob()` rejects; after the next load, `crop.width > 0` and `getBlob()` resolves. |
| src-attribute.AC6.3 (crossorigin) | integration | test/crop-dialog.ts | P2 T3 | `cropDialog('/fixtures/photo.png', {crossorigin:'anonymous'})` gives its `image-crop` that attribute. |
| src-attribute.AC6.3 (type) | integration | test/crop-dialog.ts | P2 T3 | `cropDialog('/fixtures/photo.png')` resolves an `image/png` blob after Save. |
| src-attribute.AC6.3 (fallback) | integration | test/crop-dialog.ts | P2 T3 | `cropDialog(imageDataUrl())` resolves an `image/jpeg` blob. |

### src-attribute.AC7: `html()` and `ImageInputClient`

| Criterion | Type | File | Phase/Task | Asserts |
|---|---|---|---|---|
| src-attribute.AC7.1 | unit | test/html.ts | P3 T2 | Parsed `html({src:'/a/b.png'})` has `has-image` on `.box`/`.preview` and img `src` attribute equals the input. |
| src-attribute.AC7.1 (escaping) | unit | test/html.ts | P3 T2 | For `'/x?a=1&b="2"'`, the parsed img `getAttribute('src')` equals the input. |
| src-attribute.AC7.1 (empty) | unit | test/html.ts | P3 T2 | `html({src:''})` and `html()` have no `has-image` and no img `src`. |
| src-attribute.AC7.1 (crossorigin) | unit | test/html.ts | P3 T2 | `html({crossorigin:'anonymous', src})` img has `crossOrigin === 'anonymous'`. |
| src-attribute.AC7.2 | unit | test/html.ts | P3 T2 | `html({required:true, src})`: `data-required`, not `required`; `html({required:true})`: both; `html()`: neither. |
| src-attribute.AC7.3 | integration | test/client.ts | P6 T2 | Client over `html({src})` shows `has-image`; `.alt-badge` emits `{file:null, src, alt:''}` and opens `.alt-dialog`. |
| src-attribute.AC7.4 | integration | test/client.ts | P6 T2 | `setSrc(url)` with a file held: no events, empty `input.files`, preview is the URL; `setSrc(null)` and `setSrc('')` empty the preview. |
| src-attribute.AC7.5 | integration | test/client.ts | P6 T2 | Client `edit()` mirrors AC3.1-AC3.4: resolves after `change` `source:'crop'`, src-only crop is `photo.png`/`image/png`, Cancel and `dialog.close()` give `null`, close-then-edit, `nocrop`/no image/canceled give `null`, double call returns one promise, in-flight Save guard. |
| src-attribute.AC7.6 | integration | test/client.ts | P6 T2 | A `text/plain` pick emits `error` `not-an-image`; a rejecting `getBlob` stub emits `crop-failed` with dialog open; `html({required:true, src})` input is not `required` until `.remove`. |

P6 T2 also checks that a client pick has `source:'pick'` and
`setImage` has `source:'api'` (the client has no drop path).

## Human verification

These are parts of criteria, or behaviors the design relies on, that
the browser suite cannot exercise faithfully. Each has an automated
proxy above; the manual check confirms the real-world path.

### H1. Real Esc keypress closes the crop dialog (src-attribute.AC3.2, src-attribute.AC7.5)

**Why not automated:** the suite has no trusted keyboard input.
Dispatching a synthetic `keydown` or `cancel` does not close a modal
`<dialog>`, so the tests call `dialog.close()`, which is the state a
native Esc ends in. That proves `edit()` resolves on `close`, but not
that the browser really fires `close` from Esc on this dialog.

**Approach:** run the example (`npm start`), open an image, click Edit
(or run `await document.querySelector('image-input').edit()` in the
console and keep the promise). Press Esc. Expect the dialog to close,
no `image-input:change` in the example's event log, and the promise to
resolve `null`. Repeat for the client example if the page includes
one, and once with a backdrop click if the dialog supports it.

### H2. Cross-origin image without CORS produces `crop-failed` (src-attribute.AC4.1, src-attribute.AC7.6)

**Why not automated:** a genuinely tainted canvas needs a second origin
in the test runner, which `tapout --html` does not provide. The tests
stub `getBlob` to reject, which covers the element's handling of any
rejection but not that a real `SecurityError` from `toBlob` reaches
that path.

**Approach:** serve the example on one origin and an image on another
(for example `npx http-server -p 9999` in a folder with a PNG, which
sends no CORS headers by default). Set `el.src =
'http://localhost:9999/a.png'` with no `crossorigin`. The preview
shows. Click Edit, then Save. Expect `image-input:error` with
`reason:'crop-failed'`, the dialog still open, the preview unchanged,
and no `change`. Cancel, and the pending `edit()` resolves `null`.

### H3. CORS headers and `crossorigin` against a real server (src-attribute.AC1.8, src-attribute.AC6.1, README "Stored images")

**Why not automated:** the tests only assert that `crossOrigin` is set
on both `<img>` elements before `src`. Whether a server's
`Access-Control-Allow-Origin` (with `Vary: Origin`, or `*`) makes the
crop succeed, and whether a `crossorigin` preview fails without those
headers, depends on real network and cache behavior on a second
origin.

**Approach:** with the H2 setup:
1. Serve the image with `Access-Control-Allow-Origin: *`
   (`npx http-server --cors -p 9999`). Set `crossorigin="anonymous"`
   and `src`. Crop and Save. Expect `change` with `source:'crop'` and
   a `File` named after the URL with the guessed type.
2. Restart without `--cors`. Hard-reload with the cache disabled, set
   `crossorigin="anonymous"` and `src`. Expect the preview to fail to
   load (a CORS error in the console), matching the README warning.
3. With CORS on, load the URL once without `crossorigin`, then set
   `crossorigin` and crop. In DevTools Network, confirm the cropper's
   load is a CORS request and the crop succeeds, i.e. no cached
   non-CORS response poisons the canvas.

### H4. Example app stored-image toggle (Phase 7 Task 3; DoD item 4)

**Why not automated:** Phase 7 is docs and example only
("Verifies: None"). The build (`npm run build-example`) proves it
compiles, not that it behaves.

**Approach:** `npm start`, then in each example:
1. Click "Stored image". The stored photo shows, and the event log
   records no `change`, `alt-change` or `remove`.
2. Pick a file, then click "Stored image" again. The picked file is
   dropped silently and the panel resets.
3. Click it once more. The image clears.
4. With a stored image shown, use ALT, Edit and Remove. ALT emits
   `alt` and `alt-change`; Edit + Save emits `change` with
   `source:'crop'`; Remove emits `remove`.
5. Stop the dev server afterwards.

### H5. Docs deliverables (DoD item 4)

**Why not automated:** documentation is not tested (project rule: do
not write tests for docs).

**Approach:** review `README.md` (Attributes, Events, Stored images,
Methods, Server rendering, `image-crop`, `cropDialog`),
`docs/fdr/FDR-006-stored-image-source.md` and its `docs/fdr/INDEX.md`
row, and confirm the final commit carries a `BREAKING CHANGE:` line.
Run `grep -n $'—\|→'` over the changed docs and expect no output. The
0.0.14 version bump happens when the maintainer runs `npm version`.

## Plan behavior tests 1-13

From `docs/plans/src-attribute.md`, "Tests (`test/`)":

| # | Behavior | Covered by |
|---|---|---|
| 1 | Setting `src` shows an image, no `change` | src-attribute.AC1.1 (test/index.ts, P4 T3) |
| 2 | `src` leaves `input.files` empty | src-attribute.AC1.2 (test/index.ts, P4 T3) |
| 3 | ALT on src-only opens dialog; save emits `alt-change`, no `change` | src-attribute.AC2.1 (test/index.ts, P4 T3) |
| 4 | Edit on src-only hands URL to cropper; save emits `change`, removes `src` | src-attribute.AC2.2 (test/index.ts, P5 T2) |
| 5 | Pick while `src` set emits `change`, keeps preview, removes `src` | src-attribute.AC1.6 (test/index.ts, P4 T3) |
| 6 | Remove on src-only emits `remove`, clears preview and `src` | "Behavior test 6" in test/index.ts (P4 T3); client side in src-attribute.AC7.6 |
| 7 | `html({src})` + client shows image and opens alt dialog | src-attribute.AC7.1 (test/html.ts, P3 T2), src-attribute.AC7.3 (test/client.ts, P6 T2) |
| 8 | `getBlob()` rejection emits `crop-failed`, dialog stays open | src-attribute.AC4.1 (test/index.ts, P5 T2), src-attribute.AC7.6 (test/client.ts); real taint in H2 |
| 9 | `src` while a file is held drops the file, no event | src-attribute.AC1.3 (test/index.ts, P4 T3), src-attribute.AC7.4 (client) |
| 10 | `src=""` shows no image | src-attribute.AC1.4 (test/file.ts P1 T2; test/index.ts P4 T3), src-attribute.AC7.1 empty case |
| 11 | `required` + src-only drops `required`; back after Remove | src-attribute.AC1.7 (test/file.ts P1 T2; test/index.ts P4 T3), src-attribute.AC7.2, src-attribute.AC7.6 |
| 12 | `.png` src crops to `image/png` `<base>.png`; unknown ext crops to `image/jpeg` `<base>.jpg` | See below |
| 13 | Seeded `alt` emits no `alt-change` | src-attribute.AC5.1 (test/index.ts, P4 T3) |

The plan's extra `edit()` test (open + emit, and neither under `nocrop`
or with no image) is src-attribute.AC3.1 and src-attribute.AC3.3.

**Test 12, split coverage.** The `.png` half is an element-level
integration test (src-attribute.AC2.2, P5 T2) against the real
`/fixtures/photo.png`, asserting `photo.png` and `image/png`. The
unknown-extension half is covered without a second binary fixture:
- P1 T2 unit tests: `guessType('/a.bmp') === null`, and
  `cropName(url, 'image/jpeg')` ends in `.jpg` with the URL's stem
  (src-attribute.AC2.3, src-attribute.AC2.4, and the property check
  over unknown and uppercase extensions).
- The existing `encodableType` test in `test/file.ts` maps an unknown
  or missing type to `image/jpeg`.
- P5 T2 element fallback: seeding `src` with `imageDataUrl()` (no
  extension) crops to `image/jpeg` named `image.jpg`; P2 T3 shows the
  same fallback through `cropDialog(imageDataUrl())`.

Together these prove the chain `guessType -> null ->
encodableType -> image/jpeg -> cropName -> <base>.jpg` at each link,
and the element wiring end to end. Serving a `.bmp` fixture would only
re-test the same links.

## Coverage check

Every criterion from src-attribute.AC1.1 through src-attribute.AC7.6
has at least one automated test above. Human verification adds
real-world confirmation for the Esc keypress (H1), a real tainted
canvas (H2), real CORS server behavior (H3), and the example and docs
deliverables (H4, H5), none of which is a criterion that lacks an
automated proxy.

# Human Test Plan: Stored Image Source (`src` attribute)

Implementation plan: `docs/implementation-plans/2026-09-24-src-attribute/`.
Design: `docs/design-plans/2026-09-24-src-attribute.md`.

Automated coverage: 33 of 33 automated criteria covered; the suite passed
743 of 743 at commit 7ff8872. This plan covers what automation cannot:
real keyboard input, a real second origin, rendering, native form
validation, and the docs.

## Prerequisites

1. In `/Users/nick/code/image-input` on branch `src-attribute`, run
   `npm install`.
2. Run `npm run build-tests && npm run test-tapout` and expect 743 of 743
   passing.
3. Start the example with `npm start` (Vite, root `example/`, port 8888).
   Open http://localhost:8888/. The page has six `<image-input>`
   sections: free-form, `crop="circle"`, `crop="constrain"`,
   `crop="4/3"`, `crop="1"` and `nocrop`. Each has a panel (alt text,
   file name, file size, last event, error reason, saved) and Save,
   Clear and "Stored image" buttons.
4. Keep DevTools open with the Console and Network tabs, and turn on
   "Disable cache" in the Network tab.
5. For the cross-origin checks, have a second origin ready: in a new
   terminal, `cd /Users/nick/code/image-input/test/fixtures` and run
   `npx http-server -p 9999` (no CORS headers). Later you will restart it
   with `--cors`. `http://localhost:9999/photo.png` is a different origin
   from `http://localhost:8888`.
6. In the console, get a handle to the first element:
   `el = document.querySelectorAll('image-input')[0]`.
7. When finished, stop both the Vite dev server and http-server (Ctrl-C in
   each terminal).

## Phase 4: Stored source in the element

| Step | Action | Expected |
|------|--------|----------|
| 1 | In the free-form section, click "Stored image". | The stored photo (`example/stored.jpg`) appears in the box, with the overlay (ALT badge, edit, remove) available. The panel "last event" does not change: no `change`, `alt-change` or `remove`. |
| 2 | Run `el.getAttribute('src')` and `el.querySelector('input[type=file]').files.length`. | The first returns the Vite URL of `stored.jpg`; the second returns `0`. |
| 3 | Click the box and pick a local JPEG or PNG. | The preview switches to your file. The panel shows `change` with your file name and size, and `el.hasAttribute('src')` is `false`. |
| 4 | Click "Stored image" again. | The stored photo returns, your file is dropped silently, and the panel resets (no `change` or `remove`). `input.files.length` is 0. |
| 5 | Click "Stored image" once more. | The box returns to the empty prompt. `el.src` is `null` and no events are reported. |
| 6 | Run `el.src = ''`. | The box stays empty and the preview img has no `src`. Compare with `el.src = '/does-not-exist.png'`, which sets `has-image` (the component never fetches or validates). Then run `el.src = null`. |
| 7 | Run `el.addEventListener('image-input:change', e => console.log(e.detail.source))`, click "Stored image", then drag a local image file onto the box. | `drop` is logged, the panel shows `change`, and `el.hasAttribute('src')` is `false`. |

## Phase 4/5: Actions on a stored image

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `el.addEventListener('image-input:alt', e => console.log(e.detail))`. In the free-form section, click "Stored image" and then the ALT badge. | The alt dialog opens with an empty textarea, and `{file: null, src: '<stored url>', alt: ''}` is logged. |
| 2 | Type "A stored photo" and click Save in the alt dialog. | The dialog closes and the badge shows the has-alt state. The panel shows the alt text and `alt-change` as the last event, never `change`. |
| 3 | Click the edit button on the overlay. | The crop dialog opens with the stored photo loaded in the cropper. |
| 4 | Shrink the crop by dragging a corner and click Save. | The dialog closes and the preview shows the cropped image. The panel shows `change` with file name `stored.jpg` and a non-zero size. `el.hasAttribute('src')` is `false` and the preview `src` starts with `blob:`. |
| 5 | Click "Stored image" twice to get a fresh stored image, then click remove on the overlay. | The panel shows `remove`, the box is empty and `el.hasAttribute('src')` is `false`. |
| 6 | Repeat steps 1-5 in the `crop="circle"` and `crop="4/3"` sections. | Same behavior, with the cropper locked to the section's ratio. Saved crops are square or 4:3 blobs named `stored.jpg`. |
| 7 | In the `nocrop` section, click "Stored image". | The image shows with an ALT badge and remove, and no edit button. `await document.querySelectorAll('image-input')[5].edit()` resolves `null` at once, with no dialog. |

## Phase 5: `edit()` and the crop dialog keyboard path

| Step | Action | Expected |
|------|--------|----------|
| 1 | In the free-form section, click "Stored image". Run `p = el.edit(); p.then(r => console.log('edit resolved', r))`. | The crop dialog opens. |
| 2 | Click inside the crop area so focus is in the dialog, then press the real Esc key. | The dialog closes, `edit resolved null` is logged, the panel shows no new `change`, and the stored image is still shown with `el.src` unchanged. |
| 3 | Pick a local file, then repeat step 1 and press Esc. | Same as step 2, and the picked file is still in `input.files`. |
| 4 | Run `p = el.edit(); p.then(r => console.log('edit resolved', r))`, then click the dialog's Cancel button. | `edit resolved null` is logged and the dialog closes. |
| 5 | Run the same, then click Save without moving the crop. | `change` appears in the panel first, then `edit resolved File {...}` is logged. |
| 6 | Run `a = el.edit(); b = el.edit(); a === b`. | `true`, and only one dialog opens. Press Esc and both resolve `null`. |
| 7 | Open the crop dialog and click the dimmed backdrop outside it. | Record what happens. There is no backdrop-close handler, so the dialog should stay open. If it does close, the pending `edit()` must resolve `null` with no `change`. |
| 8 | Keyboard only: Tab to the edit button on a shown image and press Enter or Space. Tab to the crop rectangle, use the arrow keys, Tab to Save and press Enter. | The dialog opens, the crop moves, Save emits `change` with `source:'crop'`, and focus returns sensibly to the page. |

## Cross-origin behavior against a real second origin

| Step | Action | Expected |
|------|--------|----------|
| 1 | With `npx http-server -p 9999` running in `test/fixtures` (no CORS), reload the example with the cache disabled. Run `el.removeAttribute('crossorigin'); el.src = 'http://localhost:9999/photo.png'`. | The preview shows the photo (a non-CORS image can still display). |
| 2 | Run `el.addEventListener('image-input:error', e => console.log('error', e.detail))`, then `p = el.edit(); p.then(r => console.log('edit resolved', r))`. Wait for the cropper to show the image and click Save. | `error {reason: 'crop-failed'}` is logged from a real tainted-canvas `SecurityError`, and the panel "error reason" shows `crop-failed`. The dialog stays open, the preview stays the 9999 URL, no `change` fires, and `p` has not resolved. |
| 3 | Click Cancel. | `edit resolved null`, the dialog closes, and `el.src` is still the 9999 URL. |
| 4 | Restart http-server with `npx http-server --cors -p 9999`. Hard-reload the example. Run `el.setAttribute('crossorigin', 'anonymous'); el.src = 'http://localhost:9999/photo.png'`. | The preview shows the image. In Network, the request for `photo.png` has an `Origin` header and the response has `Access-Control-Allow-Origin: *`. |
| 5 | Click edit, then Save. | `change` is logged with a file named `photo.png` of type `image/png`, `src` is removed, and the preview becomes a `blob:` URL. |
| 6 | Restart http-server without `--cors`, hard-reload, and run `el.setAttribute('crossorigin', 'anonymous'); el.src = 'http://localhost:9999/photo.png'`. | The preview fails to load and the console shows a CORS error for `localhost:9999/photo.png`, as the README warns. |
| 7 | Restart with `--cors` and turn off "Disable cache". Reload, run `el.removeAttribute('crossorigin'); el.src = 'http://localhost:9999/photo.png'` so a non-CORS response is cached. Then run `el.setAttribute('crossorigin', 'anonymous'); el.src = null; el.src = 'http://localhost:9999/photo.png'`, click edit and Save. | In Network, the cropper's load is a CORS request (has `Origin`) and the crop succeeds with `change` `source:'crop'`. A cached non-CORS response must not taint the canvas; if `crop-failed` appears here, record it as a finding. |

## Form submit with `required` and a stored `src`

Confirms native constraint validation and FormData match the README
"Form submission" section. The automated tests only check
`input.required` and `checkValidity()`.

1. In the console on the example page, run:

   ```js
   f = document.createElement('form')
   f.innerHTML = '<image-input name="cover" required></image-input>' +
       '<button>Send</button>'
   document.body.prepend(f)
   f.addEventListener('submit', e => {
       e.preventDefault()
       console.log('submitted', [...new FormData(f)])
   })
   x = f.querySelector('image-input')
   ```

2. Click Send with no image. Expected: a native "select a file"
   validation message on the picker; nothing is logged.
3. Run `x.src = 'http://localhost:8888/stored.jpg'` (or the stored URL
   from Phase 4 step 2), then click Send. Expected: `submitted` is
   logged, and the `cover` entry is an empty `File` (name `""`, size 0),
   not the stored image -- the stored src does not enter the form.
4. Click remove on the overlay, then Send. Expected: the native
   validation message appears again; nothing is logged.
5. Pick a real file, then Send. Expected: `cover` is your file with its
   real name and size.
6. Run `x.src = 'http://localhost:8888/stored.jpg'`, click edit and Save
   a crop, then Send. Expected: `cover` is the cropped `File`, named
   after the URL, with size > 0.
7. Remove the form with `f.remove()`.

## Preact caveat (README "Stored images")

1. In the free-form section, pick a local file. Then cause a re-render of
   that example (type alt text and click Save in the controls). Expected:
   the picked file stays, because the example never passes `src` as a
   vdom prop and sets it only in `onToggleStored` through the ref.
2. Optional: in a scratch copy, add `src=${storedUrl}` as a prop on
   `<${ImageInput.TAG}>` in `example/index.ts`. Pick a file, then cause a
   re-render. Expected: the picked file is lost and the stored image
   returns. Revert the change afterwards.

## Docs review

1. Read `README.md` (Attributes, Events, Stored images, Methods, Server
   rendering, `image-crop`, `cropDialog`), and
   `docs/fdr/FDR-006-stored-image-source.md` with its row in
   `docs/fdr/INDEX.md`.
2. Run this and expect no output (no em dashes or arrow characters).
   It uses Python because macOS `grep` has no `\|` alternation:

   ```sh
   python3 -c "import sys; [print(f, n, l) for f in sys.argv[1:]
       for n, l in enumerate(open(f), 1)
       if '\u2014' in l or '\u2192' in l]" \
       README.md docs/fdr/INDEX.md docs/fdr/FDR-006-stored-image-source.md
   ```
3. Confirm the branch carries a `BREAKING CHANGE:` footer:
   `git log main..src-attribute --format=%B | grep 'BREAKING CHANGE:'`.

## Human verification required

| Criterion | Why manual | Steps |
|-----------|------------|-------|
| AC3.2 / AC7.5 real Esc | No trusted keyboard input in tapout; the tests call `dialog.close()` | Phase 5 steps 1-3 and 7 |
| AC4.1 / AC7.6 real tainted canvas | Needs a second origin; the tests stub `getBlob` | Cross-origin steps 1-3 |
| AC1.8 / AC6.1 real CORS | The tests only assert the attribute is set | Cross-origin steps 4-7 |
| AC1.1 visual preview | The tests check classes and attributes, not rendering | Phase 4 step 1; Phase 4/5 step 6 |
| AC1.7 native form validation | The tests check `input.required`, not browser UI or FormData | Form submit steps 1-6 |
| Example stored-image toggle | Example only | Phase 4 steps 1-5; Phase 4/5 steps 1-7 |
| README Preact caveat | Consumer framework behavior | Preact caveat steps 1-2 |
| Docs deliverables | Project rule: no tests for docs | Docs review 1-3 |

## Traceability

| Acceptance criterion | Automated test | Manual step |
|----------------------|----------------|-------------|
| AC1.1 | index.ts AC1.1, AC1.1 seeded | Phase 4 step 1 |
| AC1.2 | index.ts AC1.2 | Phase 4 step 2 |
| AC1.3 | index.ts AC1.3 | Phase 4 step 4 |
| AC1.4 | file.ts storedSrc; index.ts AC1.4 | Phase 4 step 6 |
| AC1.5 | index.ts AC1.5 x2 | Phase 4 step 5 |
| AC1.6 | index.ts AC1.6 pick, drop | Phase 4 steps 3, 7 |
| AC1.7 | file.ts inputRequired; index.ts AC1.7 x5 | Form submit steps 2-4 |
| AC1.8 | index.ts AC1.8 x2 | Cross-origin steps 4, 6 |
| AC2.1 | index.ts AC2.1 x2 | Phase 4/5 steps 1-2 |
| AC2.2 | index.ts AC2.2 | Phase 4/5 step 4; cross-origin step 5 |
| AC2.3 | file.ts guessType tests | Cross-origin step 5 |
| AC2.4 | file.ts cropName and property check | Phase 4/5 step 4 |
| AC2.5 | file.ts cropName fallback | None (unit only) |
| AC2.6 | file.ts EXT mutation | None (unit only) |
| AC3.1 | index.ts AC3.1 x2 | Phase 5 step 5 |
| AC3.2 | index.ts AC3.2 x5 | Phase 5 steps 2-4, 7 |
| AC3.3 | index.ts AC3.3 x3 | Phase 4/5 step 7 |
| AC3.4 | index.ts AC3.4 | Phase 5 step 6 |
| AC3.5 | index.ts AC3.5 | Phase 4/5 step 3; Phase 5 step 8 |
| AC4.1 | index.ts AC4.1; client.ts AC7.6 | Cross-origin step 2 |
| AC4.2 | index.ts AC4.2 | Cross-origin step 3 |
| AC5.1 | index.ts AC5.1 | None |
| AC5.2 | index.ts AC5.2 | Phase 4/5 step 2 |
| AC5.3 | index.ts AC5.3 | None |
| AC6.1 | crop.ts AC6.1 x2 | Cross-origin step 7 |
| AC6.2 | crop.ts AC6.2 | None |
| AC6.3 | crop-dialog.ts AC6.3 x3 | None |
| AC7.1 | html.ts src tests | None (SSR markup) |
| AC7.2 | html.ts required tests | None |
| AC7.3 | client.ts AC7.3 | None (no client page in the example) |
| AC7.4 | client.ts AC7.4 x3 | None |
| AC7.5 | client.ts AC7.5 x8 | None (no client page in the example) |
| AC7.6 | client.ts AC7.6 x6 | Cross-origin step 2 (element path) |

The example uses `<image-input>` only, so the static `ImageInputClient`
path (AC7.x) has no manual step. Its real-Esc and real-taint behavior
shares the dialog and close handling with the element and is covered by
the automated proxies.

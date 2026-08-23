# Upstream Patches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six `@substrate-system/image-input` defects reported
in `docs/patch.md`: a lossy default in `getBlob`, a missing readiness
event, an unannounced crop mutation, an unescaped attribute
interpolation, and two packaging gaps.

**Architecture:** Five independent source changes plus a docs pass. The
behavior fixes all live in `src/crop.ts`; two of them pull small pure
helpers into existing modules (`src/file.ts`) or a new one
(`src/escape.ts`) so the branch logic is unit-testable without a
browser. The packaging changes touch `package.json` and split
`src/index.css` into per-element stylesheets. Tasks 1 through 5 do not
depend on each other and can be reviewed in any order; task 6 depends on
nothing but is the largest diff; task 7 documents all of them.

**Tech Stack:** TypeScript, esbuild, `@substrate-system/web-component`,
lightningcss, tapzero + tapout (real-browser test runner), eslint
(newneostandard).

**Spec:** `docs/patch.md`, items 1 through 6. Items 7 through 10 belong
to `@substrate-system/drag-drop` (checked out at
`/Users/nick/code/drag-drop`, version 0.4.13) and are explicitly out of
scope for this plan.

## Design decisions settled before planning

These were decided with the repo owner and are not open questions:

1. **`getBlob` default type** uses an allowlist of the types
   `canvas.toBlob` can actually encode, not the source type verbatim.
   `toBlob` silently encodes PNG for any type it cannot handle, so
   `this.#file?.type ?? 'image/jpeg'` alone would return PNG bytes
   labelled `image/heic`, which is the same class of bug the fix is
   meant to close.
2. **Image load emits both** `image-crop:load` (the readiness signal,
   item 2) and `image-crop:change` (the class invariant that every
   `#crop` mutation announces itself, item 3).
3. **Packaging items 5 and 6 are both in scope**, including an explicit
   `./crop` entry in the exports map.
4. **The `escapeAttr` helper moves to its own module.** `crop.ts` must
   not import it from `html.ts`: `html.ts` imports `dialogs.ts`, and
   `crop.ts` is a standalone entry point, so that import would pull the
   whole `<image-input>` markup into every crop-only bundle.

## Global Constraints

* TypeScript type annotations take no space after the colon:
  `hint?:string|boolean`.
* Ternaries put the operator at the end of the line:
  `const x = cond ?\n    a :\n    b`.
* No line longer than 80 columns, in code and in markdown.
* No em dashes anywhere. Use `--`. No `->` arrow characters; use `->`.
* No emojis in filenames, code, or comments.
* Do not assert on specific text content of HTML in tests. Assert on
  structure, attributes, and behavior.
* Do not change CSS unrelated to the task. Do not change eslint config.
* All colors and sizes come from CSS custom properties.
* Always pass an explicit generic to `this.qs<T>(selector)` when
  calling type-specific methods on the result, or `tsc
  --emitDeclarationOnly` fails during `npm run build`.
* Commit messages: short, lowercase, imperative, matching the existing
  log (`fix build script`, `nocrop attribute, example`). Not
  conventional commits.

## Test commands

The suite runs in a real browser through tapout. There is no
single-test runner; the whole bundle runs each time.

* Fast iteration loop (does not rebuild `dist/`):
  `npm run build-tests && npm run test-tapout`
* Full gate (lint, build, rebuild tests, run):
  `npm test`

`npm run build-tests` bundles `test/index.ts`, which imports `../src/*`
directly, so source edits are picked up without `npm run build`.

## Branch

Work on the current `wip` branch. `docs/patch.md` and this plan are
already untracked there. Do not run `npm version`: the repo's
`postversion` hook pushes and publishes to npm. The release is the
owner's to run, after review.

## Non-goals

* Items 7 through 10 (`@substrate-system/drag-drop`). Item 7 argues for
  sequencing drag-drop first; the owner chose to ship image-input first.
* An error event when `src` fails to decode. `<image-crop>` still emits
  nothing on a broken image, and that stays true after this plan.
* Anything about `src/dialogs.ts`. ADR-002 says the dialogs are deleted
  and the source still has them; that drift is real but it is not this
  plan's problem.

---

### Task 1: Escape `src` in `ImageCrop.render()`

Patch item 4. `src/html.ts` already has an `escapeAttr` and already
applies it to `accept`, `name`, `alt` and `label`. `crop.ts` is the one
interpolation in the package that skips it.

**Files:**
- Create: `src/escape.ts`
- Modify: `src/html.ts:18-24` (remove the local `escapeAttr`, import it)
- Modify: `src/crop.ts:508-511` (`render()`), plus a new import
- Test: `test/crop.ts` (append one test)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `escapeAttr(value:string):string`, exported from
  `src/escape.ts`. No other task uses it.

- [ ] **Step 1: Write the failing test**

Append to `test/crop.ts`. The payload is an inert `data-` attribute
rather than an `onerror` handler, so the test proves the injection is
blocked without ever executing anything if it is not:

```ts
test('a src containing a quote cannot inject attributes into the ' +
    'rendered markup', async t => {
    const el = document.createElement('image-crop') as ImageCrop
    el.className = 'src-escape-test'
    el.setAttribute('src', '" data-injected="yes')
    document.body.appendChild(el)

    const imgs = el.querySelectorAll('img')
    t.equal(imgs.length, 1, 'should render exactly one img')
    t.equal(imgs[0].getAttribute('data-injected'), null,
        'should not let the src value introduce an attribute')
    t.equal(el.querySelectorAll('.crop-rect').length, 1,
        'the rest of the template should still be intact')
})
```

The element is built with `createElement` and the attribute is set
before it enters the document on purpose. `WebComponent.connectedCallback`
is what calls `render()`, so this is the only way to get a hostile value
through the template rather than through `handleChange_src`, which
assigns to a property and is already safe.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build-tests && npm run test-tapout`

Expected: FAIL on `should not let the src value introduce an
attribute` -- `getAttribute('data-injected')` returns `"yes"` because
the raw value closed the `src` attribute.

- [ ] **Step 3: Create `src/escape.ts`**

```ts
/**
 * Escape a string for safe interpolation inside a double-quoted HTML
 * attribute. `&` must run first, or the entities this introduces
 * would themselves get escaped.
 *
 * This lives in its own module rather than in `html.ts` because
 * `crop.ts` needs it too, and `crop.ts` is a standalone entry point
 * (`@substrate-system/image-input/crop`). Importing it from `html.ts`
 * would pull `dialogs.ts` and the whole `<image-input>` markup into
 * every crop-only bundle.
 */
export function escapeAttr (value:string):string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
```

- [ ] **Step 4: Point `html.ts` at it**

In `src/html.ts`, delete the local `escapeAttr` function and its doc
comment (currently lines 13 through 24) and add to the imports at the
top of the file:

```ts
import { escapeAttr } from './escape.js'
```

Leave every call site alone. The behavior is identical.

- [ ] **Step 5: Escape the src in `crop.ts`**

Add to the imports at the top of `src/crop.ts`:

```ts
import { escapeAttr } from './escape.js'
```

Then in `render()`, change the first line of the method body:

```ts
    render () {
        const src = escapeAttr(this.src ?? '')
```

Everything else in `render()` stays as it is. The rest of the template
is static, so this is the only interpolation to fix.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run build-tests && npm run test-tapout`

Expected: PASS, including the existing
`accepts an image via the src attribute` test, which asserts
`img.getAttribute('src')` is truthy for an object URL. Object URLs
contain no `&`, `<`, `>` or `"`, so escaping does not change them.

- [ ] **Step 7: Lint and commit**

```bash
npm run lint
git add src/escape.ts src/html.ts src/crop.ts test/crop.ts
git commit -m "escape the src attribute in image-crop render"
```

---

### Task 2: `getBlob` defaults to the source file's type

Patch item 1, the highest-severity one. Today a consumer who omits
`type` gets a PNG silently re-encoded as JPEG: transparency flattened
onto black, and a MIME type that disagrees with the file the user
chose. `<image-input>`'s own crop flow is the first victim --
`src/index.ts:290` and `src/client.ts:240` both call `getBlob()` with no
argument, and `deriveName` then renames the result `.jpg`.

The allowlist is the whole point of the fix. `canvas.toBlob` falls back
to PNG for any type it cannot encode, so returning `#file.type`
unconditionally would hand back PNG bytes labelled `image/heic`.

**Files:**
- Modify: `src/file.ts` (add `CANVAS_TYPES` and `encodableType`)
- Modify: `src/crop.ts:204-206` (`getBlob`), plus a new import
- Create: `test/file.ts`
- Modify: `test/index.ts:1-16` (import the new test module)
- Modify: `test/crop.ts:411-412` (an assertion that must change)
- Modify: `test/index.ts` (the `.crop-save` test, add one assertion)

`src/file.ts` is the right home: it already owns the MIME tables
(`EXT`) and it imports nothing, so `crop.ts` can depend on it without
dragging anything into the `/crop` bundle.

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `encodableType(type?:string|null):string` and
  `CANVAS_TYPES:Set<string>`, exported from `src/file.ts`. Task 7
  documents the resulting `getBlob` behavior.

- [ ] **Step 1: Write the failing unit tests**

Create `test/file.ts`:

```ts
import { test } from '@substrate-system/tapzero'
import { encodableType } from '../src/file.js'

test('encodableType keeps a type the canvas can encode', t => {
    t.equal(encodableType('image/png'), 'image/png',
        'should keep png')
    t.equal(encodableType('image/jpeg'), 'image/jpeg',
        'should keep jpeg')
    t.equal(encodableType('image/webp'), 'image/webp',
        'should keep webp')
})

test('encodableType falls back to jpeg for a type the canvas cannot ' +
    'encode', t => {
    t.equal(encodableType('image/heic'), 'image/jpeg',
        'heic is not encodable, so it should fall back')
    t.equal(encodableType('image/gif'), 'image/jpeg',
        'gif is not encodable, so it should fall back')
    t.equal(encodableType('image/avif'), 'image/jpeg',
        'avif is not encodable, so it should fall back')
    t.equal(encodableType('image/svg+xml'), 'image/jpeg',
        'svg is not encodable, so it should fall back')
})

test('encodableType falls back to jpeg when there is no type', t => {
    t.equal(encodableType(undefined), 'image/jpeg',
        'should fall back when there is no file')
    t.equal(encodableType(null), 'image/jpeg',
        'should fall back for null')
    t.equal(encodableType(''), 'image/jpeg',
        'should fall back for a file with an empty type')
})
```

Register it in `test/index.ts`, alongside the other test module imports
near the top of the file (currently `import './crop.js'` through
`import './client.js'`):

```ts
import './file.js'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build-tests && npm run test-tapout`

Expected: the bundle fails to build, with esbuild reporting that
`encodableType` is not exported by `src/file.ts`.

- [ ] **Step 3: Add the helper to `src/file.ts`**

Add below the existing `EXT` map:

```ts
/**
 * The MIME types `canvas.toBlob` is actually able to encode.
 *
 * Anything outside this set is silently encoded as PNG while the
 * caller believes they asked for something else, so a blob's `type`
 * would disagree with its bytes. `EXT` above is a different list on
 * purpose: it maps types this package might *receive* to file
 * extensions, which includes types the canvas cannot write.
 */
export const CANVAS_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp'
])

/**
 * The type a canvas should be encoded to, given the source image's
 * own type.
 *
 * Re-encoding a PNG as JPEG flattens its transparency onto black and
 * mislabels the result, so prefer the source type. Fall back to
 * `image/jpeg` -- the historical default, and a type the canvas can
 * always write -- for a source the canvas cannot encode, and for an
 * image that arrived with no file at all (a bare `src` attribute).
 */
export function encodableType (type?:string|null):string {
    return (type && CANVAS_TYPES.has(type)) ? type : 'image/jpeg'
}
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `npm run build-tests && npm run test-tapout`

Expected: the three `encodableType` tests PASS. The existing
`getBlob returns a Blob of the cropped region at natural resolution`
test still passes at this point, because `crop.ts` has not changed yet.

- [ ] **Step 5: Update the two integration assertions to the new
      expectation**

These are the failing tests for the `crop.ts` half. `makeImageFile` in
`test/helpers.ts` produces a `File` of type `image/png`, so every
`setFile` in the suite now feeds the cropper a PNG.

In `test/crop.ts`, inside
`getBlob returns a Blob of the cropped region at natural resolution`,
change the type assertion:

```ts
        t.equal(blob.type, 'image/png',
            'should default to the source file\'s own type')
```

In `test/index.ts`, inside
`clicking .crop-save calls getBlob, applies the crop via setImage, and
closes the dialog`, add after the existing `detail.file instanceof File`
assertion:

```ts
    t.equal(detail.file.type, 'image/png',
        'the cropped file should keep the source image type rather ' +
        'than being re-encoded as jpeg')
    t.ok(detail.file.name.endsWith('.png'),
        'deriveName should follow the blob type')
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npm run build-tests && npm run test-tapout`

Expected: FAIL on `should default to the source file's own type`
(actual `image/jpeg`) and on both new `.crop-save` assertions.

- [ ] **Step 7: Change the default in `getBlob`**

Add to the imports at the top of `src/crop.ts`:

```ts
import { encodableType } from './file.js'
```

Then in `getBlob`, replace the type line:

```ts
        const type = opts?.type ?? encodableType(this.#file?.type)
```

And extend `getBlob`'s doc comment with a paragraph explaining the
default, since this is the behavior a caller most needs to know:

```ts
    /**
     * Render the current crop region to an offscreen canvas at the
     * image's natural resolution and resolve it as a Blob.
     *
     * With no `type`, the blob keeps the source file's own type when
     * the canvas can encode it, and falls back to `image/jpeg`
     * otherwise (see `encodableType` in `./file.ts`). Defaulting to
     * JPEG unconditionally would flatten a transparent PNG onto black
     * and hand back a blob whose type disagreed with the file the
     * user picked.
     *
     * Rejects if no image has finished loading -- drawing an image
     * with no decoded data is a silent no-op, which would otherwise
     * resolve a blank blob.
     */
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run build-tests && npm run test-tapout`

Expected: PASS, including
`getBlob accepts a type option` (an explicit `type` still wins) and
`a circle-locked crop yields a square Blob, not a masked one` (which
only measures dimensions).

- [ ] **Step 9: Lint and commit**

```bash
npm run lint
git add src/file.ts src/crop.ts test/file.ts test/crop.ts test/index.ts
git commit -m "getBlob defaults to the source file type"
```

---

### Task 3: Emit `load` and `change` when the image finishes loading

Patch items 2 and 3. `#handleImageLoad` is the only place the element
becomes usable, and it emits nothing, so a consumer has to poll
`el.crop.width > 0`. It also assigns `#crop` without announcing it,
which every other mutation path does, so a consumer tracking the rect
from `change` alone never learns the initial rect.

**Files:**
- Modify: `src/crop.ts:23-27` (the `declare global` block), plus a new
  exported interface beside it
- Modify: `src/crop.ts:231-259` (`#handleImageLoad`)
- Test: `test/crop.ts` (append four tests)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - Event `image-crop:load`, bubbling and cancelable (the base class
    default), `detail:{ naturalWidth:number, naturalHeight:number }`.
  - Event `image-crop:change` now also fires on load, `detail` being
    the same `CropRect` shape the pointer and keyboard paths already
    emit.
  - `export interface ImageCropEventMap` from `src/crop.ts`. Task 5
    re-exports this type from the package root.

Both events go through `WebComponent.emit`, which namespaces with
`this.TAG`, so `emit('load')` dispatches `image-crop:load`.

- [ ] **Step 1: Write the failing tests**

Append to `test/crop.ts`. Note the listener is attached *before*
`setFile` in each: `setFile` sets `src` synchronously, and the image
load is a later task, so this ordering is what makes the test
deterministic rather than lucky.

```ts
test('emits image-crop:load with the natural size when an image ' +
    'finishes loading', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="load-event-test"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.load-event-test') as ImageCrop

    const loaded = new Promise<{
        naturalWidth:number, naturalHeight:number
    }>(resolve => {
        el.addEventListener('image-crop:load', ((ev:CustomEvent) => {
            resolve(ev.detail)
        }) as EventListener, { once: true })
    })

    el.setFile(await makeImageFile(400, 200))
    const detail = await loaded

    t.equal(detail.naturalWidth, 400,
        'should report the natural width')
    t.equal(detail.naturalHeight, 200,
        'should report the natural height')
})

test('emits image-crop:change with the initial rect when an image ' +
    'loads', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="load-change-test"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.load-change-test') as ImageCrop

    const changed = new Promise<CropRect>(resolve => {
        el.addEventListener('image-crop:change', ((ev:CustomEvent) => {
            resolve(ev.detail)
        }) as EventListener, { once: true })
    })

    el.setFile(await makeImageFile(400, 200))
    const detail = await changed

    t.deepEqual(detail, { x: 0, y: 0, width: 400, height: 200 },
        'the first change should carry the full-frame initial rect')
})

test('announces readiness before the rect, and announces a ' +
    'constrained initial rect too', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="load-order-test" crop="1/1"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.load-order-test') as ImageCrop

    const order:string[] = []
    el.addEventListener('image-crop:load', () => {
        order.push('load')
    }, { once: true })

    const changed = new Promise<CropRect>(resolve => {
        el.addEventListener('image-crop:change', ((ev:CustomEvent) => {
            order.push('change')
            resolve(ev.detail)
        }) as EventListener, { once: true })
    })

    el.setFile(await makeImageFile(400, 200))
    const detail = await changed

    t.deepEqual(order, ['load', 'change'],
        'load should come before change')
    t.deepEqual(detail, el.crop,
        'the change detail should match the crop getter')
    t.equal(detail.width, detail.height,
        'a 1/1 constraint should announce a square initial rect')
})

test('emits load and change again for a second image', async t => {
    document.body.insertAdjacentHTML('beforeend', `
        <image-crop class="load-twice-test"
            style="display:block;width:200px;"></image-crop>
    `)
    const el = await waitFor('image-crop.load-twice-test') as ImageCrop

    const first = new Promise<CropRect>(resolve => {
        el.addEventListener('image-crop:change', ((ev:CustomEvent) => {
            resolve(ev.detail)
        }) as EventListener, { once: true })
    })
    el.setFile(await makeImageFile(400, 200))
    await first

    const second = new Promise<CropRect>(resolve => {
        el.addEventListener('image-crop:change', ((ev:CustomEvent) => {
            resolve(ev.detail)
        }) as EventListener, { once: true })
    })
    el.setFile(await makeImageFile(100, 50))
    const detail = await second

    t.deepEqual(detail, { x: 0, y: 0, width: 100, height: 50 },
        'the second image should announce its own initial rect, not ' +
        'the first image\'s')
})
```

These tests use the `CropRect` type, which `src/crop.ts` already
exports. Widen the existing type import on line 4 of `test/crop.ts`:

```ts
import type { CropRect, ImageCrop } from '../src/crop.js'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build-tests && npm run test-tapout`

Expected: all four tests hang and then FAIL on the tapout timeout,
because nothing ever resolves the promises. This is the expected
failure mode for an event that is never emitted; it takes the full
60 second timeout, so do not interpret the wait as a hang in the
harness.

- [ ] **Step 3: Declare the event map**

In `src/crop.ts`, replace the existing `declare global` block (line 23)
and add the exported map above it:

```ts
/**
 * The `image-crop:*` events, and their `detail` shapes.
 *
 * Keys are the *non*-namespaced names taken by `.on()`/`.off()`; the
 * namespaced names (`image-crop:load`, ...) are what
 * `addEventListener` sees, and they are augmented onto
 * `HTMLElementEventMap` below. This mirrors `src/events.ts`, which
 * does the same job for `<image-input>`, but lives here rather than
 * there because `crop.ts` is a standalone entry point.
 */
export interface ImageCropEventMap {
    load:CustomEvent<{ naturalWidth:number, naturalHeight:number }>
    change:CustomEvent<CropRect>
}

// for document.querySelector
declare global {
    interface HTMLElementTagNameMap {
        'image-crop': ImageCrop
    }

    /**
     * These events bubble, so listening on an ancestor is a supported
     * pattern, not just listening on the `<image-crop>` itself.
     */
    interface HTMLElementEventMap {
        'image-crop:load':ImageCropEventMap['load']
        'image-crop:change':ImageCropEventMap['change']
    }
}
```

`CropRect` is imported from `./crop-math.js` at the top of the file
already, so it is in scope here.

- [ ] **Step 4: Emit both events**

At the end of `#handleImageLoad`, after the existing `this.#layout()`
call:

```ts
        this.#layout()

        // Loading is the one place this element becomes usable, and
        // the one `#crop` assignment that used to announce nothing.
        // `load` is the readiness signal: before it, `crop` reads
        // `{0,0,0,0}` and `getBlob()` rejects, so a consumer had no
        // supported way to know when the cropper was ready.
        // `change` keeps the invariant that every mutation of
        // `#crop` is announced -- `handleChange_crop`,
        // `#handlePointerMove` and `#handleKeyDown` all end this way
        // -- so a consumer tracking the rect from `change` alone sees
        // the initial rect and not just whatever the first drag
        // produced.
        this.emit('load', {
            detail: {
                naturalWidth: this.#naturalWidth,
                naturalHeight: this.#naturalHeight
            }
        })
        this.emit('change', { detail: { ...this.#crop } })
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run build-tests && npm run test-tapout`

Expected: PASS, all four new tests plus the whole existing suite. Pay
attention to `test/index.ts`: `<image-input>` does not listen for
`image-crop:change`, so the new emission should not disturb it, but the
events bubble and a regression there would show up as a duplicated
`image-input:change`.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add src/crop.ts test/crop.ts
git commit -m "emit load and change when the crop image loads"
```

---

### Task 4: Put the test helpers on the new event

The polling workaround that patch item 2 predicts consumers will invent
already exists in this repo: `waitForCropRect` in `test/helpers.ts`
loops on `el.crop.width` every 10ms. Rewriting both helpers on the
`image-crop:load` event is the cleanup, and it exercises the new event
across every existing test as a side effect.

Both keep their current signatures, so no call site changes.

**Files:**
- Modify: `test/helpers.ts:57-83` (`waitForImageLoad` and
  `waitForCropRect`)

**Interfaces:**
- Consumes: `image-crop:load` from task 3.
- Produces: nothing other tasks use.

- [ ] **Step 1: Rewrite both helpers**

Replace `waitForImageLoad` and `waitForCropRect` in `test/helpers.ts`
with:

```ts
/**
 * Wait until an `<image-crop>` is usable: its image has decoded and
 * its crop rect has been fitted to the natural size.
 *
 * This waits on the element's own `image-crop:load` rather than the
 * inner `<img>`'s native `load`. The two fire in that order, and it is
 * the component's event that means the crop rect and `getBlob()` are
 * ready, which is what every caller actually wants. The synchronous
 * shortcut covers being called after the load has already happened.
 */
export function waitForImageLoad (el:ImageCrop):Promise<void> {
    if (el.crop.width) return Promise.resolve()

    return new Promise(resolve => {
        el.addEventListener('image-crop:load', () => resolve(), {
            once: true
        })
    })
}

/**
 * Wait until an `<image-crop>`'s crop rect reports the given natural
 * width. Unlike `waitForImageLoad`, this works for the *second* image
 * loaded into the same element, where the element may already be
 * reporting the previous image's rect when this is called.
 */
export function waitForCropRect (
    el:ImageCrop,
    width:number
):Promise<void> {
    if (el.crop.width === width) return Promise.resolve()

    return new Promise(resolve => {
        const onLoad = () => {
            if (el.crop.width !== width) return
            el.removeEventListener('image-crop:load', onLoad)
            resolve()
        }
        el.addEventListener('image-crop:load', onLoad)
    })
}
```

- [ ] **Step 2: Run the whole suite**

Run: `npm run build-tests && npm run test-tapout`

Expected: PASS, with no timeouts. Every existing `await
waitForImageLoad(el)` and `await waitForCropRect(el, n)` call site now
goes through the event. A timeout here means the event is not firing on
some path the polling loop used to paper over, which is a real finding
about task 3, not a test bug -- investigate rather than reverting to
the poll.

- [ ] **Step 3: Lint and commit**

```bash
npm run lint
git add test/helpers.ts
git commit -m "wait on image-crop:load in the test helpers"
```

---

### Task 5: Reach `ImageCrop` from the package root

Patch item 5. `dist/index.d.ts` exports `ImageInput` and
`ImageInputEventMap` only, so `import { ImageCrop } from
'@substrate-system/image-input'` fails with TS2305. ADR-002 makes
`<image-crop>` a first-class element rather than an implementation
detail of `<image-input>`, so the root should say so.

The `./crop` subpath already resolves through the `"./*"` wildcard, and
the patch notes confirm it typechecks under
`moduleResolution: "Bundler"`. An explicit entry is about robustness
across resolvers, not about fixing a break.

**Files:**
- Modify: `src/index.ts:20` (the existing export line)
- Modify: `package.json` (the `exports` field)
- Test: `test/index.ts` (append one test)

**Interfaces:**
- Consumes: `ImageCropEventMap` from task 3.
- Produces: `ImageCrop`, `CropRect`, `GetBlobOptions` and
  `ImageCropEventMap` from the package root.

- [ ] **Step 1: Write the failing test**

Append to `test/index.ts`. This asserts the runtime half of the
re-export; the type half is checked by `tsc` during `npm run build`:

```ts
test('ImageCrop is reachable from the package root', t => {
    t.equal(typeof RootImageCrop, 'function',
        'the root module should export the ImageCrop class')
    t.equal(RootImageCrop.TAG, 'image-crop',
        'and it should be the real one')
})
```

Add the import it needs at the top of `test/index.ts`, next to the
existing `import { ImageInput } from '../src/index.js'`:

```ts
import { ImageCrop as RootImageCrop } from '../src/index.js'
```

The alias avoids colliding with the existing
`import type { ImageCrop } from '../src/crop.js'` in the same file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build-tests && npm run test-tapout`

Expected: the bundle fails to build, with esbuild reporting that
`ImageCrop` is not exported by `src/index.ts`.

- [ ] **Step 3: Re-export from `src/index.ts`**

`src/index.ts` already imports `ImageCrop` from `./crop.js` for its own
use, so this costs nothing at runtime. Replace the existing
`export type { ImageInputEventMap }` line with:

```ts
export type { ImageInputEventMap }

/**
 * `<image-crop>` is a first-class element (ADR-002), not an
 * implementation detail of this one. The root module already imports
 * it, so re-exporting adds no weight, and it saves a consumer from
 * having to know the `/crop` subpath exists.
 */
export { ImageCrop }
export type {
    CropRect,
    GetBlobOptions,
    ImageCropEventMap
} from './crop.js'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build-tests && npm run test-tapout`

Expected: PASS.

- [ ] **Step 5: Add explicit exports entries**

In `package.json`, replace the `exports` field's `"."` entry and add a
`"./crop"` entry directly after it. The `types` condition must come
first in each object, and literal keys are matched ahead of the `"./*"`
wildcard, so the wildcard stays as the fallback for every other module:

```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./crop": {
      "types": "./dist/crop.d.ts",
      "import": "./dist/crop.js",
      "require": "./dist/crop.cjs"
    },
    "./css": "./dist/index.css",
    "./css/min": "./dist/index.min.css",
    "./*": {
      "import": [
        "./dist/*.js",
        "./dist/*"
      ],
      "require": [
        "./dist/*.cjs",
        "./dist/*"
      ]
    }
  },
```

Both `dist/crop.js` and `dist/crop.cjs` are already produced by
`build-esm` and `build-cjs`, and `dist/crop.d.ts` by the
`--emitDeclarationOnly` step of `build-esm`. There is no `.d.cts`, so
the single `types` condition covers both module systems.

- [ ] **Step 6: Verify the exports map resolves**

```bash
npm run build
ls dist/crop.js dist/crop.cjs dist/crop.d.ts dist/index.d.ts
node --input-type=module -e "console.log(import.meta.resolve('@substrate-system/image-input/crop'))"
node --input-type=module -e "console.log(import.meta.resolve('@substrate-system/image-input'))"
node -e "console.log(require.resolve('@substrate-system/image-input/crop'))"
```

Expected: `ls` lists all four files. The two ESM resolutions print
`file://.../dist/crop.js` and `file://.../dist/index.js`. The CJS one
prints `.../dist/crop.cjs`. These use Node's self-reference support,
which reads this package's own `exports` field, and they resolve
without executing the modules (which would fail outside a browser,
since the code touches `window`).

- [ ] **Step 7: Lint and commit**

```bash
npm run lint
git add src/index.ts package.json test/index.ts
git commit -m "export ImageCrop from the package root"
```

---

### Task 6: A CSS subpath for the cropper alone

Patch item 6. `./css` and `./css/min` are both the whole
`dist/index.css`, so a consumer using only `<image-crop>` ships the
`<image-input>` box, preview, overlay and dialog styles too.

`src/_vars.css` becomes the input-only variable file and a new
`src/_vars-crop.css` holds the eight `--image-crop-*` properties. The
name `_vars.css` is kept because the project's own conventions name it,
and because `README.md:82` and `example/AGENTS.md:159` point at it.

Nothing in the `image-crop` block references an `--image-input-*`
property, and the `.crop-slot` rule that sits between them belongs to
the dialog, so the split is clean.

**Files:**
- Create: `src/_vars-crop.css`
- Create: `src/crop.css`
- Create: `src/input.css`
- Modify: `src/_vars.css` (remove the eight `--image-crop-*` lines)
- Modify: `src/index.css` (becomes two imports)
- Modify: `package.json` (`build-css:crop`, `build-css:crop:min`, the
  `build` script, two `exports` entries)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `dist/crop.css` and `dist/crop.min.css`, exported as
  `./css/crop` and `./css/crop/min`. Task 7 documents them.

- [ ] **Step 1: Record the current built output**

The split must not change what `./css` ships. Capture the baseline
first:

```bash
npm run build-css
mkdir -p ./.tmp-css
cp dist/index.css ./.tmp-css/before.css
```

`./.tmp-css` is scratch. Delete it in step 7 and never commit it.

- [ ] **Step 2: Create `src/_vars-crop.css`**

Move the eight crop properties out of `src/_vars.css` into a new file,
values unchanged:

```css
:root {
    --image-crop-dim-color: rgb(0 0 0 / 55%);
    --image-crop-rect-border-color: #fff;
    --image-crop-rect-border-width: 2px;
    --image-crop-handle-size: 0.75rem;
    --image-crop-handle-color: #fff;
    --image-crop-handle-border-color: #1d9bf0;
    --image-crop-focus-color: #1d9bf0;
    --image-crop-max-height: 65vh;
}
```

- [ ] **Step 3: Delete those eight lines from `src/_vars.css`**

Remove exactly the eight `--image-crop-*` declarations (currently lines
24 through 31). Every `--image-input-*` property, including the dialog
group below them, stays. Do not reorder or reformat the rest.

- [ ] **Step 4: Create `src/crop.css` and `src/input.css`**

`src/index.css` is 492 lines: line 1 is the `@import` of
`_vars.css`, lines 3 through 329 are the `image-input` rules (the
block, then the commented `image-input:not(:defined, :has(.box))` rule)
and lines 331 through 492 are the `image-crop` rules (the block, then
`image-crop:not(:defined)`). Cut on those boundaries:

```bash
{ echo '@import url("./_vars.css");'; echo; \
  sed -n '3,329p' src/index.css; } > src/input.css
{ echo '@import url("./_vars-crop.css");'; echo; \
  sed -n '331,492p' src/index.css; } > src/crop.css
```

Then read both files back and confirm each starts with its `@import`,
that `src/crop.css` matches no `image-input` selector, and that
`src/input.css` matches no `image-crop` *selector*. `input.css` does
mention `image-crop` twice, in the `.crop-slot` comment that explains
why the slot is clamped instead of the element inside it. That comment
is about the dialog and belongs where it is -- leave it.

Cutting rather than retyping is deliberate: every explanatory comment
in those blocks has to travel with its rule, and there are a lot of
them.

- [ ] **Step 5: Reduce `src/index.css` to two imports**

```css
/**
 * The whole package's styles: the `<image-input>` box and the
 * `<image-crop>` cropper it opens. A consumer using only
 * `<image-crop>` can import `crop.css` on its own instead, through
 * the `./css/crop` subpath, and skip the box, preview, overlay and
 * dialog rules.
 *
 * Import order matters: `input.css` first, so the built file keeps
 * the rule order it had when this was one file.
 */
@import url("./input.css");
@import url("./crop.css");
```

- [ ] **Step 6: Rebuild and verify the shipped stylesheet is unchanged**

```bash
npm run build-css
```

The `:root` block is now two `:root` blocks in different positions, so a
plain `diff` will not be empty. Check the two things that matter
instead -- the same custom properties with the same values, and every
other rule byte-identical and in the same order:

```bash
grep -o -- '--[a-z0-9-]*: *[^;]*' ./.tmp-css/before.css | sort \
    > ./.tmp-css/vars-before.txt
grep -o -- '--[a-z0-9-]*: *[^;]*' dist/index.css | sort \
    > ./.tmp-css/vars-after.txt
diff ./.tmp-css/vars-before.txt ./.tmp-css/vars-after.txt

strip () {
  awk '
    /^:root \{/ { skip=1; next }
    skip && /^\}/ { skip=0; drop=1; next }
    drop && /^$/ { drop=0; next }
    { drop=0 }
    !skip
  ' "$1"
}
strip ./.tmp-css/before.css > ./.tmp-css/rules-before.css
strip dist/index.css > ./.tmp-css/rules-after.css
diff ./.tmp-css/rules-before.css ./.tmp-css/rules-after.css
```

Expected: both `diff`s print nothing. A difference in the second one
means a rule moved or a comment was retyped rather than moved; fix it
before continuing.

- [ ] **Step 7: Add the build scripts and the exports entries**

In `package.json`, add two scripts next to the existing `build-css`
ones:

```json
    "build-css:crop": "lightningcss --bundle --targets '>= 0.25%' src/crop.css -o dist/crop.css",
    "build-css:crop:min": "lightningcss --bundle --minify --targets '>= 0.25%' src/crop.css -o dist/crop.min.css",
```

and extend the `build` script so a release produces them:

```json
    "build": "mkdir -p ./dist && rm -rf ./dist/* && npm run build-cjs && npm run build-esm && npm run build-esm:min && npm run build-css && npm run build-css:min && npm run build-css:crop && npm run build-css:crop:min",
```

and add the two subpaths to `exports`, after `"./css/min"`:

```json
    "./css/crop": "./dist/crop.css",
    "./css/crop/min": "./dist/crop.min.css",
```

- [ ] **Step 8: Build everything and check the crop-only stylesheet**

```bash
rm -rf ./.tmp-css
npm run build
ls -l dist/index.css dist/crop.css dist/crop.min.css
grep -c "image-input" dist/crop.css
grep -c "image-crop" dist/crop.css
```

Expected: all three files exist; `dist/crop.css` is substantially
smaller than `dist/index.css`; the `image-input` count is `0` and the
`image-crop` count is greater than `0`.

- [ ] **Step 9: Run the full suite**

Run: `npm test`

Expected: PASS. `build-tests` bundles `src/index.css` into
`test/index.css`, and `test/crop.ts` asserts on `touch-action` read back
from the real stylesheet, so the crop rules reaching the built file is
covered by an existing test rather than a new one.

- [ ] **Step 10: Commit**

```bash
git status --short   # confirm ./.tmp-css is gone
git add src/_vars.css src/_vars-crop.css src/crop.css src/input.css \
    src/index.css package.json
git commit -m "split the stylesheet, add a css subpath for the cropper"
```

---

### Task 7: Documentation

Every change above is user-visible. This task makes the README, the
agent notes and the decision records say so, and marks the patch notes
resolved.

**Files:**
- Modify: `README.md` (Install/ESM, CSS, `image-crop` sections)
- Modify: `src/AGENTS.md` (append two notes)
- Create: `docs/fdr/FDR-004-crop-lifecycle-events.md`
- Modify: `docs/fdr/INDEX.md` (one row)
- Modify: `docs/patch.md` (a status header)

**Interfaces:**
- Consumes: everything from tasks 1 through 6.
- Produces: nothing.

- [ ] **Step 1: README, the ESM and CSS sections**

Under `### ESM`, add the second import:

````markdown
```js
import { ImageInput } from '@substrate-system/image-input'
```

`<image-crop>`, the cropper, is exported from the root too, and from
its own subpath:

```js
import { ImageCrop } from '@substrate-system/image-input'
import { ImageCrop } from '@substrate-system/image-input/crop'
```
````

Under `### Import CSS`, after the existing `./css` and `./css/min`
blocks:

````markdown
If you use `<image-crop>` on its own, import just its styles and skip
the `<image-input>` box, preview, overlay and dialog rules:

```js
import '@substrate-system/image-input/css/crop'
```

Or minified:
```js
import '@substrate-system/image-input/css/crop/min'
```
````

In the `### CSS variables` section, extend the sentence at line 82 so
it names both files: variables are defined in `_vars.css`
(`--image-input-*`) and `_vars-crop.css` (`--image-crop-*`).

- [ ] **Step 2: README, the `image-crop` events section**

Replace the `#### Events` list under `### image-crop`:

````markdown
* `image-crop:load` -- The image finished decoding and the crop rect
  has been fitted to it. Until this fires, `cropEl.crop` reads
  `{ x: 0, y: 0, width: 0, height: 0 }` and `getBlob()` rejects, so
  this is the signal that the element is usable. `detail` is
  `{ naturalWidth:number, naturalHeight:number }`. It fires once per
  image, so loading a second image into the same element fires it
  again.
* `image-crop:change` -- The crop rectangle changed. `detail` is the
  crop rect, `{ x:number, y:number, width:number, height:number }`, in
  natural (not displayed) image pixels. This fires for a pointer drag,
  for a keyboard move or resize, when the `crop` attribute changes, and
  once on load with the initial rect -- so a listener on this event
  alone sees every rect the element has ever had, starting with the
  first.

Attach these before the call that starts the load (`setFile`, or
setting `src`). The load is asynchronous, so a listener attached in the
same tick as that call still catches it.
````

- [ ] **Step 3: README, a methods section for `image-crop`**

Add a `#### Methods` section after the events, since `getBlob`'s
defaulting rule is the single most important thing a consumer needs to
know and it is currently only mentioned in passing:

````markdown
#### Methods

* `setFile(file)` -- Load a `File` into the cropper. Revokes the
  previous object URL, resets the natural size and the crop rect, and
  starts an asynchronous load that ends in `image-crop:load`.
* `crop` -- A getter, not a method: the current crop rect in natural
  image pixels. Reads `{ x: 0, y: 0, width: 0, height: 0 }` until the
  image has loaded.
* `getBlob(opts?)` -- Render the crop region to a canvas at natural
  resolution and resolve it as a `Blob`. `opts` is
  `{ type?:string, quality?:number }`, matching `canvas.toBlob`.

  With no `type`, the blob keeps the source file's own type when the
  canvas can encode it -- `image/png`, `image/jpeg` and `image/webp` --
  and falls back to `image/jpeg` for anything else, including an
  element driven by the `src` attribute with no file behind it. The
  fallback exists because `canvas.toBlob` silently encodes PNG for a
  type it cannot write, so passing an unencodable type through would
  return bytes that disagree with the blob's own `type`.

  Rejects if no image has finished loading.
````

- [ ] **Step 4: Regenerate the README table of contents**

```bash
npm run toc
```

- [ ] **Step 5: Append to `src/AGENTS.md`**

```markdown
- `canvas.toBlob` silently encodes PNG for any type it cannot write,
  and reports the type you asked for. Only `image/png`, `image/jpeg`
  and `image/webp` are safe to pass through. `encodableType` in
  `src/file.ts` is the gate, and `getBlob`'s default goes through it;
  do not "simplify" it to `this.#file?.type ?? 'image/jpeg'`, which
  hands back PNG bytes labelled `image/heic`.
- `escapeAttr` lives in `src/escape.ts`, not `src/html.ts`, because
  `crop.ts` needs it and `crop.ts` is a standalone entry point
  (`@substrate-system/image-input/crop`). `html.ts` imports
  `dialogs.ts`, so importing the helper from there would pull the
  whole `<image-input>` markup into every crop-only bundle. Keep
  `crop.ts` free of imports from `html.ts`, `dialogs.ts`, `index.ts`
  and `client.ts` for the same reason.
```

- [ ] **Step 6: Write `docs/fdr/FDR-004-crop-lifecycle-events.md`**

Follow the format of `docs/fdr/FDR-002-crop-rect-direct-manipulation.md`:
an `# FDR-004: ...` heading, `**Status:** Implemented`,
`**Last reviewed:** 2026-08-23`, then `## Overview`, `## Behavior` and
`## Decisions` sections. It should record:

* What the events are and when they fire (the README text in step 2 is
  the user-facing version of this).
* Why `load` exists: `#handleImageLoad` is the only place the element
  becomes usable and it announced nothing, so consumers polled
  `el.crop.width > 0`. This repo's own test helpers did exactly that.
* Why `change` also fires on load: every other path that mutates
  `#crop` ends by emitting `change`, and load was the one exception, so
  a consumer tracking the rect from `change` alone never saw the
  initial rect.
* Why `load` is emitted before `change`: readiness first, then the
  value, so a listener on both reads in the order the words suggest.
* What is deliberately not here: no event when the image fails to
  decode. A broken `src` still emits nothing.
* Cross-reference [ADR-002](../adr/ADR-002-events-not-dialogs.md), which
  is what makes `<image-crop>` a first-class element with an event
  vocabulary of its own rather than an internal of `<image-input>`.

Then add the row to `docs/fdr/INDEX.md`:

```markdown
| [FDR-004](FDR-004-crop-lifecycle-events.md) | Crop lifecycle events | Implemented | 2026-08-23 |
```

- [ ] **Step 7: Mark the patch notes resolved**

Add a status block to `docs/patch.md` directly under its title,
recording what shipped and what did not, so the file stays useful to
the repo it came from:

```markdown
**Status, 2026-08-23:** items 1 through 6 are fixed in this repo. See
`docs/plans/2026-08-23-upstream-patches.md`. Items 7 through 10 belong
to `@substrate-system/drag-drop` and are still open there.
```

- [ ] **Step 8: Verify and commit**

```bash
npm test
git add README.md src/AGENTS.md docs/fdr docs/patch.md \
    docs/plans/2026-08-23-upstream-patches.md
git commit -m "document the crop events, blob type and css subpath"
```

- [ ] **Step 9: Hand back for release**

Do not run `npm version`. The `postversion` hook runs
`git push --follow-tags && npm publish`, so cutting the version
publishes to npm. Report to the owner instead:

* Task 2 is a behavior change (`getBlob`'s default type), so the
  release wants a minor bump: `0.0.9` to `0.1.0`.
* `CHANGELOG.md` is generated by `auto-changelog` inside the `version`
  script. Do not hand-edit it.
* Items 7 through 10 are still open in
  `/Users/nick/code/drag-drop`, and item 7 notes that `image-input`
  picks up any drag-drop fix on its next release.

---

## Verification summary

After task 7, all of these must hold:

* `npm test` passes (lint, build, rebuild tests, run in a browser).
* `npm run build` produces `dist/crop.css`, `dist/crop.min.css` and
  `dist/crop.d.ts`.
* `dist/crop.css` contains no `image-input` selector.
* `dist/index.css` is unchanged apart from its `:root` block being
  split in two.
* `import.meta.resolve('@substrate-system/image-input/crop')` resolves.
* `getBlob()` with no arguments on a PNG source returns a blob of type
  `image/png`; on a source type the canvas cannot encode it returns
  `image/jpeg`.
* `<image-crop>` emits `image-crop:load` then `image-crop:change` once
  per loaded image.
* A `src` containing a double quote introduces no attribute.

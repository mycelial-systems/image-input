# Stored Image Source Implementation Plan -- Phase 1: Shared helpers

**Goal:** Add the pure rules for stored sources, MIME guessing, crop
names and `required` to `src/file.ts`, with tests.

**Architecture:** Four small pure functions next to the existing `EXT`,
`deriveName`, `toFile` and `encodableType` in `src/file.ts`. Both
`ImageInput` and `ImageInputClient` (later phases) call them, and
`html()` calls two of them, so they must not touch the DOM at module
scope.

**Tech Stack:** TypeScript, `@substrate-system/tapzero` tests bundled
with esbuild and run in a headless browser by `tapout`.

**Scope:** Phase 1 of 7 from
`docs/design-plans/2026-09-24-src-attribute.md`

**Codebase verified:** 2026-09-24

---

## Acceptance Criteria Coverage

This phase implements and tests:

### src-attribute.AC1: Seeding and replacing a stored source (`<image-input>`)
- **src-attribute.AC1.4 Edge:** `src=""`, whether set as an attribute or as the property, shows no image.
  (This phase covers only the `storedSrc` rule behind it. Phase 4 covers the element behavior.)
- **src-attribute.AC1.7 Success:** With `required` and a src-only image, the inner input is not `required`. After Remove or `clear()`, it is `required` again. Without `required` on the host, it is never `required`.
  (This phase covers only the `inputRequired` rule behind it. Phase 4 covers the element behavior.)

### src-attribute.AC2: Actions on a stored image, crop type and name
- **src-attribute.AC2.3 Success:** `guessType` maps `.png`, `.PNG`, `.jpg`, `.jpeg`, `.webp`, `.gif` and `.avif`, ignoring query and fragment. It returns `null` for no extension or an unknown one.
- **src-attribute.AC2.4 Success:** `cropName('/assets/post/abc.png', 'image/png')` is `abc.png`, and with `'image/jpeg'` it is `abc.jpg`. For any input, the extension matches the blob type.
- **src-attribute.AC2.5 Edge:** `cropName` for a URL with no path segment returns `image.<ext>`.
- **src-attribute.AC2.6 Edge:** `guessType` picks up a runtime mutation of `ImageInput.EXT`.

---

## Codebase notes for the implementor

- `src/file.ts` currently exports `EXT` (lines 13-19, a mutable
  `Record<string, string>` of MIME -> extension), `deriveName`
  (lines 26-32), `toFile` (lines 39-48), `CANVAS_TYPES` (lines 59-63)
  and `encodableType` (lines 75-77).
- `ImageInput.EXT` in `src/index.ts:74` is `static EXT = EXT`, the same
  object, so mutating `ImageInput.EXT` mutates the module's `EXT`.
- `deriveName(type, prevName)` strips one trailing `.ext` from
  `prevName` and appends `EXT[type] ?? 'jpg'`.
- Tests: `test/file.ts` exists and already tests `encodableType`. It is
  imported by `test/index.ts:18`, the single bundle entry.
- There is no property-based testing library, and you must not add
  one. Write the property check as a loop over deterministically
  generated inputs. Existing tests already use plain loops over cases.
- House style (from `~/.claude/CLAUDE.md`): lines of 80 columns or
  fewer, no space between colon and type (`url:string`), ternaries
  broken after `?` and `:`, no em dashes and no arrow characters in
  comments (use `--` and `->`).
- Test commands: `npm run build-tests && npm run test-tapout` runs the
  whole browser suite. `npm test` also runs lint and build first.
- Do NOT use `npx tsc --noEmit -p tsconfig.json` as a gate. It already
  fails on pre-existing errors in `test/crop-dialog.ts` and
  `test/fixture.ts`. `npm run build` type-checks `src/` through
  `tsconfig.build.json`.

---

<!-- START_SUBCOMPONENT_A (tasks 1-2) -->
<!-- START_TASK_1 -->
### Task 1: Implement `storedSrc`, `guessType`, `cropName`, `inputRequired`

**Verifies:** None directly (Task 2 tests them)

**Files:**
- Modify: `src/file.ts` (append after `encodableType`, lines 75-77)

**Implementation:**

Add these exports. `html.ts` will import this module and may run where
no DOM exists, so read `location` only inside a function and guard it.

```ts
/**
 * Normalize a stored `src`. An empty string and a missing value both
 * mean "no stored image" -- preact turns `undefined` into `''` when it
 * sets a property, so '' has to be treated as absent here, not in a
 * setter.
 */
export function storedSrc (raw:string|null|undefined):string|null {
    return raw ? raw : null
}

function defaultBase ():string {
    return typeof location === 'undefined' ?
        'http://localhost/' :
        location.href
}

/**
 * The decoded last path segment of `url`, or '' when there is none.
 * `data:` and `blob:` URLs have no meaningful path, so they give ''.
 * Query and fragment are never part of a pathname, so they are
 * ignored for free.
 */
function lastSegment (url:string, base?:string):string {
    let parsed:URL
    try {
        parsed = new URL(url, base ?? defaultBase())
    } catch (_err) {
        return ''
    }
    if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') {
        return ''
    }
    const segment = parsed.pathname.split('/').pop() ?? ''
    try {
        return decodeURIComponent(segment)
    } catch (_err) {
        return segment
    }
}

/**
 * Guess a MIME type from the extension on a URL's path, through a
 * reverse lookup of `EXT` plus `jpeg`. Case-insensitive. Returns null
 * when there is no extension or it is unknown. `EXT` is read on every
 * call, so a runtime change to `ImageInput.EXT` is honored.
 */
export function guessType (url:string, base?:string):string|null {
    const match = /\.([^.]+)$/.exec(lastSegment(url, base))
    if (!match) return null
    const ext = match[1].toLowerCase()
    if (ext === 'jpeg') return 'image/jpeg'
    for (const [type, known] of Object.entries(EXT)) {
        if (known.toLowerCase() === ext) return type
    }
    return null
}

/**
 * A file name for a crop of `src`: the base name comes from the URL's
 * last path segment, and the extension from the blob's actual type, so
 * the two always agree. Falls back to `image` when the URL has no
 * usable segment.
 */
export function cropName (
    src:string,
    blobType:string,
    base?:string
):string {
    const segment = lastSegment(src, base)
    const stem = segment.replace(/\.[^.]+$/, '')
    return deriveName(blobType, stem ? segment : null)
}

/**
 * The single rule for the inner file input's `required`: a stored
 * image satisfies it.
 */
export function inputRequired (
    wantsRequired:boolean,
    hasStoredImage:boolean
):boolean {
    return wantsRequired && !hasStoredImage
}
```

Notes:
- The `stem ? segment : null` choice keeps a name like
  `my.photo.png` as `my.photo.png`. `deriveName` strips only the last
  extension. A bare `.png` segment falls back to `image.png`.
- `deriveName` falls back to `jpg` for types not in `EXT`. Canvas
  output types (`CANVAS_TYPES`: png, jpeg, webp) are all in `EXT`, so
  the extension always matches for any blob a crop can produce.

**Verification:**
Run: `npm run lint && npm run build`
Expected: No lint errors, build succeeds.

**Commit:** `feat: add storedSrc, guessType, cropName, inputRequired helpers`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Tests for the helpers

**Verifies:** src-attribute.AC1.4 (rule), src-attribute.AC1.7 (rule),
src-attribute.AC2.3, src-attribute.AC2.4, src-attribute.AC2.5,
src-attribute.AC2.6

**Files:**
- Modify: `test/file.ts` (append; extend the import on line 2)
- Test type: unit, run in the browser bundle

**Testing:**
- `storedSrc`: `''`, `null` and `undefined` give `null`. A non-empty
  string is returned unchanged. (AC1.4 rule)
- `inputRequired`: `(true, false)` is `true`, `(true, true)` is
  `false`, and `(false, *)` is `false`. (AC1.7 rule)
- `guessType` (AC2.3):
  - `.png`, `.PNG`, `.jpg`, `.jpeg`, `.webp`, `.gif` and `.avif` paths
    map to `image/png`, `image/png`, `image/jpeg`, `image/jpeg`,
    `image/webp`, `image/gif` and `image/avif`.
  - A path with a query and fragment
    (`/a/b.png?v=2#x.jpg`) is `image/png`.
  - An absolute URL on another host works.
  - A path with no extension (`/api/cover/123`) gives `null`, and an
    unknown one (`/a.bmp`) gives `null`.
  - A `data:` URL gives `null`.
- `guessType` runtime mutation (AC2.6): set
  `ImageInput.EXT['image/bmp'] = 'bmp'`, assert
  `guessType('/a.bmp') === 'image/bmp'`, and delete the key in a
  `finally`. Import `ImageInput` from `../src/index.js` so the test
  goes through the public static, not the module export.
- `cropName` (AC2.4):
  - `cropName('/assets/post/abc.png', 'image/png') === 'abc.png'`.
  - `cropName('/assets/post/abc.png', 'image/jpeg') === 'abc.jpg'`.
- `cropName` with no segment (AC2.5): `https://example.com/` with
  `image/webp` gives `image.webp`. A `data:` URL with `image/png` gives
  `image.png`.
- `cropName` property check (AC2.4, "for any input"): with a small
  seeded pseudo-random generator (for example an LCG such as
  `seed = (seed * 1103515245 + 12345) >>> 0`), build about 200 URLs.
  Each one combines a random directory depth, a random stem (letters,
  digits, `-`, `.`, `%20`, or empty), an optional random extension
  (known, unknown, uppercase, or none), and optional `?query` and
  `#fragment`. For each URL and each type in `CANVAS_TYPES`, assert
  that `cropName(url, type)` ends with `'.' + EXT[type]` and has a
  non-empty part before that extension. Keep it deterministic, with
  no `Math.random`, so a failure reproduces. Put one `t.ok` per
  failing case, and one summary `t.ok` when all pass, so the TAP
  output stays short.

**Verification:**
Run: `npm run build-tests && npm run test-tapout`
Expected: All tests pass, including the new helper tests.

**Commit:** `test: cover stored-source helpers`
<!-- END_TASK_2 -->
<!-- END_SUBCOMPONENT_A -->

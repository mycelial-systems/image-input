# Stored Image Source Implementation Plan -- Phase 3: Event types and `html()`

**Goal:** Publish the new event contracts and make the server-rendered
markup able to show a stored image.

**Architecture:** `src/events.ts` gains `source` on `change`, the
nullable `{file, src}` on `edit`/`alt`, and `crop-failed` on `error`.
These are types only: the emitters change in phases 4-6. `html()` takes
`src` and `crossorigin`, writes them on the preview `<img>`, and adds
`has-image` to `.box` and `.preview` when a stored src is present. It
also writes `data-required` for the author's intent and the real
`required` only when `inputRequired()` says so.

**Tech Stack:** TypeScript, tapzero.

**Scope:** Phase 3 of 7 from
`docs/design-plans/2026-09-24-src-attribute.md`

**Codebase verified:** 2026-09-24

---

## Acceptance Criteria Coverage

This phase implements and tests:

### src-attribute.AC7: `html()` and `ImageInputClient`
- **src-attribute.AC7.1 Success:** Parsed `html({src})` has `.has-image` on `.box`/`.preview`, and its `<img>` `src` attribute equals the input, including a URL with `"` and `&`.
- **src-attribute.AC7.2 Success:** `html({required:true, src})` gives an input with `data-required` and without `required`. `html({required:true})` gives both.

---

## Codebase notes for the implementor

- `src/events.ts` (38 lines): `ImageInputEventMap` is at lines 12-19,
  and the global `HTMLElementEventMap` augmentation is at lines 29-38.
  The augmentation refers to the map by key, so it needs no change.
- `src/html.ts` (104 lines):
  - `ImageInputHtmlOptions` is at lines 14-27.
  - Values are computed at lines 39-48, and `required` at line 43
    (`opts.required ? ' required' : ''`).
  - The input is at lines 57-61, `.box` at line 55, `.preview` at
    line 73, and the `<img alt="${alt}" />` at line 74.
  - `escapeAttr` comes from `./escape.js`.
- `src/file.ts` has `storedSrc` and `inputRequired` from Phase 1.
  Importing it from `html.ts` is safe: `file.ts` touches no DOM at
  module scope.
- `test/html.ts` parses markup into a `<div>` with its `parse()` helper
  and asserts through DOM queries. Keep to that. Do not match strings
  against the markup.
- Emitters that do not yet send `source`: `WebComponent.emit` and the
  client's `#emit` both take a loosely typed detail. The build still
  succeeds after this phase, and phases 4-6 add the new fields.
- `example/state.ts` reads `detail` through `(ev as CustomEvent)`
  casts, so the type changes do not break the example.

---

<!-- START_TASK_1 -->
### Task 1: Event contract types

**Verifies:** None (types; the compiler checks them)

**Files:**
- Modify: `src/events.ts:12-19`

**Implementation:**

```ts
/** What produced the file in an `image-input:change`. */
export type ChangeSource = 'pick'|'drop'|'crop'|'api'

/** Why an `image-input:error` fired. */
export type ErrorReason = 'not-an-image'|'crop-failed'

export interface ImageInputEventMap {
    change:CustomEvent<{ file:File, alt:string, source:ChangeSource }>
    'alt-change':CustomEvent<{ alt:string }>
    remove:CustomEvent<null>
    error:CustomEvent<{ reason:ErrorReason }>
    edit:CustomEvent<{ file:File|null, src:string|null }>
    alt:CustomEvent<{ file:File|null, src:string|null, alt:string }>
}
```

`src/index.ts:20` has `export type { ImageInputEventMap }`, and the
import above it brings that type in from `./events.js`. Add
`ChangeSource` and `ErrorReason` to both that import and that
re-export.

**Verification:**
Run: `npm run lint && npm run build`
Expected: Succeeds.

**Commit:** `feat(events): add change source, crop-failed, {file, src} details`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: `html()` stored src, crossorigin and `data-required`

**Verifies:** src-attribute.AC7.1, src-attribute.AC7.2

**Files:**
- Modify: `src/html.ts:1-8` (import), `:14-27` (options), `:38-74`
  (body)
- Test: `test/html.ts` (unit, DOM parsing)

**Implementation:**
- Import `{ storedSrc, inputRequired }` from `./file.js`.
- Add these fields to `ImageInputHtmlOptions`, each with a doc comment:
  - `src?:string|null`: a stored image URL to show. An empty string
    means none.
  - `crossorigin?:string|null`: written on the preview `<img>`.
- Compute:

  ```ts
  const src = storedSrc(opts.src)
  const hasImage = src !== null
  const wantsRequired = !!opts.required
  const required =
      (wantsRequired ? ' data-required' : '') +
      (inputRequired(wantsRequired, hasImage) ? ' required' : '')
  const imgAttrs =
      (opts.crossorigin == null ?
          '' :
          ` crossorigin="${escapeAttr(opts.crossorigin)}"`) +
      (hasImage ? ` src="${escapeAttr(src)}"` : '')
  const imageClass = hasImage ? ' has-image' : ''
  ```

- Use them as `<div class="box${imageClass}">`,
  `<div class="preview${imageClass}">`, `<img alt="${alt}"${imgAttrs} />`,
  and on the input `accept="${accept}"${name}${required}` (the existing
  interpolation point).

**Testing** (`test/html.ts`, parsing with the existing `parse()`):
- AC7.1: for `html({src: '/a/b.png'})`, `.box` and `.preview` both have
  `has-image`, and `img.getAttribute('src') === '/a/b.png'`.
- AC7.1 escaping: with `const url = '/x?a=1&b="2"'`,
  `img.getAttribute('src') === url` after parsing.
- `html({src: ''})` and `html()` have no `has-image` and no `src`
  attribute on the img.
- `html({crossorigin: 'anonymous', src: '/a.png'})`: the img has
  `crossOrigin === 'anonymous'`.
- AC7.2: `html({required: true, src: '/a.png'})` gives an input with
  `hasAttribute('data-required')` and `required === false`.
  `html({required: true})` gives both. `html()` gives neither.

**Verification:**
Run: `npm run lint && npm run build && npm run build-tests && npm run test-tapout`
Expected: All tests pass, including the existing `html()` and
`<image-input>` tests. (`ImageInput.render()` has not passed `src` yet,
so element behavior is unchanged.)

**Commit:** `feat(html): stored src, crossorigin and data-required`
<!-- END_TASK_2 -->

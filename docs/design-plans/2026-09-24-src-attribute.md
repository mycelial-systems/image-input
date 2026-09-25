# Stored Image Source Design

## Summary
This design adds `src` and `crossorigin` attributes to `<image-input>`
(and `crossorigin` to `<image-crop>`), so the component can show and
edit an image that already lives at a URL, not only a `File` the user
picked, dropped or cropped. A stored `src` is displayed as-is: it is
never fetched, never written into the file input, and never announced
with `change`. Picking, dropping or cropping still works as before and
replaces the stored `src`. The two existing entry points, `ImageInput`
(the custom element) and `ImageInputClient` (which wires up
server-rendered markup), gain parallel logic for tracking which source
is shown -- a held file or a stored URL -- and for keeping the
preview, the `has-image` state and native form `required` in sync
across every transition between the two.

The rules live in a small set of pure helpers added to `src/file.ts`:
one normalizes a stored `src` (empty means none), one guesses a MIME
type from a URL's extension, one derives a crop's file name so its
extension matches its bytes, and one decides whether the inner file
input is `required`. Both classes call these helpers rather than one
delegating to the other, which keeps the change scoped to 0.0.14.
`<image-crop>` and `cropDialog` learn `crossorigin` and reset their
state correctly when a cropper switches from a file to a URL. A new
public `edit():Promise<File|null>` exposes the crop step so a consumer
can await a crop or learn it was canceled, and `change` gains a
`source` field that tells a pick, a drop, a crop and an API call
apart. Work is split into seven phases: shared helpers, the cropper,
event and markup contracts, the two host classes, and docs.

## Definition of Done

1. `src` and `crossorigin` are reflected on `<image-input>`, and
   `crossorigin` on `<image-crop>`, with parity in `html()` and
   `ImageInputClient`. Seeding emits no events, touches no files and
   fetches nothing. Setting `src` drops any held file. `src` satisfies
   `required`.
2. ALT, Edit and Remove work on a `src`-only image. A crop gets its
   type from the URL extension and a name whose extension matches the
   bytes. Crop failure emits `error` with `reason:'crop-failed'`.
3. A new public `edit():Promise<File|null>` opens the crop step, on
   both `ImageInput` (a static plus an instance method) and
   `ImageInputClient`. It resolves with the cropped `File` on save and
   `null` on cancel, and does nothing (resolves `null`) under `nocrop`
   or when there is no image. `change` carries
   `source:'pick'|'drop'|'crop'|'api'`.
4. `edit`/`alt` event details carry `{file, src}`. A seeded alt emits
   no `alt-change` before connect. The version is 0.0.14, with README,
   a `BREAKING CHANGE:` commit line for the generated CHANGELOG,
   FDR-006 and the `docs/fdr/INDEX.md` entry.
5. Behavior tests from `docs/plans/src-attribute.md` (1-13) plus
   `edit()`.

Out of scope: a no-JS form signal for "removed", fixing the lost
`#file` preview on reattach, and removing the built-in dialogs
(ADR-002).

## Acceptance Criteria

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
- **src-attribute.AC2.2 Success:** Edit on a src-only image hands the URL to `<image-crop>`. Saving emits `change` with `source:'crop'` and a `File` whose base name comes from the URL, and `src` is removed afterwards.
- **src-attribute.AC2.3 Success:** `guessType` maps `.png`, `.PNG`, `.jpg`, `.jpeg`, `.webp`, `.gif` and `.avif`, ignoring query and fragment. It returns `null` for no extension or an unknown one.
- **src-attribute.AC2.4 Success:** `cropName('/assets/post/abc.png', 'image/png')` is `abc.png`, and with `'image/jpeg'` it is `abc.jpg`. For any input, the extension matches the blob type.
- **src-attribute.AC2.5 Edge:** `cropName` for a URL with no path segment returns `image.<ext>`.
- **src-attribute.AC2.6 Edge:** `guessType` picks up a runtime mutation of `ImageInput.EXT`.

### src-attribute.AC3: `edit()` (`<image-input>`)
- **src-attribute.AC3.1 Success:** `edit()` opens the crop dialog, emits `edit` with `{file, src}`, and resolves with the cropped `File` after Save, once `change` with `source:'crop'` has been emitted.
- **src-attribute.AC3.2 Success:** `edit()` resolves `null` when the dialog closes without saving (Cancel or Esc).
- **src-attribute.AC3.3 Failure:** `edit()` resolves `null` without opening the dialog under `nocrop`, with no image, or when a listener cancels `edit`.
- **src-attribute.AC3.4 Edge:** Calling `edit()` while the dialog is open returns the same promise and does not reopen the dialog.
- **src-attribute.AC3.5 Success:** Clicking the Edit button behaves exactly as calling `edit()`.

### src-attribute.AC4: Crop failure
- **src-attribute.AC4.1 Failure:** When `getBlob()` rejects on Save, `error` is emitted with `reason:'crop-failed'`, the dialog stays open, the image is unchanged, and no `change` is emitted.
- **src-attribute.AC4.2 Edge:** A failed save does not settle `edit()`'s promise. A later Cancel resolves it `null`.

### src-attribute.AC5: Event semantics
- **src-attribute.AC5.1 Success:** An `alt` present at parse time emits no `alt-change`, and the ALT badge still shows it.
- **src-attribute.AC5.2 Success:** Setting `alt` from code after connect emits `alt-change`.
- **src-attribute.AC5.3 Success:** `setImage()` emits `change` with `source:'api'`.

### src-attribute.AC6: `<image-crop>` and `cropDialog`
- **src-attribute.AC6.1 Success:** With `crossorigin` set, the inner `<img>` has `crossOrigin` applied when `src` is set, and after `render()`.
- **src-attribute.AC6.2 Edge:** Switching a cropper from `setFile()` to a `src` URL makes `crop` read `{0,0,0,0}` and `getBlob()` reject until the new image fires `load`.
- **src-attribute.AC6.3 Success:** `cropDialog(url, {crossorigin})` sets `crossorigin` on its `<image-crop>`. For a `.png` URL with no explicit `type`, it resolves a `image/png` blob.

### src-attribute.AC7: `html()` and `ImageInputClient`
- **src-attribute.AC7.1 Success:** Parsed `html({src})` has `.has-image` on `.box`/`.preview`, and its `<img>` `src` attribute equals the input, including a URL with `"` and `&`.
- **src-attribute.AC7.2 Success:** `html({required:true, src})` gives an input with `data-required` and without `required`. `html({required:true})` gives both.
- **src-attribute.AC7.3 Success:** `ImageInputClient` over `html({src})` shows the image, and ALT opens the alt dialog with `alt` detail `{file:null, src, alt}`.
- **src-attribute.AC7.4 Success:** Client `setSrc(url)` drops a held file with no event. `setSrc(null)` empties the preview.
- **src-attribute.AC7.5 Success:** Client `edit()` meets AC3.1 to AC3.4.
- **src-attribute.AC7.6 Success:** The client emits `error` for `not-an-image` and `crop-failed`, and after Remove its input is `required` again when it was rendered with `data-required`.

## Glossary
- **Custom element**: A browser-native class registered as an HTML tag
  (`<image-input>`, `<image-crop>`) through the Custom Elements API.
- **Reflected attribute**: An HTML attribute kept in sync with a JS
  property of the same name (e.g. `src`, `crossorigin`). Supplied by
  `@substrate-system/web-component`, the base class both elements
  extend, along with the `handleChange_<name>` callback convention.
- **`ImageInputClient`**: A plain class (not a custom element) that
  attaches `<image-input>` behavior to markup produced by `html()`,
  for server-rendered pages.
- **`html()`**: The single function that produces the component's
  markup; `ImageInput.render()` calls it too.
- **Stored source**: An image the consumer already has at a URL, set
  through `src` (or `setSrc()` on the client), as opposed to a `File`
  held in memory.
- **Object URL (blob URL)**: A temporary URL from
  `URL.createObjectURL()` referencing an in-memory `File` or `Blob`.
  It must be revoked when no longer used.
- **CORS / `crossorigin`**: Cross-Origin Resource Sharing. The
  `crossorigin` attribute makes an image load in CORS mode, which
  requires the server to send `Access-Control-Allow-Origin`; without it
  a CORS-mode load fails. `Vary: Origin` keeps caches from serving a
  non-CORS response to a CORS request.
- **Tainted canvas / `SecurityError`**: A canvas that has drawn a
  cross-origin image loaded without CORS permission. Reading it back
  (`toBlob`, used by `getBlob()`) throws a `SecurityError`.
- **Preact**: A small React-like UI library. Referenced because it
  does not re-set a prop whose value is unchanged, and because it turns
  `undefined` into `''` when setting a property.
- **FDR (Feature Decision Record)**: This project's per-feature record
  of behavior and design decisions, indexed in `docs/fdr/INDEX.md`.
- **ADR (Architecture Decision Record)**: A record of a cross-cutting
  architectural decision. ADR-002 plans to remove the built-in dialogs
  in favor of events; this design does not depend on it.
- **`auto-changelog` / `BREAKING CHANGE:`**: The tool that generates
  `CHANGELOG.md` from commit messages on `npm version`; a commit line
  starting `BREAKING CHANGE:` marks a change as breaking.
- **Property-based testing**: Checking that a rule holds across many
  generated inputs instead of one fixed example. Used for the
  `cropName` extension-matches-type check.

## Architecture

An `<image-input>` holds at most one image, from one of two sources: a
`File` the user picked, dropped or cropped (`#file`), or a stored URL
(`src`). A stored URL is shown as-is. It is never fetched, never
written into the inner `<input type=file>`, and never announced with
`change`.

### State transitions

Both `ImageInput` (`src/index.ts`) and `ImageInputClient`
(`src/client.ts`) implement the same table. After every row, each class
re-syncs `.has-image` on `.box`/`.preview`, the preview `img.src`, and
`input.required`.

| Trigger | `#file` | `src` | Event |
|---|---|---|---|
| set non-empty `src` | cleared, blob URL revoked, `input.value = ''` | set | none |
| set `''` / remove `src`, no file held | -- | cleared, preview emptied | none |
| remove `src`, file held | kept | -- | none |
| pick / drop / `setImage` / crop save | set | removed | `change` |
| Remove button / `clear()` | cleared | removed | `remove` (button only) |

`ImageInput` stores `src` in its reflected attribute.
`ImageInputClient` has no reflected attributes. It keeps a private
`#storedSrc`, seeded from the rendered `<img src>` at construction, and
exposes `setSrc(url:string|null)` for the first row.

### Shared pure helpers (`src/file.ts`)

The rules both classes need live in `file.ts`, next to `EXT`,
`deriveName` and `toFile`:

```ts
// '' and null/undefined both mean "no stored image"
export function storedSrc (raw:string|null|undefined):string|null

// Pathname extension -> MIME, via a reverse map of EXT plus 'jpeg'.
// Ignores query and fragment; case-insensitive; null when unknown.
// Reads EXT on each call so runtime EXT mutations are honored.
export function guessType (url:string, base?:string):string|null

// Base name from the URL's last path segment, extension from the
// blob's actual type (via deriveName). 'image' when no segment.
export function cropName (
    src:string,
    blobType:string,
    base?:string
):string

// The single `required` rule for the inner file input
export function inputRequired (
    wantsRequired:boolean,
    hasStoredImage:boolean
):boolean
```

`base` defaults to `location.href` where a DOM exists.

### `required`

`src` satisfies `required`. `html()` always writes the author's intent
as `data-required` on the input, and writes the real `required` only
when `inputRequired(required, hasStoredImage)` is true. `ImageInput`
reads intent from its own `required` attribute; `ImageInputClient`
reads `input.dataset.required`. Both apply `inputRequired` after every
transition.

### Public contracts

```ts
// src/events.ts
change:CustomEvent<{
    file:File,
    alt:string,
    source:'pick'|'drop'|'crop'|'api'
}>
edit:CustomEvent<{ file:File|null, src:string|null }>
alt:CustomEvent<{ file:File|null, src:string|null, alt:string }>
error:CustomEvent<{ reason:'not-an-image'|'crop-failed' }>
// 'alt-change' and 'remove' unchanged

// src/index.ts
class ImageInput {
    static reflectedStringAttributes:[
        'accept', 'name', 'alt', 'label', 'crop', 'src', 'crossorigin'
    ]
    declare src:string|null
    declare crossorigin:string|null
    static edit (el:ImageInput):Promise<File|null>
    edit ():Promise<File|null>
}

// src/client.ts
class ImageInputClient {
    edit ():Promise<File|null>
    setSrc (url:string|null):void
}

// src/html.ts
interface ImageInputHtmlOptions {
    src?:string|null;
    crossorigin?:string|null;
    // existing fields unchanged; `required` now also emits
    // data-required
}

// src/crop.ts
class ImageCrop {
    static reflectedStringAttributes:['src', 'crossorigin']
    declare crossorigin:string|null
}

// src/crop-dialog.ts
type CropDialogOptions = {
    // existing fields unchanged
    crossorigin?:string
}
```

### `edit()`

`edit()` resolves with the new `File` after a crop save (after
`setImage` has run and `change` with `source:'crop'` has been emitted),
and with `null` when the crop dialog closes without a save (Cancel,
Esc, backdrop -- detected through the dialog's `close` event). It
resolves `null` immediately under `nocrop`, with no image, or when a
listener cancels `edit`. A `crop-failed` rejection does not settle it:
the dialog stays open for a retry or cancel. Calling `edit()` while the
dialog is open returns the pending promise. `handleEdit` calls `edit()`
and ignores the result.

With a `#file`, the cropper gets `setFile(file)`. With only `src`, it
gets `crossorigin` and then `src`. The crop's type
(`guessType(src)`, falling back through `encodableType`) and name
(`cropName(src, blob.type)`) are fixed when the dialog opens, so a
`src` change while it is open cannot mix them.

### `<image-crop>`

`crossorigin` is reflected and applied to the inner `<img>` before
`src`, in both `handleChange_src` and `render()`. When `src` changes to
anything other than the object URL `setFile` just created,
`handleChange_src` clears `#file`, revokes the stale object URL, and
zeroes the natural size and crop rect -- the same reset `setFile`
performs. This fixes a reused cropper that switches from a file to a
URL reporting the old file's type and dimensions, and it makes
`cropDialog(url)` correct too.

### Cross-origin

`crossorigin` is forwarded to the preview `<img>` and the cropper's
`<img>` so both loads share one CORS mode, which avoids a cached
non-CORS response poisoning the canvas load. A tainted canvas makes
`toBlob` throw a `SecurityError` inside `getBlob`'s promise executor;
crop save catches the rejection and emits `error` with
`reason:'crop-failed'`.

### Seeded `alt`

`handleChange_alt` skips its `alt-change` emit until the first
`connectedCallback` has finished (a private `#connectedOnce` flag), so
an `alt` present at parse time is not reported as a change.
Programmatic sets after connect still emit.

## Existing Patterns

- **Static plus instance methods.** `clear` and `setImage` in
  `src/index.ts` put the body in a static taking the element and add a
  one-line instance method. `edit` follows this.
- **Pure helpers shared through `src/file.ts`.** `toFile`, `deriveName`
  and `encodableType` are already shared by `ImageInput` and
  `ImageInputClient`. The new helpers go there, and each class keeps
  its own event and DOM wiring. This was chosen over making
  `ImageInput` delegate to the client, or over a new shared state
  class; both are larger refactors than 0.0.14 warrants.
- **Reflected attributes and `handleChange_<name>`** from
  `@substrate-system/web-component`. The reflected setter removes the
  attribute for `null`/`undefined` and sets it for anything else,
  including `''`. Preact coerces `undefined` to `''` when setting a
  property, so empty-string handling lives in `storedSrc`, not in the
  setter.
- **Single markup source.** `html()` is the only place markup is
  written; `ImageInput.render()` calls it. `src`, `crossorigin` and
  `data-required` go through it, escaped by `escapeAttr`.
- **Tests** use `@substrate-system/tapzero`, real decoded fixtures
  (`makeImageFile`, `imageFile`, `imageBlob` in `test/helpers.ts` and
  `test/fixture.ts`), and `waitForImageLoad` on `image-crop:load`.
  Nothing is stubbed today; this design stubs one method (`getBlob` on
  an `<image-crop>` instance) for the `crop-failed` path, because a
  genuinely cross-origin image needs a second origin in the runner.
- **FDRs** use Overview, Behavior, Design Decisions, Related, Open
  Questions, with a row in `docs/fdr/INDEX.md`.
- **CHANGELOG** is generated by `auto-changelog` on `npm version`, with
  `--breaking-pattern 'BREAKING CHANGE:'`. It is not edited by hand.

Divergence: `ImageInputClient` today silently ignores non-images and
has no notion of `required`. It gains both, to match `ImageInput`.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Shared helpers
**Goal:** The pure rules for stored sources, MIME guessing, crop names
and `required`.

**Components:**
- `storedSrc`, `guessType`, `cropName`, `inputRequired` in
  `src/file.ts`
- Tests in `test/file.ts`, including a property-style check that
  `cropName`'s extension always matches the blob type

**Dependencies:** None

**Done when:** Helper tests pass (src-attribute.AC2.3-2.6,
src-attribute.AC1.4 via `storedSrc`, src-attribute.AC1.7 via
`inputRequired`).
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: `<image-crop>` and `cropDialog`
**Goal:** The cropper handles cross-origin sources and resets state when
switching from a file to a URL.

**Components:**
- `ImageCrop` in `src/crop.ts`: reflect `crossorigin`; apply it before
  `src` in `handleChange_src` and `render()`; reset `#file`, object
  URL, natural size and rect on a non-`setFile` `src` change
- `cropDialog` in `src/crop-dialog.ts`: `crossorigin` option;
  `guessType` default for a string source
- Tests in `test/crop.ts` and `test/crop-dialog.ts`

**Dependencies:** Phase 1

**Done when:** Tests pass for src-attribute.AC6.1-6.3.
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Event types and `html()`
**Goal:** The new contracts and server-rendered markup.

**Components:**
- `src/events.ts`: `change.source`, `edit`/`alt` `{file, src}`,
  `crop-failed`
- `html()` in `src/html.ts`: `src`, `crossorigin`, `data-required`,
  conditional `required`, `has-image` on stored src
- Tests in `test/html.ts` (DOM queries on parsed output, no string
  matching)

**Dependencies:** Phase 1

**Done when:** Build and type-check succeed; tests pass for
src-attribute.AC7.1-7.2.
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: `ImageInput` stored source
**Goal:** `<image-input>` shows, replaces and clears a stored image
without events, and keeps `required` correct.

**Components:**
- `ImageInput` in `src/index.ts`: `src`/`crossorigin` reflected;
  `handleChange_src`, `handleChange_crossorigin`,
  `handleChange_required`; `#setFile` removes `src` and takes a
  `source`; `clear()` removes `src`; `#hasImage()`; ALT on a stored
  image with `{file, src, alt}`; `#connectedOnce` alt suppression;
  `render()` passes the new options
- Tests in `test/index.ts`

**Dependencies:** Phases 1, 3

**Done when:** Tests pass for src-attribute.AC1.1-1.8,
src-attribute.AC2.1, src-attribute.AC5.1-5.3.
<!-- END_PHASE_4 -->

<!-- START_PHASE_5 -->
### Phase 5: `ImageInput.edit()` and crop of a stored image
**Goal:** A public, awaitable crop step that works on files and stored
URLs.

**Components:**
- `ImageInput.edit` (static) and `edit()` (instance) in
  `src/index.ts`; `handleEdit` delegates; crop save uses the guessed
  type and `cropName`, emits `crop-failed` on rejection, resolves the
  pending promise; dialog `close` resolves `null`
- Tests in `test/index.ts`

**Dependencies:** Phases 2, 4

**Done when:** Tests pass for src-attribute.AC2.2, src-attribute.AC3,
src-attribute.AC4.
<!-- END_PHASE_5 -->

<!-- START_PHASE_6 -->
### Phase 6: `ImageInputClient` parity
**Goal:** Server-rendered markup wired by the client behaves the same
as the element.

**Components:**
- `ImageInputClient` in `src/client.ts`: `#storedSrc` from the rendered
  `<img>`; `setSrc()`; `#hasImage()`; `edit():Promise<File|null>`;
  `crossorigin` from host or `<img>`; `required` from
  `data-required`; `error` for `not-an-image` and `crop-failed`;
  `change.source`; `{file, src}` details
- Tests in `test/client.ts`

**Dependencies:** Phases 1-3, 5 (same contract as `ImageInput.edit`)

**Done when:** Tests pass for src-attribute.AC7.3-7.6.
<!-- END_PHASE_6 -->

<!-- START_PHASE_7 -->
### Phase 7: Docs and example
**Goal:** Consumers can find and use the feature.

**Components:**
- `README.md`: `src`, `crossorigin` (Attributes); `edit()`, client
  `setSrc`/`edit` (Methods); new detail shapes and `crop-failed`
  (Events); a "Stored images" subsection covering seeding, src
  replacing a file, empty src, `required`, plain form submit, CORS
  server requirements (`Vary: Origin` or `ACAO: *`; a `crossorigin`
  preview fails without CORS headers), the pick-then-`edit()` recipe,
  and `alt-change` after connect
- `docs/fdr/FDR-006-stored-image-source.md` and its
  `docs/fdr/INDEX.md` row
- A stored-image toggle in `example/`

**Dependencies:** Phases 1-6

**Done when:** `npm test` passes (lint, build, tests); the example
builds. The release commit carries a `BREAKING CHANGE:` line; running
`npm version` is left to the maintainer, since `postversion` publishes.
<!-- END_PHASE_7 -->

## Additional Considerations

**Extensionless URLs.** `guessType` returns `null` for a URL like
`/api/cover/123`, so its crop encodes as JPEG, and a transparent PNG
flattens. Consumers that care should keep the real extension on the
path. A `HEAD` request was rejected because seeding must fetch nothing.

**Same URL, re-set.** Setting `src` to the URL already shown still drops
a held file. Frameworks that diff against the previous vdom (Preact 10)
do not re-set unchanged props; a consumer that assigns `el.src` on
every render will lose a pick.

**Relation to ADR-002 / FDR-003.** Nothing here depends on removing the
built-in dialogs. When FDR-003 lands, a consumer that cancels `edit`
gets `{file, src}` and can pass `src` to `cropDialog(src, {crossorigin})`,
and `edit()` resolves `null`.

**Known, out of scope.** Reattaching an `<image-input>` re-renders it
and loses a held `#file` preview (existing bug); a stored `src`
survives because `render()` reads it.

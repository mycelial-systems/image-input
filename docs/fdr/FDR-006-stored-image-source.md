# FDR-006: Stored image source

**Status:** Implemented
**Last reviewed:** 2026-09-25

## Overview

A component editing an existing record often needs to show an image
that already lives at a URL, not only files the user picks or crops
locally. This feature adds the `src` attribute to `<image-input>`,
so it can display and edit a stored image without fetching or writing
it into the file input.

## Behavior

* Setting `src` to a URL shows the image. The component displays it
  as-is, never fetches it, and never announces it with `change`.
  Setting `src` while a file is held drops that file silently.
* Setting `src` to an empty string or `null` clears any stored image
  without event.
* Picking, dropping, or cropping a file still works and replaces the
  stored `src` with the new file (removing the `src` attribute).
* The `required` attribute on the host is satisfied by a `src`-only
  image; the inner file input is only `required` when there is no
  stored image. `html()` always writes the intent as `data-required`
  and the actual `required` only when needed.
* Alt text and removal work on a stored image. `edit()` crops it.
* A crop needs `crossorigin` on the host plus `Access-Control-Allow-Origin`
  from the server (with `Vary: Origin`, or `*`). Without both, the
  canvas becomes tainted, `toBlob` throws (SecurityError), and the
  component emits `error` with `crop-failed`.
* When cropping, the new file's name comes from the stored URL's path
  (e.g. `abc.png` from `/assets/post/abc.png`), and its MIME type is
  guessed from the extension (`.png` -> `image/png`, `.jpg` ->
  `image/jpeg`, etc.). An extensionless URL crops to JPEG.
* The `crossorigin` attribute is forwarded to the preview `<img>` and
  the cropper's `<img>`, so both loads share one CORS mode.
* A `src` switch resets the crop dialog's state until the new image
  loads.
* The `edit()` method (instance and static) opens the crop dialog for
  both files and stored images. It resolves with the cropped `File`
  after save, or `null` on cancel, under `nocrop`, with no image, or
  when `edit` is canceled. While the dialog is open, it returns the
  same pending promise.
* A failed crop emits `error` with `reason: 'crop-failed'`.
* `change.source` tells a pick (`'pick'`), drop (`'drop'`), crop
  (`'crop'`) or API call (`'api'`) apart.
* An `alt` attribute present at parse time never emits `alt-change`; only
  alt text set from code after connect does.
* `ImageInputClient` gains parity: `setSrc()` to set a stored URL,
  `edit()` to crop, error events for `not-an-image` and
  `crop-failed`, `required` intent read from `data-required`, and
  syncs picked/dropped/cropped files into `input.files` via `#setFile`
  so a surrounding form sees the file, keeping a `required` input valid
  after a crop.

### State transitions

| Transition | Held file | `src` | Preview | `required` | Event |
|--|--|--|--|--|--|
| Set non-empty src | Dropped | Set | Src image | Adjusted by rule | None |
| Empty/remove src | Unchanged | Cleared | Empty | Restored to intent | None |
| Pick file | Set | Cleared | File preview | Adjusted | `change` |
| Drop file | Set | Cleared | File preview | Adjusted | `change` |
| `setImage(blob)` | Set | Cleared | Blob preview | Adjusted | `change` |
| `edit()` save on file | Set | Unchanged | File preview | Adjusted | `change` |
| `edit()` save on src | Set | Cleared | Blob preview | Adjusted | `change` |
| Remove button click | Dropped | Unchanged if from src | Empty | Restored if was src | `remove` |
| `clear()` | Dropped | Cleared | Empty | Restored to intent | None |

## Design Decisions

### 1. Never fetch `src`

**Decision:** `src` is treated as a display-only URL. No HEAD request
is made to learn its MIME type.

**Why:** A fetch would add latency and make the component dependent on
network state. An offline editor should still work.

**Consequence:** Extensionless URLs crop to JPEG. For example,
`/api/cover/123` has no extension, so its crop type is `image/jpeg`.
Consumers that care should keep extensions on their URLs.

### 2. `src` never goes into the file input

**Decision:** The inner `<input type="file">` holds only picked,
dropped or cropped files -- never a stored URL.

**Why:** Putting a URL in the input would mean fetching it from the
server; the server already has the image at that URL. A consumer that
submits a form should send nothing for a stored image (the server keeps
what it has), or crop it first via `edit()` to produce a new File.

### 3. Shared pure helpers instead of delegation

**Decision:** Both `ImageInput` and `ImageInputClient` call pure
helpers in `src/file.ts` (`storedSrc`, `guessType`, `cropName`,
`inputRequired`) rather than one delegating to the other or sharing a
state class.

**Why:** The two host classes have different architectures (custom
element vs. plain class) and different lifecycles (reflected attributes
vs. constructor). Factoring the rules into shared helpers keeps the
change scoped to 0.0.14, and keeps each caller in control of its own
wiring and event emission.

### 4. `crossorigin` forwarded to both images

**Decision:** The `crossorigin` attribute is applied to both the
preview `<img>` and the cropper's `<img>`.

**Why:** Both need to load the same URL in the same CORS mode to
share a cache entry. Loading one in CORS mode and the other in
no-CORS mode sends two requests, one of which might get a stale
non-CORS response from cache, poisoning the canvas.

### 5. Crop type and name fixed when dialog opens

**Decision:** When `edit()` opens the crop dialog on a stored URL,
the MIME type and file name are fixed at that moment from the URL
and never change if the URL changes while the dialog is open.

**Why:** Switching `src` mid-crop could change the image dimensions
and MIME type. Locking them when the dialog opens ensures Save always
produces a file whose extension matches its bytes, and whose name
matches the URL that was shown.

### 6. `crop-failed` leaves `edit()` pending

**Decision:** When a crop save fails with `crop-failed`, the error is
emitted, the dialog stays open, and the `edit()` promise does not
settle.

**Why:** A `crop-failed` is recoverable -- the user can click Cancel
to close the dialog and leave the image unchanged, or attempt Save
again on a retry. The promise only settles on Cancel (resolves `null`)
or a successful Save (resolves the `File`).

**Consequence:** A consumer that falls back to a manual crop on
`crop-failed` must be aware that `edit()` is still pending and will
not resolve until the user cancels or succeeds elsewhere. An earlier
cancel of the crop dialog, from a different session, does not settle
a later `edit()` promise. The `#cropInFlight` guard is per-host, not
per session, so a Save click in a new session while an earlier
session's `getBlob()` is pending is silently dropped; this prevents
double-applying a crop.

### 7. `data-required` intent plus `inputRequired` rule

**Decision:** `html()` writes the host's `required` intent as
`data-required` on the file input, and writes the actual `required`
only when `inputRequired(wantsRequired, hasStoredImage)` is true.

**Why:** The host's `required` attribute expresses what the form
wants (an image is needed), but the inner file input's `required`
depends on whether one is already present via `src`. Splitting the
two allows a server-rendered `ImageInputClient` to read intent from
`data-required` and apply the rule dynamically.

### 8. Re-setting the same URL still drops a pick

**Decision:** Setting `src` to the URL already shown still drops any
held file.

**Why:** A consumer's vdom framework (Preact, React) may diff against
the previous prop value and skip setting an unchanged `src`. A
consumer that assigns `el.src` on every render will lose a pick
because the attribute setter runs every time. This predictable behavior
means a consumer can rely on the attribute setter to synchronize state
without worrying about framework diffing.

### 9. Reopening `edit()` on same URL keeps crop rect

**Decision:** Canceling the crop dialog on a stored URL, then calling
`edit()` again on that same URL, uses the previous session's crop rect.
Setting a new `src` resets the rect. A `setFile` session always resets.

**Why:** If a user crops, cancels, and crops again on the same image,
keeping their previous rect selection is helpful. Switching to a
different image requires resetting; `ImageCrop` skips an unchanged
`src`, so the image is not reloaded and the rect is kept. Different
URLs or file-based sessions reset everything.

## Related

* **Design plan:**
  [2026-09-24-src-attribute](../design-plans/2026-09-24-src-attribute.md)
* **ADRs:** [ADR-002](../adr/ADR-002-events-not-dialogs.md) -- editing
  happens through events and `edit()`, not built-in dialogs. This
  feature adds the awaitable `edit()` method for both files and stored
  images.
* **FDRs:** [FDR-001](FDR-001-constrained-crop.md) -- crop constraints
  are applied by `edit()` when opening the dialog.
  [FDR-003](FDR-003-editing-handoff.md) -- the "optional dialog" this
  feature implements, so a consumer can await a crop or drive its own
  UI instead of using a built-in dialog.
  [FDR-005](FDR-005-standalone-crop-dialog.md) -- a consumer can call
  `cropDialog(src, {crossorigin})` directly without `<image-input>`.

## Open Questions

* A form without JavaScript should signal that a stored image has been
  removed, so the server knows to delete it. The current form path
  sends nothing, leaving the server's old image in place. Out of scope
  for 0.0.14.
* Reattaching an `<image-input>` element to the DOM re-renders it and
  loses the held `#file` preview. A stored `src` survives because
  `render()` reads it from the attribute. This is an existing bug,
  orthogonal to this feature, and out of scope.

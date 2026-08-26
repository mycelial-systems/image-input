# FDR-005: Standalone crop dialog

**Status:** Planned
**Last reviewed:** 2026-08-26

## Overview

The crop dialog -- a modal that wraps `<image-crop>` with Save and
Cancel buttons, loads an image into it, and hands the cropped blob back
to the caller -- is usable today only through `<image-input>` or
`ImageInputClient`. A consumer that owns an image through some other
means (an `<image-editor>`, a gallery, a canvas) and wants the same
crop-and-return flow has to rebuild the dialog shell, the save/cancel
wiring, the `getBlob()` guard against double-submit, and the
load-then-crop sequencing from scratch.

This feature extracts that flow into a separately importable function
that any consumer can call with an image and get a cropped blob back,
without pulling in the file-picker component or its markup.

## Behavior

* The package exports a function -- `cropDialog` or similar -- from a
  new subpath (`image-input/crop-dialog`). It accepts an image source
  (a `File`, a `Blob`, or an object URL string) and an optional
  configuration object, and returns a `Promise<Blob | null>`.
* Calling the function creates a `<dialog>` containing an
  `<image-crop>`, opens it as a modal, and loads the image into the
  crop element.
* The dialog renders a heading, the crop element, and a Save/Cancel
  button pair. The heading text and button labels are configurable
  through the options object; defaults match the current built-in
  dialog's copy.
* Save calls `getBlob()` on the crop element and resolves the promise
  with the resulting blob. A second Save click while `getBlob()` is
  in flight is ignored (the same double-submit guard `<image-input>`
  uses today).
* Cancel, Escape, and clicking the backdrop close the dialog and
  resolve the promise with `null`.
* The dialog is removed from the DOM after it closes, so no idle
  `<image-crop>` window listeners survive the interaction.
* The `crop` constraint attribute (free-form, `constrain`, a ratio
  literal, or `circle`) is forwarded to the `<image-crop>` element
  through the options object.
* The caller provides its own stylesheet link or has already loaded
  the package CSS. The function does not inject styles.
* The function is usable without ever importing `<image-input>`. It
  depends only on `<image-crop>` (which it imports internally) and
  the crop stylesheet.
* `<image-input>` and `ImageInputClient` can optionally delegate to
  this function internally, replacing their inline dialog markup and
  save/cancel handlers. Whether they do is an implementation choice,
  not a behavioral one -- the external contract of both is unchanged.

## Design Decisions

### 1. A function returning a promise, not a new element

**Decision:** The standalone crop dialog is a plain async function, not
a custom element like `<image-crop-dialog>`.

**Why:** The dialog is transient -- it opens, the user crops, it closes.
It has no lifecycle that outlives a single interaction, no attributes to
reflect, no shadow DOM to compose with, and no reason to sit in the DOM
between uses. A function call models that: open, await, done. A custom
element would need connection/disconnection management, attribute
forwarding, and a public API for a thing that is simpler as a call.

**Tradeoff:** A consumer cannot place the dialog declaratively in
markup. If a future use case needs a persistent, inline crop panel
rather than a modal, this function does not serve it -- but
`<image-crop>` already does, since it is just the rect and the
interaction without any dialog shell.

### 2. Accepts File, Blob, or object URL -- not HTMLImageElement

**Decision:** The function accepts a `File`, a `Blob`, or a `string`
(treated as an object URL or a same-origin image URL). It does not
accept an `HTMLImageElement`.

**Why:** `<image-crop>.setFile()` takes a `File` today and creates its
own object URL internally, revoking it on disconnect. Accepting a raw
`HTMLImageElement` would mean either cloning it (losing the original's
object URL, which the caller may still own) or sharing it (two owners
for one element, one of whom removes it from the DOM when the dialog
closes). A File/Blob/URL is a value, not a node -- it can be handed
off without ownership ambiguity.

**Tradeoff:** A consumer like `image-editor`, whose edit event carries
an `HTMLImageElement`, has to convert it to a blob or URL before
calling this function. That conversion is a `fetch()` of the image's
`src` or a canvas draw, which is straightforward but not zero-cost.
The alternative -- accepting an element and cloning it -- would hide
that cost rather than eliminate it.

### 3. Resolves with null on cancel, does not reject

**Decision:** Canceling the dialog resolves the promise with `null`
rather than rejecting it.

**Why:** Canceling is a normal outcome, not an error. A consumer should
be able to write `const blob = await cropDialog(file); if (!blob)
return;` without a try/catch for the expected case. Rejection is
reserved for things that actually go wrong -- a file that cannot be
decoded, a canvas that refuses to produce a blob.

**Tradeoff:** A consumer who wants to distinguish "user canceled" from
"no image was ever loaded" (both null) cannot do so from the return
value alone. In practice the distinction is not useful: both mean
"no crop to apply."

### 4. The dialog is ephemeral -- created on call, removed on close

**Decision:** Each call creates a fresh `<dialog>` and `<image-crop>`,
appends them to `document.body`, and removes them after the dialog
closes.

**Why:** `<image-crop>` installs window-level listeners (resize,
pointermove, pointerup, pointercancel) while connected. Keeping an
idle crop element in the DOM between uses means those listeners fire
on every pointer event and every resize on the page, doing nothing.
The current `<image-input>` avoids this by creating the crop element
lazily; the standalone function avoids it by removing the dialog
entirely. Creating a fresh element each time also avoids stale state
from a previous crop leaking into the next one.

**Tradeoff:** A consumer who opens the crop dialog frequently pays
element-creation cost each time. In practice this is a handful of
`createElement` calls and one `showModal()`, which is negligible
compared to the image decode that follows.

### 5. Styling is the caller's responsibility

**Decision:** The function does not inject a `<style>` element or a
`<link>` to the package stylesheet. It expects the crop CSS to already
be loaded on the page.

**Why:** The package already ships `./css/crop` as a separate entry
point. Injecting styles at runtime creates ordering problems (the
injected sheet may load after the dialog is visible), duplication
(multiple calls inject multiple copies), and removal problems (when
should the injected sheet be cleaned up?). Leaving it to the consumer
matches how every other CSS in this package works -- you import or
link the stylesheet you need.

**Tradeoff:** A consumer who forgets to load the crop stylesheet gets
an unstyled dialog. The dialog's own shell markup (heading, buttons)
is intentionally minimal and unstyled beyond what the browser's
`<dialog>` defaults provide, so even without the crop stylesheet the
dialog is functional, just visually rough.

### 6. `<image-input>` may delegate internally but is not required to

**Decision:** Whether `<image-input>` and `ImageInputClient` refactor
their inline crop-dialog code to call this function is left as an
implementation choice, not a requirement of this feature.

**Why:** The external behavior of `<image-input>` is unchanged either
way. Forcing the refactor ties two features together in a single
change, and `<image-input>`'s dialog has small differences (it reads
the `crop` attribute from the host, it guards on `nocrop`, it uses
the host's `TEXT` static for copy) that would need to be threaded
through the function's options. If the shared code simplifies things,
do it; if threading the options is more complex than the duplication
it removes, don't.

**Tradeoff:** If both paths are kept, a bug fix to the save/cancel
logic has to be applied in two places. The double-submit guard, the
"dialog closed during await" check, and the `getBlob()` error
handling are the three pieces most likely to drift.

## Related

* **ADRs:** [ADR-002](../adr/ADR-002-events-not-dialogs.md) -- the
  decision that moved editing UI out of `<image-input>`. This feature
  is the opt-in dialog module that ADR-002's consequences anticipated
  consumers would need.
* **FDRs:** [FDR-001](FDR-001-constrained-crop.md) -- the `crop`
  attribute this function forwards.
  [FDR-003](FDR-003-editing-handoff.md) -- the handoff model this
  feature plugs into; its first open question is exactly this feature.
  [FDR-004](FDR-004-crop-lifecycle-events.md) -- the `load` event
  the function may use internally to know when Save is safe.

## Open Questions

* Whether the function should also accept `getBlob` options (MIME type,
  quality) through its own options object, or whether those are rare
  enough that a consumer who needs them should use `<image-crop>`
  directly. The current `<image-input>` crop dialog does not expose
  them.
* Whether the dialog shell should emit its own events (e.g.
  `crop-dialog:save`, `crop-dialog:cancel`) in addition to resolving
  the promise, for consumers who want to react to the interaction
  without awaiting the result.
* Whether this resolves FDR-003's first open question definitively
  enough to remove it from that record, or whether the "opt-in dialog
  module" question there contemplated something broader (e.g. an
  alt-text dialog too).

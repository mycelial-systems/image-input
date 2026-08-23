# FDR-004: Crop lifecycle events

**Status:** Implemented
**Last reviewed:** 2026-08-23

## Overview

`<image-crop>` announces two moments in its lifecycle:
`image-crop:load`, fired once the source image has decoded and the
crop rect has been fitted to it, and `image-crop:change`, fired every
time the crop rect itself changes. Together they are the only
supported way to know the element is usable and to track the rect it
holds -- there is no polling API for either.

## Behavior

* `image-crop:load` fires from `#handleImageLoad`, the `load` handler
  on the internal `<img>`. Its `detail` is
  `{ naturalWidth:number, naturalHeight:number }`. Before it fires,
  `crop` reads `{ x: 0, y: 0, width: 0, height: 0 }` and `getBlob()`
  rejects. It fires once per image, so calling `setFile()` again on
  the same element fires it again.
* `image-crop:change` fires whenever `#crop` is reassigned: a pointer
  drag, a keyboard move or resize, the `crop` attribute changing
  (`handleChange_crop`), and once on load with the rect
  `#handleImageLoad` just fitted. Its `detail` is the crop rect,
  `{ x:number, y:number, width:number, height:number }`, in natural
  (not displayed) image pixels.
* On load, `image-crop:load` is emitted before `image-crop:change`.
  Both fire synchronously, one after the other, from the same
  handler.
* Both are declared on `ImageCropEventMap` and augmented onto
  `HTMLElementEventMap` in `src/crop.ts`, so they bubble and are
  usable with a plain `addEventListener` as well as with the
  `.on()`/`.off()` helpers from `@substrate-system/web-component`.

## Decisions

### 1. `load` exists at all

**Decision:** Add an `image-crop:load` event rather than leaving
readiness undiscoverable.

**Why:** `#handleImageLoad` was already the only place the element
became usable -- it is where `#naturalWidth`/`#naturalHeight` get
set and where the initial `#crop` rect gets fitted -- but it announced
nothing. A consumer had no supported way to learn when `crop` stopped
reading `{0,0,0,0}` or when `getBlob()` would stop rejecting, so the
only option was polling `el.crop.width > 0`. This repo's own test
helpers did exactly that before this event existed. `load` replaces
the poll with a signal.

### 2. `change` also fires on load

**Decision:** `#handleImageLoad` emits `change` with the freshly
fitted rect, immediately after emitting `load`, rather than treating
load as a special case that only `load` covers.

**Why:** Every other place that reassigns `#crop` --
`handleChange_crop`, the pointer-move handler, the keyboard handler --
ends by emitting `change`. Load was the one exception to that
invariant: it set `#crop` for the first time but said nothing. Leaving
it that way would mean a consumer tracking the rect purely from
`change` never saw the initial value, only whatever the first drag or
attribute change produced, and would still need a separate `load`
listener just to learn the starting rect. Firing `change` here too
keeps "every mutation of `#crop` is announced" true without exception,
so a `change`-only listener sees every rect the element has ever had.

### 3. `load` before `change`

**Decision:** `#handleImageLoad` emits `load`, then `change`, in that
order, not the reverse.

**Why:** `load` answers "is the element ready" and `change` answers
"what is the value." Readiness has to be established before the value
is meaningful, so a listener attached to both events reads them in the
order the words themselves suggest: first that there is an image,
then what its crop rect is.

### 4. No event on a decode failure

**Decision:** There is deliberately no event for a broken image. If
the `src` a `<image-crop>` is pointed at fails to decode, the element
emits nothing at all -- not `load`, not an `image-crop:error`, nothing.

**Why:** Nothing about a decode failure needed a lifecycle event for
this record to be settled: `#handleImageLoad` is registered against
the `<img>`'s native `load` event only, and there is no matching
`error` listener anywhere in `src/crop.ts`. Adding one is a real
option for later, but it was scoped out here rather than added
speculatively alongside `load`, so this is a non-goal rather than an
oversight. A consumer that needs to detect a broken image today has
to validate the file or the URL before handing it to `<image-crop>`.

## Related

* **ADRs:** [ADR-002](../adr/ADR-002-events-not-dialogs.md) -- the
  decision that made `<image-crop>` a first-class element with an
  event vocabulary of its own, rather than an internal detail of the
  `<image-input>` dialog that used to contain it. `load` and `change`
  are that vocabulary's lifecycle half.
* **FDRs:** [FDR-002](FDR-002-crop-rect-direct-manipulation.md) --
  decision 6 there establishes that `change` reports natural-image
  pixels; this record covers when `change` fires, not what it
  contains.

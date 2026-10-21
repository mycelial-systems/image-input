# FDR-007: Crop zoom

**Status:** Implemented
**Last reviewed:** 2026-10-20

## Overview

A locked crop ([FDR-001](FDR-001-constrained-crop.md)) used to be able
to shrink only inside the image. That is wrong for the most common
fixed shape there is, the 1.91:1 link card. A square logo or a portrait
photo cannot become a card without losing its top and bottom. This
feature gives a locked crop a window with the image behind it.
The image can be zoomed in and out and dragged around. Zoomed out past
its own edges, the rest of the window is padded with a color.

## Behavior

* Under a locked ratio (`constrain`, `circle` or a ratio literal) the
  Crop Frame is the image fitted to the container, as with free-form
  cropping. The crop window starts as the largest rect of the locked
  ratio, centered in the frame. The image zooms and pans behind it.
  Free-form cropping is unchanged.
* Dragging inside the window moves the window over the still image,
  so the crop becomes what the window now covers. It stays inside the
  frame and is clamped like a pan, so it stops at the image's edge and
  cannot open up padding. The window shows a `move` cursor.
* Dragging anywhere else on the frame pans the image. The frame shows
  a `grab` cursor, and `grabbing` during a drag. Arrow keys on the
  focused window pan the image in the arrow's direction.
* Each axis is clamped on its own. An image larger than the window on
  that axis must cover it. An image smaller than the window on that
  axis must sit wholly inside it. So padding appears only after zooming
  out past the image, never from a drag.
* A zoom slider, a native `<input type="range">` labelled "Zoom", sits
  under the frame. It appears only under a locked ratio and is `hidden`
  otherwise. Shift plus up or right zooms in, shift plus down or left
  zooms out, and the slider follows.
* The slider's value is `stage width / crop width`. The *stage* is the
  smallest rect of the locked ratio that contains the whole image, so
  at 1 the whole image fits inside the window. Its maximum is 4x past
  the cover rect. Zooming keeps the center of the window fixed.
* The four corner handles resize the window, anchored at the opposite
  corner and holding the ratio. The image stays still, so the crop
  becomes what the window now covers. The window keeps that size and
  place through later pans and zooms, and scales with the frame when
  the container resizes. A new image or a new `crop` value resets it.
* A corner drag is held to the zoom slider's range, so the window
  stops growing at zoom 1 and stops shrinking at the maximum. It is
  clamped like a pan, so it cannot open up padding either. The edge
  handles stay hidden ([FDR-001](FDR-001-constrained-crop.md)
  decision 4).
* The crop still starts as the cover rect, the largest rect of the
  ratio inside the image, so opening the cropper frames the image as it
  always has.
* `fill` is an attribute on `<image-crop>`, forwarded from
  `<image-input fill>` and from `cropDialog({ fill })`. It takes any
  color a canvas `fillStyle` accepts and defaults to `#fff`. Under a
  lock the frame's background is the fill, so the padding on screen
  matches the padding in the output.
* `getBlob()` paints the fill behind the image only when the crop
  extends past the image. A crop inside the image produces the same
  bytes it always did.
* The `crop` getter and `image-crop:change` still report image natural
  pixels. A padded crop has a negative `x` or `y`, or extends past
  `naturalWidth` or `naturalHeight`.

## Design Decisions

### 1. A window, with the image moving behind it

**Decision:** Under a lock, zooming and dragging the image move the
image behind the crop window. The window changes only when the user
grabs it: a drag inside it moves it, and a corner handle resizes it.

**Why:** Zoom is about the image. The first version of this feature
kept the image still and grew the crop rect over a padded stage
instead. Mathematically that is the same crop, but on screen the image
never got smaller, so "shrink the image to fit the card" read as
"adjust the rect" and did not look like zooming. A fixed window is also
what people already know from avatar and banner croppers.

**Tradeoff:** A locked crop and a free-form crop now have different
interaction models: pan and zoom versus moving and resizing the rect.
The corner handles are the overlap. The first version of this model
dropped them, which took away the most direct way to frame a crop, so
they came back as a resize of the window. That version also panned the
image on a drag inside the window. A corner drag could then park the
window against an edge of the frame, where a drag inside it pushed the
crop off the image and the clamp held it still, so the window could
not be dragged back. A drag inside the window now moves the window, so
one frame has two drag behaviors, split at the window's edge.

### 2. The crop and the window are the only state

**Decision:** `#crop`, in natural pixels, and `#window`, the locked
window in the frame's natural pixels, are the only state. The scale
and the image's position on screen are derived from them on every
layout. `#window` is `null` until a corner drag, meaning the largest
centered window. The stage is derived when a zoom needs it.

**Why:** The window's size is the user's choice once corner handles
resize it, so it cannot be derived from the crop. Storing it in the
frame's natural pixels, the space a free-form rect uses, means resizing
the container re-lays out from the same two rects. The public contract
(`crop`, `image-crop:change`, `getBlob()`) did not change.

**Tradeoff:** Two rects have to be reset together. Both are reset in
the same two places, on image load and on a `crop` attribute change.

### 3. A native range input

**Decision:** The control is `<input type="range">`, not a custom
widget.

**Why:** It brings keyboard, touch and assistive-tech support from the
platform ([ADR-001](../adr/ADR-001-use-platform-primitives.md)).

**Tradeoff:** Its look varies by browser. `accent-color` through
`--image-crop-zoom-accent` is the only theming hook.

### 4. Fill only when padded

**Decision:** `getBlob()` paints `fill` only when the crop extends
past the image.

**Why:** Every consumer that never zooms out gets byte-identical output,
including transparent PNGs, whose transparent pixels a blanket fill
would destroy.

**Tradeoff:** A transparent image that is zoomed out gets the fill
behind its transparent pixels too, not only in the padding. Use
`fill="transparent"` with a PNG or WebP type to keep it.

### 5. Zoom is computed in natural pixels

**Decision:** A zoom sizes the crop as the stage's width and height
divided by the zoom value, in natural pixels.

**Why:** At zoom 1 the crop is exactly the stage's size, with no trip
through display pixels. A trip like that can land a fraction of a pixel
short, and the canvas truncates sizes, so the encoded image would lose
a row.

**Tradeoff:** Zoom 1 is the stage's exact size but not always its
position. A crop panned sideways while zoomed out keeps that offset at
zoom 1.

## Related

* **ADRs:** [ADR-001](../adr/ADR-001-use-platform-primitives.md)
* **FDRs:** [FDR-001](FDR-001-constrained-crop.md) -- the lock this
  extends. [FDR-002](FDR-002-crop-rect-direct-manipulation.md) -- the
  free-form interaction, which a locked crop no longer uses.

## Open Questions

* Whether the slider should be logarithmic rather than linear. Linear
  spends most of its travel on the high zooms.
* Mouse-wheel and pinch zoom. Most croppers have them. They are left
  out to keep this change small.
* Whether free-form cropping should get a zoom too. Without a ratio
  there is no window shape to pad out to.
* JPEG has no transparency, so `fill="transparent"` with JPEG output
  encodes black padding. That is documented, not prevented.

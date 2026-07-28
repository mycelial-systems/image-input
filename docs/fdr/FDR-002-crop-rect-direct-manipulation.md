# FDR-002: Crop rect direct manipulation

**Status:** Implemented
**Last reviewed:** 2026-07-28

## Overview

The crop tool's core interaction: a rectangle drawn over the image
that the user drags to reposition and drags by its handles to resize.
This is the base behavior that every crop is built on, including the
shape-locked variants described in [FDR-001](FDR-001-constrained-crop.md).
It has to work identically for a mouse, a finger and a pen, and has to
be fully operable from a keyboard for anyone who cannot do a drag at
all.

## Behavior

* A dashed rectangle sits over the displayed image with eight round
  handles, one per corner and one per edge midpoint.
* Dragging anywhere inside the rectangle moves it. Dragging a handle
  resizes it from that side or corner.
* The area outside the rectangle is dimmed, so the selection reads as
  the part of the image being kept.
* Mouse, touch and pen all work, and behave the same way. A touch drag
  on the rectangle or a handle moves the crop rather than scrolling
  the page; a touch outside the rectangle scrolls the page as usual.
* Releasing outside the element, or dragging past the window edge,
  does not drop the drag. It continues until the pointer is released.
* The rectangle is focusable. Arrow keys move it, shift plus an arrow
  key resizes it, in fixed steps.
* The rectangle stays fully inside the image at all times. A drag or
  keypress that would push it past an edge stops at the edge.
* It cannot be shrunk below a small floor on either axis, so it can
  never collapse to something the user cannot grab again.
* Every change, from any input method, reports the rectangle in
  natural-image pixel coordinates rather than screen pixels, so a
  consumer's stored crop does not depend on the size the image
  happened to be displayed at.
* Resizing the window, or otherwise changing the available width,
  re-lays out the image and the rectangle together. The crop the user
  chose is preserved across the relayout.

## Design Decisions

### 1. One Pointer Events path for mouse, touch and pen

**Decision:** All dragging is implemented once against Pointer Events.
There is no separate mouse path and no separate touch path, and no
library.

**Why:** Pointer Events unify the three input types and, through
pointer capture, already deliver events to the element that was
grabbed even after the pointer leaves it. Writing mouse and touch
paths separately means two implementations of the same arithmetic that
must agree, and a hand-rolled version of capture built on document
listeners. This follows ADR-001: the platform does this already.

**Tradeoff:** Behavior now depends on the browser's gesture
recognizer, which can take a gesture away from us mid-drag -- see
decision 2. That failure mode does not exist when handling raw touch
events, and it is invisible on a desktop, which is where the component
is usually developed.

### 2. `touch-action: none` on the rectangle, not on the frame

**Decision:** The crop rectangle opts out of the browser's own touch
gestures. The image and the dimmed area around the rectangle do not.

**Why:** Without this, dragging does not work on a touchscreen at all.
The browser's gesture recognizer claims a touch drag as a page pan
after a couple of pixels and fires `pointercancel`, which correctly
ends the drag -- so the rectangle freezes after a few pixels and the
page scrolls instead. Calling `preventDefault()` on `pointerdown` does
not prevent this; `touch-action` is the only mechanism that does.

Scoping it to the rectangle rather than the whole frame is what keeps
the page scrollable: the effective value for a touch is the
intersection of the hit element's value with all of its ancestors', so
one declaration on the rectangle also covers the handles nested inside
it, while a touch on the dimmed area outside still pans the page. On a
phone the crop dialog is taller than the viewport, so leaving some of
the image pannable matters.

**Tradeoff:** The guarantee depends on the handles staying descendants
of the rectangle in the markup. Nothing in the DOM enforces that, and
moving a handle out would silently restore the original bug on
touchscreens only. A test asserts both the declaration and the
containment for that reason.

### 3. Snapshot the start state, recompute from the total delta

**Decision:** A drag records the rectangle and the pointer position at
`pointerdown`, then recomputes the new rectangle from that snapshot
plus the total distance moved. It does not apply each event's
incremental delta to the live rectangle.

**Why:** Clamping makes incremental application lossy. Once a drag hits
an edge, the clamped position no longer reflects the pointer, and the
difference is silently discarded -- so dragging back off the edge
starts from the wrong place and the rectangle drifts away from the
cursor. Recomputing from the original snapshot means clamping is
applied fresh each time and never accumulates.

**Tradeoff:** Every move recomputes the whole rectangle rather than
adjusting it, and the snapshot is one more piece of drag state to
invalidate correctly when a drag ends or is cancelled.

### 4. Clamp to the image rather than refusing the drag

**Decision:** A drag that would take the rectangle outside the image,
or below the minimum size, is clamped to the limit. It is not ignored,
and it does not end the drag.

**Why:** Ignoring the event freezes the rectangle mid-gesture, which
reads as the component having crashed. Clamping keeps it visibly
tracking the pointer along whichever axis is still free, which is what
every other cropper does and what a user sliding along an edge expects.

**Tradeoff:** The rectangle stops following the pointer exactly, so
the pointer can end up some distance outside the rectangle it is
dragging. Releasing and re-grabbing re-syncs them.

### 5. Keyboard operation on the rectangle itself

**Decision:** The rectangle is a single focusable element with a
descriptive accessible name. Arrow keys move it and shift plus arrows
resize it. The eight handles are decorative and hidden from assistive
technology; they are not individually focusable.

**Why:** Making each handle a tab stop would put nine stops in the
dialog for one control and would still not tell a screen reader user
what any of them does. One focusable region with one label describes
the whole interaction, and the shift modifier maps the two things a
drag can do onto the same keys.

**Tradeoff:** Keyboard resizing has less reach than a drag: it always
resizes from the same side, so there is no keyboard equivalent of
grabbing a specific corner. The label has to change between free-form
and locked modes to stay accurate.

### 6. Crop state is reported in natural-image pixels

**Decision:** The `crop` getter and the `image-crop:change` event
always describe the rectangle in the source image's own pixel
coordinates. Display pixels exist only inside the drag arithmetic.

**Why:** Display size depends on the container, the viewport and the
height cap, none of which the consumer controls or should have to
record. A crop stored in display pixels is meaningless the moment the
image is shown at a different size, and would have to be re-scaled by
every consumer.

**Tradeoff:** The conversion happens on every pointer move, and the
values are fractional rather than whole pixels, so a consumer
comparing crops needs a tolerance rather than equality.

## Related

* **ADRs:** ADR-001
* **FDRs:** [FDR-001](FDR-001-constrained-crop.md) -- the shape-locking
  layer on top of this interaction. It changes which handles are shown
  and what a corner drag does, but not the mechanics described here.

## Open Questions

* The handles are around 14px including their border, which is under
  the 24px minimum in WCAG 2.2 SC 2.5.8 and well under the ~44px that
  is comfortable for a finger. Dragging works on a touchscreen now, but
  acquiring a handle is still harder than it should be. The usual fix
  is a transparent `::before` that enlarges the hit area without
  changing the painted dot; whether the handles should also be drawn
  larger on coarse pointers is a separate question.
* Whether a pinch gesture should scale the rectangle. Ruled out for
  now -- `touch-action: none` makes it implementable, but it competes
  with browser page zoom and has no keyboard equivalent.

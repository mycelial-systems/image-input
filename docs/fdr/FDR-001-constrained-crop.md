# FDR-001: Constrained crop

**Status:** Implemented
**Last reviewed:** 2026-07-25

## Overview

By default the crop tool is free-form: the rect starts at the whole
image and the user can drag it to any shape. That is right for
general-purpose cropping and wrong for the most common reason people
reach for a cropper, which is producing an image that has to be a
particular shape -- an avatar, a card thumbnail, a banner. This
feature adds a `crop` attribute that locks the crop rect to a fixed
aspect ratio, so a consumer can guarantee the shape of what comes back
without validating it afterwards or writing their own crop UI.

## Behavior

* The `crop` attribute is accepted on both `<image-input>` and
  `<image-crop>`. An `<image-input>` passes its value through to the
  `<image-crop>` it creates for the crop dialog.
* With no `crop` attribute, the cropper behaves exactly as it does
  today: free-form rect, starting at the full image, eight resize
  handles.
* `crop="constrain"` locks the rect to the aspect ratio of the source
  image. The user can still move the rect and scale it up or down, but
  never change its proportions.
* `crop="3/4"` locks the rect to that ratio. The value follows CSS
  `aspect-ratio` syntax, so `3/4`, `3 / 4` and the bare number `0.75`
  are all accepted and mean the same thing.
* `crop="circle"` locks the rect to 1:1 and draws the crop area as a
  circle rather than a square.
* When a ratio is locked, the rect starts as the largest rect of that
  ratio, centered on the image, rather than covering the whole image.
* When a ratio is locked, only the four corner handles are shown. A
  corner drag anchors the opposite corner and scales the rect
  proportionally.
* Keyboard resizing (shift plus an arrow key) scales the locked rect
  proportionally instead of resizing one axis. Plain arrow keys move
  the rect, unchanged.
* The rect stays fully inside the image at all times. A drag or
  keypress that would push it past an edge stops at the edge instead
  of breaking the ratio.
* Changing the attribute after an image has loaded re-fits the rect to
  the new constraint.
* The cropped `Blob` is unaffected by the constraint beyond its
  dimensions. A circle crop yields an ordinary square image at the
  rect's natural-pixel size, in whatever type the caller requested.
  Displaying it as a circle is the consumer's `border-radius`.
* A value that is not a keyword and not a usable ratio -- misspellings,
  zero, negative, non-finite -- falls back to free-form cropping and is
  reported through the debug channel. Nothing is thrown and no error
  event fires.

## Design Decisions

### 1. One attribute with three value forms, not three attributes

**Decision:** `constrain`, `circle` and a ratio literal are all values
of a single `crop` attribute, and all three resolve to one number: the
locked aspect ratio. `constrain` reads that number off the loaded
image, `circle` hardcodes 1, a literal parses it.

**Why:** They are the same feature. Separate `aspect-ratio`,
`constrain` and `circle` attributes would need rules for what happens
when two of them are set at once, and would spread one constraint
across three code paths that must agree. Collapsing them means the
constraint logic is written and tested once, and conflicting
combinations are unrepresentable.

**Tradeoff:** The attribute mixes keywords and a value syntax, so
`crop` is not a plain enum and cannot be validated by reading the
attribute alone. It also spends the good name `crop` on shape
specifically, which forecloses using the same attribute later for an
unrelated crop concern such as disabling the feature.

### 2. The same attribute name on both elements

**Decision:** The attribute is called `crop` on `<image-input>` and on
`<image-crop>`, and `<image-input>` forwards the raw string.

**Why:** `<image-crop>` is a documented, independently usable export,
not a private implementation detail, so it needs its own way to express
the constraint. Using one name means one vocabulary in the README and
a forwarding step with no mapping table that could drift out of sync
with the values it maps.

**Tradeoff:** `crop` is a redundant name on an element already called
`image-crop`; something like `shape` would read better there in
isolation. Symmetry with the parent was judged worth more than the
better local name.

### 3. Circle is a crop-UI affordance, not a pixel mask

**Decision:** `crop="circle"` constrains and decorates the crop UI. It
does not clip the output image, and does not change the encoding.

**Why:** Baking a circular mask into the file requires transparency,
which forces PNG. That would silently override the caller's requested
MIME type, or produce black corners if they insisted on JPEG, and would
make the type option conditionally meaningless. It would also destroy
information: a stored square can be displayed round, but a stored round
image cannot be displayed square. Real avatar pipelines store squares
and round them in CSS.

**Tradeoff:** A consumer who genuinely wants transparent corners in the
stored bytes has to do that step themselves. `crop="circle"` promises
less than its name suggests, so the README has to be explicit that the
blob is square.

### 4. Corner handles only when a ratio is locked

**Decision:** The four edge handles are hidden while a constraint is
active.

**Why:** An edge handle drag under a locked ratio has no honest
behavior. Dragging the east handle must also change the height, which
means moving a side the user did not grab, and there is no
non-arbitrary answer for which direction that side moves. A corner drag
has exactly one sensible anchor, the opposite corner. Dropping the
handles that cannot behave well also communicates the lock before the
user has attempted a drag.

**Tradeoff:** The handle set changes between modes, so the crop rect's
markup is not constant and the keyboard interaction has two variants to
describe in its accessible label.

### 5. Circular chrome via border-radius and a spread shadow

**Decision:** In circle mode the four rectangular dim panels are hidden
and the crop rect itself dims the rest of the image, using a rounded
border plus a large spread `box-shadow`.

**Why:** Four rectangles cannot cut a round hole. A spread shadow
follows the element's border radius, so a single element produces both
the round crop outline and the dimming around it, with no second
rendering technique and no SVG or canvas mask. This follows ADR-001:
the platform already does this, so we do not build a masking layer.

**Tradeoff:** The frame needs `overflow: hidden` to contain the
oversized shadow, and circle mode and rectangle mode dim the image by
two different mechanisms, so the dim color has to look identical
through both.

### 6. Invalid values fall back rather than fail

**Decision:** An unparseable or nonsensical `crop` value produces a
free-form cropper and a debug message.

**Why:** The component treats bad input this way everywhere else --
a non-image drop emits an event rather than throwing, an
unconstructable `DataTransfer` is caught and ignored. A cropper the
user can still operate is a better failure than a broken dialog, and
an attribute typo is a development-time mistake that the debug channel
already serves.

**Tradeoff:** A typo in production is invisible to the end user, who
gets a free crop where the application expected a fixed shape. The
guarantee the attribute offers is therefore best-effort unless the
consumer checks the returned blob's dimensions.

## Related

* **ADRs:** ADR-001
* **FDRs:** none yet

## Open Questions

* Whether a locked ratio should also be able to set a minimum output
  size, so a consumer can reject a crop that scales a 200px selection
  up to a 1000px avatar. Deliberately left out for now: it is a
  separate constraint, and the consumer can check the blob.
* Whether `constrain` should re-fit when a *new* image is loaded into
  an already-open cropper with a different native ratio. The stated
  behavior is that it does, since the ratio is read on image load, but
  this has a visible consequence worth confirming against real use --
  the crop shape changes under the user between images.

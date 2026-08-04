# FDR-003: Editing handoff

**Status:** Planned
**Last reviewed:** 2026-08-03

The behavior below is the target described by
[ADR-002](../adr/ADR-002-events-not-dialogs.md). The shipped component
still renders its own dialogs; this record describes what replaces
them.

## Overview

`image-input` owns a file and its preview. It does not own any surface
for editing that file. When the user asks to crop the image or to write
alt text, the component announces the request and stops; the
application shows whatever UI it likes, and writes the result back
through two public entry points. This is the seam between the package
and its consumer, and every editing feature crosses it.

## Behavior

* The preview overlay carries the two triggers: an Edit button and an
  ALT badge. Both are rendered whenever an image is present, unless the
  Edit button is suppressed by `nocrop` (below).
* Clicking Edit emits `image-input:edit` carrying the current `File`.
  Nothing else happens -- no dialog opens, no `<image-crop>` is
  created, no markup changes.
* Clicking the ALT badge emits `image-input:alt` carrying the current
  `File` and the current alt text. Again, nothing else happens.
* Neither event has a default behavior, so neither is cancelable.
  `preventDefault()` on them does nothing.
* Both bubble, so an application can listen once on an ancestor and
  serve every `<image-input>` under it.
* The application responds however it wants: a native `<dialog>`, a
  route, an inline panel, a full-page editor. The component does not
  know and does not care.
* To apply a crop, the application calls `setImage(blob)`. The
  component swaps the preview, writes the blob back into the file
  input as a `File`, and emits `image-input:change`.
* To apply alt text, the application sets the `alt` attribute or
  property. The component updates the preview image's `alt`, switches
  the badge to its filled state, and emits `image-input:alt-change`.
* An application that listens to nothing still gets a working control:
  picking, dropping, previewing, removing, form participation and
  validation are all unaffected. Only editing is inert.
* `nocrop` is a boolean attribute on `<image-input>`. While it is
  present the Edit button is not shown and `image-input:edit` never
  fires, so an application that supplies no crop UI can render a
  preview with no dead affordance instead of a button that appears
  broken.
* `nocrop` suppresses the trigger and nothing else. The ALT badge,
  Remove, picking, dropping, the preview, form participation and
  `setImage()` all behave as they do without it -- an application can
  still replace the image programmatically while offering the user no
  way to ask for it.
* The attribute is honored whether it is written into the served
  markup or toggled at runtime, and takes effect immediately with no
  re-render.
* `nocrop` and `crop` never appear on the same element and do not
  interact: `nocrop` is about whether `<image-input>` offers a trigger,
  `crop` is about the shape a cropper enforces once the application has
  created one.
* `<image-crop>` is a separate exported element the application places
  itself. It is the crop UI -- rect, constraint, drag and keyboard
  interaction, and `getBlob()`. See
  [FDR-001](FDR-001-constrained-crop.md) and
  [FDR-002](FDR-002-crop-rect-direct-manipulation.md).
* `<image-crop>` installs window listeners while it is connected --
  resize, and the three pointer events a drag needs -- so an
  application is expected to render it when an edit starts rather than
  keep one alive per `<image-input>` on the page. The component used to
  create it lazily for this reason; that judgement moves to the
  consumer along with the element.
* The package stylesheet styles the picker, the preview, the overlay
  and `<image-crop>`. It styles no dialog, and exposes no dialog custom
  properties.

## Design Decisions

### 1. The component keeps the triggers, not the editors

**Decision:** The Edit button and the ALT badge stay in the component's
markup. Only the UI they lead to moves out.

**Why:** Both are positioned inside the preview overlay, on top of the
image, and are part of the preview's layout and hover behavior rather
than part of the editing flow. Moving them out would mean the consumer
re-creating overlay positioning that only makes sense against markup we
own. A trigger is also the one part of this flow with no design-system
opinion in it: it is a button on an image.

**Tradeoff:** The component now renders affordances whose behavior it
does not supply, so an application that ignores the events ships two
buttons that appear broken. That failure is silent and looks like a bug
in the package. `nocrop` (decision 5) gives the application a way out
for the Edit button, but it is opt-in: the default is still a visible
trigger for behavior that may not exist, and the ALT badge has no
equivalent.

### 2. Notifications, not cancelable pre-events

**Decision:** `image-input:edit` and `image-input:alt` are dispatched
non-cancelable.

**Why:** Cancelability described a real thing while a built-in dialog
existed -- `preventDefault()` suppressed it. With nothing left to
suppress, a cancelable event would advertise a hook that does nothing,
and would leave the emitters checking a return value no code path acts
on.

**Tradeoff:** Existing consumers who cancel these events to install
their own UI keep working by accident rather than by contract, and get
no signal that the call is now dead code. The migration note has to
call it out explicitly, since nothing throws.

### 3. State stays in the component, UI leaves

**Decision:** The component remains the owner of the selected file, the
preview object URL, `input.files` and the alt text. The application
gets those values in event details and writes results back through
`setImage()` and `alt`.

**Why:** Those four things are coupled: swapping the preview means
revoking one object URL and creating another, and keeping the hidden
file input in sync so the surrounding form still submits and
`required` still validates. Handing that out alongside the UI would
leave the component owning nothing coherent and would put object-URL
lifetime bugs in every consumer. Two write-back entry points is a
smaller contract than the state itself.

**Tradeoff:** The application cannot represent an editing state the
component has no concept of -- a pending crop that is not yet applied,
for instance, or alt text saved as a draft. Anything mid-flight lives
in application state until it is written back.

### 4. `<image-crop>` is the reusable half

**Decision:** The crop element is a documented, independently usable
export, and is not created by `<image-input>` at any point.

**Why:** What is genuinely hard about cropping -- the constrained rect,
pointer capture, keyboard operation, natural-pixel coordinates, canvas
encoding -- is all inside `<image-crop>` and is worth shipping. What
contained it was a dialog, which is not. Separating them means the hard
part is reusable outside the file-input context entirely.

**Tradeoff:** The crop flow now spans two elements the consumer wires
together, and the wiring -- create the crop element, give it the file,
call `getBlob()`, hand the blob to `setImage()` -- is code every
consumer writes and can get wrong. The README and the example have to
carry a version worth copying.

### 5. Suppression is a boolean `nocrop` on the host

**Decision:** Hiding the Edit button is a boolean `nocrop` attribute on
`<image-input>`. The two more natural spellings, `crop="none"` and a
`crop` attribute on the host, are both unavailable.

**Why:** `crop` is spent. It names the crop *shape*, and it lives on
`<image-crop>` rather than the host ([FDR-001](FDR-001-constrained-crop.md)
decisions 1 and 2, whose stated tradeoff was precisely this: the name is
foreclosed for any other crop concern). It is also the wrong element to
ask on. The question is whether `<image-input>` offers the trigger, not
how a cropper behaves once one exists, and only the host knows the
former. A separate boolean answers it in the markup a page author
writes, and matches how the platform spells its own negative booleans --
`novalidate`, `nomodule`, `formnovalidate` are all unhyphenated
([ADR-001](../adr/ADR-001-use-platform-primitives.md)).

**Tradeoff:** Negative booleans are harder to reason about than positive
ones. There is no way to spell "cropping enabled" explicitly, so a
consumer templating the attribute has to omit it rather than set it to
false, which is awkward in most template languages. The name also claims
more than it delivers: it removes the trigger, it does not make the
image uncroppable, since `setImage()` still accepts a blob from anywhere.

### 6. Hidden by stylesheet, inert by guard, unchanged in markup

**Decision:** The package stylesheet hides the button with a rule keyed
to `image-input[nocrop]`, and the edit handler returns early while the
attribute is set. The rendered markup is identical either way, and
`html()` gains no option.

**Why:** The attribute sits on the host, which the consumer writes in
both the server-rendered and the upgraded-element path, so a stylesheet
rule covers both with nothing to plumb through `html()` and nothing that
can disagree with the attribute it would duplicate. `display: none` also
drops the button from the tab order and the accessibility tree, so the
hiding is complete rather than visual, and toggling the attribute at
runtime needs no re-render and no listener re-wiring. The handler guard
covers what CSS cannot: a scripted click, or a page that never loaded
the stylesheet. With it, `image-input:edit` cannot fire while `nocrop`
is set, which is the part of this that is a contract.

**Tradeoff:** The button is still in the DOM, so anyone reading the
markup sees an element that is not there for the user, and a consumer
shipping their own stylesheet instead of ours gets a visible button that
does nothing -- the guard makes it inert but cannot make it disappear.
Suppression is also spread across two files that have to stay in
agreement, with only the guard covered by anything a test can assert
without loading real CSS.

## Related

* **ADRs:** [ADR-002](../adr/ADR-002-events-not-dialogs.md) is the
  boundary this feature implements.
  [ADR-001](ADR-001-use-platform-primitives.md) still applies to what
  remains: events are `CustomEvent`s, and the application's own dialog
  is expected to be a native `<dialog>`.
* **FDRs:** [FDR-001](FDR-001-constrained-crop.md),
  [FDR-002](FDR-002-crop-rect-direct-manipulation.md) -- the crop
  element this feature hands off to. FDR-001 is also why suppression
  needed a name of its own rather than a `crop` value.

## Open Questions

* Whether the package should also ship an opt-in dialog module, imported
  separately, for consumers who want the old drop-in behavior and have
  no design system to conflict with. It would restore the two code paths
  ADR-002 removed, but only for consumers who ask for it by name.
* Whether the ALT badge should be suppressible too, by a companion
  `noalt`. `nocrop` settles the Edit button, but the alt case is
  weaker: alt text is an accessibility obligation rather than an
  optional editor, so an application that renders no alt UI is choosing
  to ship images without alt text, and an attribute that makes that
  choice tidy is not obviously worth providing.
* Whether `image-input:alt` should carry the file at all. The
  application almost always needs only the current alt text, and the
  file is there for symmetry with `image-input:edit`.

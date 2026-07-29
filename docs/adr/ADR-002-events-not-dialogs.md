# ADR-002: The component emits events, the application owns editing UI

**Date:** 2026-07-29

Supersedes the dialog-related parts of
[ADR-001](ADR-001-use-platform-primitives.md): the third and fifth
bullets of its decision, and its note about the `overlay` transition
property.

## Context

`image-input` shipped two dialogs of its own: an alt-text dialog and a
crop dialog, both built as markup strings in `src/dialogs.ts`, rendered
by `html()` on every instance, styled by the package stylesheet, and
opened and closed by `ImageInput` and `ImageInputClient`. The component
was therefore a complete editing experience out of the box, and
`image-input:edit` / `image-input:alt` existed mainly as an opt-out:
cancel the event, pass `dialogs: false` to `html()`, and substitute
your own UI.

That arrangement had the package making decisions it is not positioned
to make. A dialog is the most design-system-bound surface in an
application: its heading level, its button order, its focus behavior on
close, its copy, its animation and its typography all belong to the
host. Nothing the package chose could be right for more than one
consumer, so the API grew a compensating surface -- twelve
`--image-input-dialog-*` custom properties, a page-wide `DialogText`
static (`ImageInput.TEXT`) that no per-instance or i18n-framework
translation could reach, and a set of internal class names
(`.alt-save`, `.crop-cancel`) that consumers were reaching for anyway.

It also produced two code paths for one feature. The built-in path was
the one exercised by the tests and described by the README; the opt-out
path -- the one every application with an existing modal system
actually takes -- was the less specified of the two, and had to be kept
working through markup that the package still emitted and styled.

Meanwhile the genuinely reusable part of the crop dialog is not the
dialog. It is `<image-crop>`: the rect, the constraint, the pointer and
keyboard interaction, and canvas encoding. That element already existed
as an export, but was documented mostly as an implementation detail of
the dialog that contained it.

## Decision

`image-input` emits events and owns state. It renders no dialogs.

* `src/dialogs.ts` is deleted, along with `DialogText`,
  `ImageInput.TEXT`, the `dialogs` option on `html()`, and the dialog
  rules and custom properties in the stylesheet.
* `html()` emits the picker, the preview and the overlay controls, and
  nothing else. `ImageInput` and `ImageInputClient` wire up the file
  input, drag and drop, the Edit button, the ALT badge and the Remove
  button.
* `image-input:edit` and `image-input:alt` become notifications rather
  than pre-events. There is no default behavior left for a consumer to
  cancel.
* The application performs the edit in its own UI and writes the result
  back through the existing public API: `setImage(blob)` for a crop,
  the `alt` attribute for alt text. Those two entry points are the
  whole write-back contract.
* `<image-crop>` is a first-class export, documented as an element the
  application places wherever it wants. The `crop` attribute lives
  there and only there; `<image-input>` no longer accepts it.
* The example application is the reference implementation of both
  dialogs, and the README carries copyable markup for them.

## Consequences

Easier:

* The package has no modal styling, no copy, and no i18n surface. The
  three hardest things to get right for an unknown host are no longer
  ours to get right.
* One code path per feature, and it is the path applications with an
  existing design system were already on.
* `<image-crop>` is usable on its own -- in a route, a side panel or an
  application's own dialog -- without an `<image-input>` above it.
* Smaller stylesheet and smaller markup for every consumer, including
  the ones who were already cancelling the dialogs.
* Accessible-name collisions get simpler. The remaining markup carries
  no `id`, but it also no longer has to describe two modal surfaces
  with `aria-label` to avoid them.

Harder:

* The component is no longer drop-in for editing. An application that
  writes no dialog gets a picker, a preview and two buttons that emit
  events into nothing. The Edit button and the ALT badge are still
  rendered, so the affordance is visible before the behavior exists.
* Dialog accessibility moves to the consumer: modal semantics, focus
  return, Esc handling and labelling are now theirs to get right. The
  README and the example have to carry a correct reference version, and
  a consumer who copies it badly produces an inaccessible dialog under
  our component's name.
* Under `crop="circle"` the round preview is no longer automatic, since
  `<image-input>` no longer knows the shape. Rounding the preview is
  the application's CSS.
* This is a breaking change for every existing consumer that did not
  already cancel the events, and one that no deprecation shim can
  soften: the dialogs either exist or they do not.
* Two elements to learn instead of one, and a crop flow whose steps are
  split across the package and the application.

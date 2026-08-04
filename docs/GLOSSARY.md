# Glossary

The vocabulary of `image-input`. A reference for what a word means in
this package's context, not a tutorial and not an API reference. Longer
concepts link to the [ADR](adr/INDEX.md) or [FDR](fdr/INDEX.md) that
owns them.

Four sections, ordered by who uses the word:

1. [UI](#ui) -- named visible surfaces, and the class names that
   identify them in the light DOM.
2. [Consumer API](#consumer-api) -- concepts an app embedding the
   package needs to know.
3. [Internals](#internals) -- jargon only contributors use.
4. [Project](#project) -- how work on the package is organised.

Within a section, terms are ordered conceptually rather than
alphabetically: foundational first, derivatives after.

## UI

Every surface below lives in the light DOM, so its class name is part
of what the consumer can see and style. Listed outside-in.

**Box** (`.box`) -- The bordered outer surface of `image-input`. It is
the file picker, the drop target and the preview container all at once.
The component never gives it a width, height or aspect ratio; see
*Author-sized*.

**Picker** (`.picker`) -- The `<label>` that wraps the native
`<input type="file">`. It wraps only the input, not the whole Box: a
`<label>` may not contain labelable descendants other than its own
control, and the Overlay's buttons are labelable. Once an image is set,
the Picker stretches to fill the Box so a click on the preview reopens
the file dialog.

**Prompt** (`.prompt`) -- The icon and text shown inside an empty Box.
The text comes from the `label` attribute, defaulting to
`ImageInput.DEFAULT_LABEL`, and doubles as the file input's
`aria-label`.

**Preview** (`.preview`) -- The `<img>` displaying the currently
selected image, plus the Overlay painted on top of it. Carries the
`has-image` class whenever a file is set.

**Overlay** (`.overlay`) -- The controls painted over the Preview: the
ALT Badge on one side, the Controls on the other.

**ALT Badge** (`.alt-badge`) -- The pill button in the Overlay that
emits `image-input:alt`. Carries `has-alt` when alt text is set, which
is what switches it from "Add alt text" to "Edit alt text". It is a
trigger only; the surface it leads to is the consumer's, see *Editing
handoff*.

**Controls** (`.controls`) -- The edit (`.edit`) and remove
(`.remove`) buttons in the Overlay. Edit emits `image-input:edit` and
is likewise only a trigger. Edit is the one surface here that can be
suppressed; see *`nocrop`*.

**Crop Frame** (`.image-crop-frame`) -- `image-crop`'s positioned
container, sized to the image's fitted display size. Everything else
in the crop UI is absolutely positioned inside it.

**Crop Rect** (`.crop-rect`) -- The selected region of the image. It is
focusable and exposed as `role="group"`, so arrow keys move it and
shift plus arrow keys resize it. Its geometry is reported in natural
pixels, not display pixels.

**Handle** (`.handle`, `.handle-nw` through `.handle-w`) -- The eight
corner and edge grips on the Crop Rect. Corner handles resize both
axes, edge handles resize one.

**Dim Panels** (`.dim-top`, `.dim-bottom`, `.dim-left`, `.dim-right`)
-- Four rectangles that darken everything outside the Crop Rect. Four
separate panels, not one overlay with a hole punched in it.

## Consumer API

**Consumer** -- The application embedding the package. Its build setup,
framework and stylesheet are all outside our control, which is the
premise behind
[ADR-001](adr/ADR-001-use-platform-primitives.md).

**Reflected attribute** -- An attribute that is also a property, so
`el.alt = 'a photo'` and `alt="a photo"` are the same operation.
`accept`, `name`, `alt`, `label` and `crop` are reflected strings;
`required` and `nocrop` are reflected booleans.

**`nocrop`** -- The boolean attribute on `image-input` that removes the
edit button from the Overlay. While it is set the button is hidden by
the package stylesheet and `image-input:edit` never fires, so a page
that offers no crop UI shows no dead affordance. It suppresses the
trigger and nothing else: the ALT Badge, remove, picking, dropping,
form participation and `setImage()` are all unaffected, so the image
can still be replaced programmatically. Unrelated to `crop`, which
names the shape a cropper enforces once one exists and lives on
`image-crop`. See
[FDR-003](fdr/FDR-003-editing-handoff.md) decisions 5 and 6.

**Namespaced event** -- Every event this package emits is prefixed with
its tag name and a colon: `image-input:change`, `:edit`, `:alt`,
`:alt-change`, `:remove`, `:error`, and `image-crop:change`. They all
bubble. `image-input:edit` and `image-input:alt` are notifications and
are not cancelable; the rest are. The colon is why frameworks that
build listener names from prop names (preact's `on*`) cannot subscribe
without `addEventListener`; see `example/AGENTS.md`.

**Editing handoff** -- The seam between the package and the consumer.
The component owns the file, the preview and the alt text, and renders
no editing UI at all: the ALT Badge and edit button emit
`image-input:alt` and `image-input:edit`, and the consumer's own
surface -- typically a `<dialog>` holding an `<image-crop>` -- does the
work and writes the result back through `setImage(blob)` or the `alt`
property. There are no callback props, render props or plugin registry.
See [FDR-003](fdr/FDR-003-editing-handoff.md) and
[ADR-002](adr/ADR-002-events-not-dialogs.md). Pending: `src/dialogs.ts`
and its `.alt-dialog` / `.crop-dialog` markup are still in the source
until that decision is implemented.

**Crop in flight** -- The guard a consumer's save handler needs across
the `await` on `getBlob()`, so that a second Save click or a dismissal
mid-crop cannot apply a crop twice or apply it to a surface the user
has already closed.

**Static markup path** -- The no-custom-element route: `html()` emits
the markup as a string for a server-rendered page, and
`ImageInputClient` attaches the behavior to markup already in the
document. `html()` is also what `ImageInput.render()` calls, so there
is exactly one template. The host element must be an `<image-input>`
tag, because the stylesheet is scoped to that element selector.

**Author-sized** -- The rule that the component sets no width, height,
min-height or aspect ratio on itself. Sizing is the consuming page's
job, and a page that does not size the Box gets a collapsed one.

**CSS custom property theming** -- The only theming API. Every value is
a `--image-input-*` or `--image-crop-*` property declared in
`src/_vars.css`. There is no JS theme object and no style props, so
adding a property is never a breaking change.

## Internals

**Light DOM** -- The component renders into itself with no shadow root,
so consumer CSS reaches its markup and form association is the
browser's default. The costs are no style encapsulation and a hard ban
on `id` attributes in our markup, since N elements on a page would emit
N duplicate ids. Anything needing an accessible name therefore carries
`aria-label` rather than `aria-labelledby`, and a `<label>` may only
wrap its own control.

**Hidden input** -- The `<input type="file">` is hidden with a
clip-path and absolute positioning, never `display:none`,
`visibility:hidden` or the `hidden` attribute. Those three make the
control unfocusable and stop the browser reporting `required` on it.
The clip also removes the input from hit-testing, which is intended:
only the Picker should be mouse-clickable.

**Input file sync** -- Writing a picked, dropped or cropped file back
into the native input's `.files` so a surrounding `<form>` submits it.
A `FileList` cannot be constructed, so the file goes through a
`DataTransfer`, which is not constructible in every environment and is
therefore wrapped in `try`/`catch`. Events carry the file regardless of
whether the sync succeeded.

**Preview URL** -- The object URL backing the `<img>`. There is exactly
one live at a time per element; it is revoked before a replacement is
created and on disconnect.

**Natural pixels** / **Display pixels** -- The two coordinate spaces in
the crop UI. Natural pixels are the image's own resolution and are what
the crop rect is stored in and what `image-crop:change` reports.
Display pixels are what is on screen after fitting the image into the
Crop Frame. **Scale** is the ratio between them; `crop-math.ts` holds
the pure conversions.

**Drag snapshot** -- The pointer-drag convention: capture the start
rect and start pointer position on `pointerdown`, then recompute the
new rect from that snapshot plus the *total* delta on every
`pointermove`. Accumulating per-event deltas onto the live rect drifts.

**DropRecord** -- `@substrate-system/drag-drop`'s
`Record<string, File>` drop payload. It includes files recursed out of
a dropped *directory*, which `dataTransfer.files` does not, so drop
handling scans the record rather than the raw file list.

## Project

**ADR (Architecture Decision Record)** -- A recorded architectural
decision with its context and consequences, in [docs/adr](adr/INDEX.md).

**PRD (Product Requirements Document)** -- The feature-level spec in
`tasks/`, written before implementation and broken into numbered user
stories.

**Task ID** -- The prefixed identifier a unit of work is tracked and
committed under: `US-` (the original PRD stories), `DT-` (drop
target), `CD-` (component-owned dialogs), `EP-` (preact example).
Commits name them directly, as in
`FEATURE: CD-003 - Saving alt text updates the element`.

**AGENTS.md** -- A per-directory file recording the traps and
non-obvious constraints of that directory's code, so they are not
rediscovered. `src/AGENTS.md` covers the component; `example/AGENTS.md`
covers the demo's preact contract.

**tapout** -- The test runner. Tests execute in a real browser
(Playwright-driven) rather than jsdom, because `DataTransfer`, canvas
encoding and pointer capture are all involved and none of them work in a
fake DOM. The bundle is piped in on stdin, and tapout serves its own
page, so the bundle installs the stylesheet itself -- see `test/style.ts`.

**`test/fixture.ts`** -- One real image, `test/cinnamon-roll.jpg`,
inlined as base64. Every image a test hands the component comes from
here. A `File` of arbitrary bytes does not decode, so each preview
`<img>` fails to load and the browser logs an error for it.

**Baseline** -- The browser support floor, inherited from the platform
features used rather than chosen through polyfills: custom elements,
Pointer Events with `setPointerCapture`, canvas `toBlob()`, and CSS
custom properties. Where a feature is unevenly supported, the gap is
recorded as a limitation rather than patched.

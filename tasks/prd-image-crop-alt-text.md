# PRD: Image Input with Crop and Alt Text (Bluesky-style)

> **Status: partly superseded.** This document records what was
> specified before implementation, and is kept for that history. Two
> of its premises no longer hold:
>
> 1. The "headless with regard to chrome" rule in the Introduction,
>    and the matching goal "Keep all UI chrome (modals, buttons
>    layout) in the consumer's hands", were reversed by CD-001
>    through CD-008. `image-input` now renders and opens its own alt
>    and crop dialogs. They stay optional: `image-input:edit` and
>    `image-input:alt` are cancelable, and `preventDefault()` on
>    either suppresses the built-in dialog so a consumer can
>    substitute their own UI.
> 2. US-003's "Alt text is a plain textarea owned by the consumer"
>    describes the old design. The component ships an alt-text
>    dialog.
>
> Current behavior lives in the README's "Built-in dialogs" section
> and in [ADR-001](../docs/adr/ADR-001-use-platform-primitives.md).

## Introduction

Extend the `image-input` web component package so it supports the full
feature set of Bluesky's image attachment flow: selecting an image,
seeing a preview, adding alt text, and cropping the image with a
freeform drag-handle crop UI.

The package stays **headless with regard to chrome**: it does not open
its own modal dialogs. Instead it ships composable custom elements and
events, and the consuming app decides where the editing UI appears
(inline, in a `<dialog>`, in a route, etc). This matches the
substrate-system HTML-first component philosophy.

The final output for the consumer is a **cropped image Blob plus an alt
text string**, ready to upload.

## Goals

- Select a single image file and show a preview thumbnail.
- Provide an alt text input associated with the selected image.
- Provide a from-scratch crop UI (no third-party cropper library):
  a resizable, draggable crop rectangle with corner and edge handles,
  rendered over the image, like Bluesky's "Edit image" view.
- Produce the cropped result as a Blob (via canvas) plus the alt text.
- Allow removing the image and starting over.
- Keep all UI chrome (modals, buttons layout) in the consumer's hands.
- Zero runtime dependencies beyond existing substrate-system packages.

## Component Architecture

Three cooperating custom elements, all exported from this package:

1. `image-input` (exists today) -- the file picker and preview. Emits
   the selected `File` and shows a thumbnail. Gains an "edit" affordance
   event and overlay controls (ALT badge, edit and remove buttons) so
   consumers can wire up their own editors, mirroring Bluesky's
   thumbnail overlay (Image #1).
2. `image-crop` (new) -- given an image source, renders the image with
   a crop rectangle overlay (dashed border, 8 drag handles, dimmed
   outside area, like Image #2). Exposes the crop state and can export
   the cropped region as a Blob.
3. Alt text is a plain `<textarea>`/`<input>` owned by the consumer;
   the package only defines how alt text flows through events and
   properties (no custom element needed for a text field).

## User Stories

### US-001: Preview with overlay controls
**Description:** As a user, I want to see my selected image as a
thumbnail with ALT, edit, and remove controls overlaid, so I can manage
the attachment like on Bluesky.

**Acceptance Criteria:**
- [ ] After file selection, `image-input` shows the image preview
- [ ] Overlay shows three controls: an "+ ALT" badge button, an edit
      (pencil) button, and a remove (x) button
- [ ] The ALT badge reads "ALT" (instead of "+ ALT") once alt text has
      been set via the `alt` property
- [ ] Clicking remove clears the file, preview, and alt text, and
      returns the component to its empty state
- [ ] Remove emits an `image-input:remove` event
- [ ] All overlay buttons are keyboard focusable with accessible names
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Edit and alt-text request events
**Description:** As a consuming developer, I want events when the user
clicks the edit or ALT buttons, so I can open my own editing UI.

**Acceptance Criteria:**
- [ ] Clicking the pencil button emits `image-input:edit` with
      `{ file }` in `detail`
- [ ] Clicking the ALT badge emits `image-input:alt` with
      `{ file, alt }` in `detail` (current alt text, may be empty)
- [ ] The component performs no navigation and opens no dialogs itself
- [ ] Events bubble so consumers can listen on ancestors
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Alt text property
**Description:** As a consuming developer, I want to set and read alt
text on the component, so my own alt text input stays in sync.

**Acceptance Criteria:**
- [ ] `image-input` has an `alt` string property (and reflected
      attribute) that consumers can set after collecting alt text
- [ ] Setting `alt` updates the preview `<img>` element's `alt`
      attribute and switches the badge from "+ ALT" to "ALT"
- [ ] `image-input:change` event detail includes the current alt text:
      `{ file, alt }`
- [ ] Typecheck/lint passes

### US-004: Crop component renders crop rectangle
**Description:** As a user, I want to see my image with an adjustable
crop rectangle, so I can choose which part of the image to keep.

**Acceptance Criteria:**
- [ ] New `image-crop` element accepts an image via a `src` attribute
      (object URL or data URL) or a `setFile(file)` method
- [ ] Image renders at a size that fits the element while preserving
      aspect ratio
- [ ] A crop rectangle renders over the image with a dashed border and
      8 handles (4 corners, 4 edge midpoints), initial crop covers the
      full image
- [ ] The area outside the crop rectangle is dimmed
- [ ] Component ships CSS in `src/index.css` using variables from a
      `_vars.css` file
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Drag to move and resize the crop
**Description:** As a user, I want to drag the rectangle to move it and
drag its handles to resize it, so I can crop freely like on Bluesky.

**Acceptance Criteria:**
- [ ] Dragging inside the rectangle moves it; the rectangle cannot
      leave the image bounds
- [ ] Dragging a corner handle resizes in both axes; dragging an edge
      handle resizes in one axis
- [ ] Crop has a sensible minimum size (e.g. 32x32 display pixels)
- [ ] Works with mouse and touch (pointer events)
- [ ] Crop state changes emit `image-crop:change` with the crop rect in
      natural-image pixel coordinates: `{ x, y, width, height }`
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Keyboard-accessible crop
**Description:** As a keyboard user, I want to adjust the crop without
a pointer, so the component is accessible.

**Acceptance Criteria:**
- [ ] The crop rectangle is focusable; arrow keys move it, and
      shift+arrow keys resize it
- [ ] Focus styles are visible
- [ ] The rectangle has an appropriate ARIA role and label
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-007: Export cropped Blob
**Description:** As a consuming developer, I want to get the cropped
image as a Blob, so I can upload it.

**Acceptance Criteria:**
- [ ] `image-crop` exposes `getBlob(opts?)` returning
      `Promise<Blob>` of the crop region, rendered via canvas at the
      image's natural resolution
- [ ] `opts` supports `type` (default `image/jpeg`) and `quality`
- [ ] `image-crop` also exposes a `crop` getter returning the current
      rect in natural-image pixels
- [ ] `image-input` exposes a way to accept the cropped result back:
      `setImage(blob)` replaces the preview and the file that will be
      emitted in subsequent `change` events
- [ ] Typecheck/lint passes

### US-008: Example page wiring it all together
**Description:** As a developer evaluating the package, I want the
example app to demonstrate the full Bluesky-style flow, so I can see
how to compose the pieces.

**Acceptance Criteria:**
- [ ] `example/index.ts` composes `image-input`, `image-crop`, and an
      alt text `<textarea>` using a native `<dialog>` owned by the
      example app (demonstrating the headless pattern)
- [ ] Flow works end to end: pick image, open crop dialog via edit
      button, adjust crop, save, see cropped preview; open alt dialog
      via ALT badge, enter text, see badge change to "ALT"
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-009: Tests
**Description:** As a maintainer, I want automated tests for the new
behavior, so regressions are caught in CI.

**Acceptance Criteria:**
- [ ] Tape tests cover: change event payload shape, alt property
      reflection, remove behavior, crop rect math (display-to-natural
      coordinate mapping), and `getBlob` producing a Blob of the
      expected dimensions
- [ ] No tests assert on specific visible text content
- [ ] `npm test` passes

## Functional Requirements

- FR-1: `image-input` must show a thumbnail preview with overlay
  controls (ALT badge, edit button, remove button) once a file is
  selected.
- FR-2: `image-input` must emit bubbling namespaced events:
  `image-input:change` `{ file, alt }`, `image-input:edit` `{ file }`,
  `image-input:alt` `{ file, alt }`, `image-input:remove`.
- FR-3: `image-input` must expose an `alt` string property/attribute
  and a `setImage(blob)` method for accepting a cropped replacement.
- FR-4: `image-input` must not open any dialog or overlay UI beyond
  the thumbnail controls; editing surfaces belong to the consumer.
- FR-5: `image-crop` must render an image plus a movable, resizable
  crop rectangle with 8 handles, constrained to the image bounds, with
  the outside area dimmed.
- FR-6: `image-crop` must support pointer (mouse and touch) and
  keyboard interaction.
- FR-7: `image-crop` must report crop state in natural-image pixel
  coordinates via a `crop` getter and `image-crop:change` events.
- FR-8: `image-crop` must implement `getBlob({ type?, quality? })`
  using an offscreen canvas, cropping from the original image at
  natural resolution (no quality loss from display scaling).
- FR-9: All new code must be TypeScript, follow the existing
  no-shadow-DOM light-DOM pattern, and add no runtime dependencies.
- FR-10: Styles live in `src/index.css`, use CSS variables from a
  variables file, and use nested selectors.

## Non-Goals (Out of Scope)

- No multiple-image support (Bluesky's 4-image grid). Single image
  only; multi-image can layer on later by composing several instances.
- No built-in modal dialogs, save/cancel buttons, or dialog chrome --
  the consumer owns those (the example app demonstrates them).
- No aspect-ratio presets or locked ratios (freeform crop only).
- No rotation, flipping, filters, or zoom.
- No image upload or network behavior.
- No alt text validation or AI alt text generation.
- No drag-and-drop file selection (can be a follow-up).

## Design Considerations

- Visual reference: Bluesky compose flow. Thumbnail overlay (Image #1):
  "+ ALT" badge top-left, pencil and x buttons top-right, on rounded
  dark pills. Crop view (Image #2): dashed crop border with small
  square handles, dimmed surround.
- Follow the CSS rules from the global instructions: variables for all
  colors, nothing under 1rem font size, nested selectors.
- Overlay buttons need sufficient contrast against arbitrary image
  content (semi-opaque dark pill background, like Bluesky).

## Technical Considerations

- Keep the existing `WebComponent` base class and light-DOM `render()`
  pattern; `image-crop` follows the same pattern in a new module
  (`src/crop.ts`) exported from the package root and as a subpath.
- Coordinate mapping: crop interaction happens in display pixels but
  state and `getBlob` operate in natural-image pixels. Centralize the
  mapping in pure functions so it is unit-testable without a browser
  layout.
- Use pointer events with `setPointerCapture` for drag handling.
- Use `URL.createObjectURL` for previews instead of FileReader data
  URLs (revoke on remove/replace to avoid leaks).
- EXIF orientation: rely on the browser's native handling
  (`img` decode honors orientation in all modern browsers).
- Build scripts already compile `src/*.ts`, so `src/crop.ts` is picked
  up without build changes; add a `./crop` note to `exports` docs if
  needed (the wildcard export already covers `dist/crop.js`).

## Success Metrics

- The example app reproduces the Bluesky flow end to end with no
  third-party UI libraries.
- A consumer can integrate select + crop + alt text with fewer than
  ~50 lines of wiring code (as demonstrated in the example).
- `npm test` passes in CI, including crop coordinate math tests.

## Open Questions

- Should `image-crop` remember the previous crop when reopened for the
  same image (Bluesky resets to full frame)? Default: reset to full
  frame; revisit if needed.
- Default export format for `getBlob`: keep the original file's MIME
  type when possible, or always JPEG? Current plan: default JPEG,
  overridable via `opts.type`.
- Should the ALT badge be hidden entirely via an attribute for
  consumers who do not collect alt text (e.g. `no-alt`)?

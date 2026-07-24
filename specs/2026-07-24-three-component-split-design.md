# Three component split: image-input, image-preview, image-edit

Date: 2026-07-24

## Summary

Split the current all-in-one `image-input` element into three light-DOM
web components with separate responsibilities:

- `image-input` -- a file input, nothing else. Hands the selected file
  to a preview element named by a `for` attribute.
- `image-preview` -- a pure renderer. Given an `img` URL it renders an
  `<img>`; given nothing it renders nothing.
- `image-edit` -- extends `image-preview`. Renders the image through an
  embedded `<image-crop>` and adds the remove button and ALT badge.

`image-crop` is unchanged.

All components use light DOM only. No shadow DOM anywhere.

## Motivation

Today a single `image-input` element owns the file input, the preview
image, the alt-text badge, and the edit/remove overlay. That bundles
four concerns into one tag, and it forces consumers who only want a
preview (for example, a drop target) to instantiate a file input they
do not want.

Splitting the element lets a page place the picker and the preview
independently, and lets a preview exist with no picker at all.

## Components

### image-input

File: `src/index.ts`. Tag: `image-input`.

Renders exactly one element:

```html
<input type="file" accept="image/*" />
```

Attributes:

| Attribute  | Type    | Notes                                          |
| ---------- | ------- | ---------------------------------------------- |
| `for`      | string  | Required. ID of an `image-preview`/`image-edit` |
| `accept`   | string  | Reflected to the input. Default `image/*`      |
| `name`     | string  | Reflected to the input                         |
| `required` | boolean | Reflected to the input                         |

On the input's `change` event, when a file is present and its type
starts with `image/`:

1. Look up `document.getElementById(this.for)`.
2. If the result is an `ImagePreview` instance, call
   `target.setFile(file)`.
3. Emit `image-input:change` with `{ file }`.

If `for` is absent, or the target does not exist, or the target is not
an `ImagePreview`, log through `createDebug` and skip step 2. Step 3
still runs. Nothing throws -- a missing target is a wiring mistake in
the page, not a reason to break the page.

### image-preview

File: `src/preview.ts`. Tag: `image-preview`.

Attributes:

| Attribute | Type   | Notes                                        |
| --------- | ------ | -------------------------------------------- |
| `img`     | string | Any URL, typically a blob URL                |
| `alt`     | string | Passed straight through to the `<img>`'s alt |

Rendering:

- No `img` attribute -> the element's contents are empty. No `<img>`,
  no wrapper, no placeholder text.
- With `img` -> a single `<img src="..." alt="...">`.

There are no buttons and no overlay on `image-preview`.

The `alt` attribute has no associated UI. It exists because an `<img>`
with no alt text is an accessibility defect and consumers need a way to
set it. The alt-editing *controls* live on `image-edit`.

Public API:

- `setFile(file:File|Blob):void` -- revoke any owned URL, create an
  object URL for `file`, set the `img` attribute, record that this
  component owns the new URL, emit `image-preview:change`.
- `clear():void` -- revoke any owned URL, remove the `img` attribute,
  emit `image-preview:remove`.
- `get file():File|Blob|null` -- the file most recently passed to
  `setFile`, or `null`.

Events (bubbling, cancelable `CustomEvent`s, matching the existing
`WebComponent.emit` convention):

- `image-preview:change` -- `{ file, src }`
- `image-preview:remove` -- no detail

Blob URL ownership: the component revokes only URLs it created itself
inside `setFile`. A URL supplied by the consumer through the `img`
attribute belongs to the consumer and is never revoked by the
component. Freeing a URL the component did not create would invalidate
a handle the consumer may still be using.

`disconnectedCallback` revokes any owned URL.

Changing the `img` attribute re-renders. Setting `img` externally while
the component owns a previous URL revokes the owned URL first.

### image-edit

File: `src/edit.ts`. Tag: `image-edit`. `class ImageEdit extends
ImagePreview`.

Inherits `img`, `alt`, `setFile`, `clear`, and the `file` getter.

Rendering differs from the parent: with an image present it renders an
`<image-crop>` bound to the same source rather than a bare `<img>`,
plus an overlay containing:

- an ALT badge button
- a remove button

With no image it renders nothing, same as the parent.

The crop UI is always live whenever there is an image. There is no
separate "preview mode" and "crop mode" -- an `image-edit` with an
image is always croppable.

Additional public API:

- `getBlob():Promise<Blob>` -- delegates to the embedded `image-crop`.
  Rejects when there is no image.

Additional events:

- `image-edit:alt` -- `{ alt }`, emitted when the ALT badge is clicked
- `image-edit:alt-change` -- `{ alt }`, emitted when the `alt`
  attribute changes

Event namespacing note: `emit` on the `WebComponent` base class
namespaces by the element's own tag. So the inherited `setFile` and
`clear` emit `image-edit:change` and `image-edit:remove` on an
`image-edit`, not `image-preview:*`. The remove button calls `clear()`
and emits nothing itself, so there is exactly one remove event per
click.

Opening a dialog in response to `image-edit:alt` is the consumer's job.
The component stays headless with respect to dialogs, matching the
existing convention documented in `example/AGENTS.md`.

### image-crop

Unchanged. Stays in `src/crop.ts` with `src/crop-math.ts`, and remains
separately importable.

## Example page

Markup:

```html
<image-input for="preview"></image-input>
<image-preview id="preview"></image-preview>
```

The `image-preview` doubles as the drop zone. It carries the styling
the current `#drop-zone` has: a set width, a min-height, a dashed
border, and a `.drag` class while a file is dragged over it. When it
holds no image it displays nothing inside the border.

The example wires drag and drop itself with
`@substrate-system/drag-drop`, calling `preview.setFile(file)` on drop.
`image-preview` has no drag-and-drop code -- drop handling is a
consumer concern.

A `<dialog>` holds an `<image-edit>` for cropping. The dialog opens
from the two places a new file arrives from the user:

1. the `image-input:change` event, and
2. the drop callback.

It does not open from `image-preview:change`. That distinction removes
the feedback loop the current example works around with a
`suppressCrop` ref: saving a crop calls `getBlob()` and then
`preview.setFile(blob)`, which emits a preview change event that
nothing listens for. The `suppressCrop` ref is deleted.

Alt text: the example listens for `image-edit:alt` to open its alt
dialog, and for `image-edit:alt-change` to update the displayed alt
text.

## File changes

| File              | Change                                            |
| ----------------- | ------------------------------------------------- |
| `src/index.ts`    | `ImageInput` only, plus a re-export of `ImagePreview` |
| `src/preview.ts`  | New. `ImagePreview`                               |
| `src/edit.ts`     | New. `ImageEdit extends ImagePreview`             |
| `src/html.ts`     | Delete                                            |
| `src/client.ts`   | Delete                                            |
| `src/index.css`   | Restructure into input / preview / edit blocks    |
| `src/_vars.css`   | Unchanged                                         |
| `src/crop.ts`     | Unchanged                                         |
| `src/crop-math.ts`| Unchanged                                         |
| `test/index.ts`   | Rewrite for the three components                  |
| `test/crop.ts`    | Unchanged                                         |
| `test/crop-math.ts`| Unchanged                                        |
| `example/*`       | Rewrite per the section above                     |
| `README.md`       | Rewrite for the new API                           |

`image-edit` is reached through the `/edit` subpath rather than being
re-exported from `src/index.ts`, so importing the plain input does not
pull in `crop.ts`. The package's existing `./*` export map entry
already supports this.

`src/html.ts` and `src/client.ts` are deleted. That markup/behavior
split is worth its indirection for a large component; `image-input` is
now a single `<input>` and `image-preview` is a single `<img>`. Each
component renders inline in its own class.

## CSS

`src/index.css` is restructured into three nested blocks, one per
component, using nested selectors rather than a proliferation of class
names. All colors and radii continue to come from `src/_vars.css`.

`example/index.css` keeps the dialog, menu, and page-layout styles. The
`#drop-zone` rules move onto the `image-preview` element itself.

## Testing

`test/index.ts` is rewritten. Coverage:

- `image-input` renders a file input and reflects `accept`, `name`,
  `required`.
- `image-input` with a valid `for` calls `setFile` on the target.
- `image-input` with a missing or invalid `for` does not throw, and
  still emits `image-input:change`.
- `image-preview` with no `img` attribute renders nothing.
- `image-preview` with an `img` attribute renders an `<img>` with that
  src.
- `image-preview.setFile()` sets `img`, emits `image-preview:change`
  with a `file` in the detail.
- `image-preview.clear()` removes `img` and emits
  `image-preview:remove`.
- `image-preview` does not revoke a URL it was handed through the `img`
  attribute.
- `image-edit` renders an `image-crop`, a remove button, and an ALT
  badge when it has an image, and nothing when it does not.
- `image-edit` remove button emits `image-edit:remove` and clears.
- `image-edit` ALT badge emits `image-edit:alt`.

Tests assert on structure, elements, and event payload shape. They do
not assert on specific text content.

`test/crop.ts` and `test/crop-math.ts` are left alone.

## Out of scope

- Multiple file selection.
- Drag and drop inside the package.
- Any change to `image-crop`'s cropping behavior or math.
- Form-associated custom element behavior (`ElementInternals`).

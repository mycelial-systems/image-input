# Task: Render `<image-input>` as a drop target

Branch: `rewrite`
Repo: `/Users/nick/code/image-input`

## Definition of Done

1. `<image-input>` renders as a bordered box. The box is the drop
   target and the file picker trigger. The native file input's default
   visual ("Choose File / No file chosen") is gone, but the input still
   exists, is focusable, and still carries `accept`, `name` and
   `required`.
2. Dropping an image onto the box selects it: the preview renders
   inside the box, `input.files` is populated so a surrounding
   `<form>` submits the dropped file, and `image-input:change` fires
   with the same payload as a picked file.
3. Dragging over the box changes its border. Dropping a file with no
   `image/*` member emits a new `image-input:error` event.
4. `src/index.css` and `src/_vars.css` carry the new box, drag and
   focus styles, all colors and sizes as variables.
5. `test/index.ts` covers the drop path, the `input.files` sync, the
   drag class, and the error event. `npm test` passes.
6. `README.md`, `example/index.ts` and `src/AGENTS.md` are updated.

## Context

`src/index.ts` currently renders a bare `<input type="file">` followed
by a `.preview` block (an `<img>` plus an `.overlay` holding the ALT
badge, edit and remove buttons). The preview is hidden until a file is
chosen, via a `has-image` class.

`@substrate-system/drag-drop@0.4.12` is already a dependency in
`package.json` but is not imported anywhere yet.

### Verified facts about `@substrate-system/drag-drop`

Read from `node_modules`, not from its README, because its README is
incomplete on two of these points:

- `dragDrop(elem, listeners, opts)` returns a cleanup function that
  removes all four listeners (`dragenter`, `dragover`, `dragleave`,
  `drop`). Call it in `disconnectedCallback`.
- It adds the class `drag` to the element you pass on `dragenter`, and
  removes it on `dragleave` and on `drop`. So the drag-over border is
  pure CSS. Do not write your own `dragenter`/`dragleave` handlers.
- `onDrop(record, { pos, files })`. `record` is
  `Record<string, File>` -- every value is a real `File`, including
  files recursed out of a dropped *directory*. Scan `record`, not
  `files`, so folder drops work.
- `onDrop` is `async` (it awaits `handleItems`). Tests must await a
  tick after dispatching a `drop` event.
- If `dataTransfer.items` yields no entries but `dataTransfer.files`
  is non-empty, it falls back to building the record from `files`.
  This fallback is what makes synthetic `DragEvent`s work in tests.

## Resolved decisions

These were settled with the user. Do not relitigate them.

1. **The box stays visible once an image loads.** The preview renders
   *inside* the box, keeping the existing ALT/edit/remove overlay. The
   box remains a drop target, so dropping again replaces the image.
   Nothing is removed from the public API.
2. **The picker is a `<label>` wrapping a visually hidden input**, not
   `display: none` plus a JS `click()` forward. Click and keyboard
   both work with no JS, and `required` validation can still focus and
   report on the control.
3. **The box itself is a `<div>`, not the `<label>`.** `<button>` is a
   labelable element, and a `<label>` may not contain labelable
   descendants other than its own control. Wrapping the whole box in a
   label would be invalid HTML and would give the input a garbled
   accessible name. The label is instead a sibling layer inside the
   box. See "Layering" below.
4. **Clicking the box while an image is showing reopens the picker**
   and replaces the image. Symmetric with drop-to-replace.
5. **Drop takes the first `image/*` file** in the record and ignores
   the rest. If there is none, emit `image-input:error`. The `accept`
   attribute is *not* enforced on drop, only by the picker.
6. **A dropped file is written into `input.files`** via `DataTransfer`
   so form submission and `required` behave identically for drop and
   pick.
7. **The box ships default content** (an icon and a line of prompt
   text) that the consumer can override.
8. **The component sets no intrinsic box size.** The consumer gives
   the box dimensions in their own CSS. The empty box is only as tall
   as its icon and prompt text.

### Consequence of decision 7: an attribute, not a slot

This component has no shadow DOM and `render()` overwrites
`innerHTML`, so `<slot>` does not work and light-DOM children would be
destroyed on render. Override the prompt with a new reflected string
attribute `label` instead. Capturing and restoring light-DOM children
was considered and rejected as too much machinery for "keep it
simple".

## Markup

`render()` produces this. `.wrapper` is gone; `.box` takes over its
`position: relative` role.

```html
<div class="box">
    <label class="picker">
        <input
            type="file"
            accept="image/*"
            aria-label="<the label attribute>"
        />
        <span class="prompt">
            <svg class="prompt-icon" aria-hidden="true">...</svg>
            <span class="prompt-text">Drop an image, or click to
                choose one</span>
        </span>
    </label>
    <div class="preview">
        <img alt="" />
        <div class="overlay">
            <button class="alt-badge">...</button>
            <div class="controls">
                <button class="edit">...</button>
                <button class="remove">...</button>
            </div>
        </div>
    </div>
</div>
```

The `.preview`, `.overlay`, `.alt-badge`, `.edit` and `.remove`
subtrees are unchanged from today. Existing tests select on them and
on `.preview.has-image`, so keep those class names exactly.

### Layering

The empty box is sized by the in-flow label. Once there is an image,
the label goes absolute and floats over the image as an invisible
click surface, and the image sizes the box.

- `.picker` is in normal flow by default, so the icon and text give
  the empty box its height.
- `.box.has-image .picker` becomes `position: absolute; inset: 0`, and
  `.box.has-image .prompt` is `display: none`.
- `.preview` gets `pointer-events: none` so a click on the image falls
  through to the label underneath. `.overlay > *` already sets
  `pointer-events: auto`, which re-enables the three buttons. The
  buttons come after the label in the DOM, so they paint on top with
  no `z-index` needed.

### Accessible name

`.prompt` is `display: none` once an image loads, which removes it
from the accessible name computation and would leave the input
unnamed. That is why the input also carries an explicit `aria-label`
mirroring the `label` attribute. Keep both in sync in
`handleChange_label`.

## Tasks

### 1. New `label` attribute

File: `src/index.ts`

Add `'label'` to `static reflectedStringAttributes` and
`declare label:string|null`. Default text when unset:
`Drop an image, or click to choose one`.

`handleChange_label(_old, newValue)` updates both the
`.prompt-text` textContent and the input's `aria-label`.

### 2. Rewrite `render()`

File: `src/index.ts`

Produce the markup above. Keep the existing `accept`, `name` and
`required` interpolation on the input, and keep the existing
`handleChange_accept`, `handleChange_name`, `handleChange_required`
and `handleChange_alt` methods working -- they all select via
`this.qs('input')` / `this.qs('img')` / `this.qs('.alt-badge')`, which
still resolve.

### 3. Wire up drag and drop

File: `src/index.ts`

```ts
import { dragDrop, type DropRecord } from '@substrate-system/drag-drop'
```

In `setupEventListeners`, attach to the box and store the cleanup
function on a private field:

```ts
const box = this.qs<HTMLElement>('.box')
if (box) this.#cleanupDrop = dragDrop(box, this.handleDrop)
```

In `disconnectedCallback`, call `this.#cleanupDrop?.()` alongside the
existing listener removal.

```ts
handleDrop = (record:DropRecord) => {
    const file = Object.values(record)
        .find(f => f.type.startsWith('image/'))

    if (!file) {
        this.emit('error', { detail: { reason: 'not-an-image' } })
        return
    }

    this.#syncInputFiles(file)
    this.#setFile(file)
    this.emit('change', { detail: { file, alt: this.alt ?? '' } })
}
```

`#setFile` should also add `has-image` to `.box` (it already adds it
to `.preview`; keep that, tests depend on it).

### 4. Sync dropped files into the input

File: `src/index.ts`

```ts
#syncInputFiles (file:File):void {
    const input = this.qs<HTMLInputElement>('input')
    if (!input) return

    try {
        const dt = new DataTransfer()
        dt.items.add(file)
        input.files = dt.files
    } catch (_err) {
        // DataTransfer is not constructible everywhere; the change
        // event still carries the file.
    }
}
```

`#clear()` already sets `input.value = ''`, which also clears
`input.files`. No change needed there.

### 5. Emit `image-input:error` from the picker path too

File: `src/index.ts`

`handleFileSelect` currently drops non-image files on the floor.
Emit the same `image-input:error` with `{ reason: 'not-an-image' }`
so both input paths behave the same. A user can always defeat
`accept` by choosing "All Files" in the picker, so this is reachable.

### 6. CSS

Files: `src/index.css`, `src/_vars.css`

New variables in `_vars.css`. Reuse `--image-input-radius` and
`--image-input-focus-color`; do not invent new colors where an
existing one fits.

```
--image-input-border-width
--image-input-border-style          /* dashed */
--image-input-border-color
--image-input-border-color-drag
--image-input-border-style-drag     /* solid */
--image-input-box-bg
--image-input-box-bg-drag
--image-input-box-padding
--image-input-prompt-color
--image-input-prompt-icon-size
--image-input-prompt-gap
```

In `index.css`, under the existing `image-input` block, using nested
selectors:

- `.box`: `position: relative`, the border from the variables,
  `border-radius: var(--image-input-radius)`, background. No `width`,
  `height`, `min-height` or `aspect-ratio` -- the author sizes it.
- `.box.drag`: swap border color and style, swap background.
- `.box:has(input:focus-visible)`: the same outline treatment the
  existing buttons use, so keyboard focus is visible on the box even
  though the input itself is clipped.
- `.picker`: flex, centered, `padding: var(--image-input-box-padding)`,
  `cursor: pointer`.
- `.box.has-image .picker`: `position: absolute; inset: 0; padding: 0`.
- `.box.has-image .prompt`: `display: none`.
- `.prompt`: flex column, centered, gap, `color` from the variable.
  Font size must not go below `1rem` (house rule).
- `.preview`: add `pointer-events: none` to the existing rules.
- The input, clipped but focusable:

  ```css
  & input[type="file"] {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
  }
  ```

  Do NOT use `display: none`, `visibility: hidden` or the `hidden`
  attribute. All three make the control unfocusable, which breaks
  keyboard access and stops the browser reporting `required`.

Leave the `image-crop` and `#alt-dialog` blocks alone.

### 7. Tests

File: `test/index.ts`

Add tests covering the new behavior. Follow the existing tapzero style
in that file.

1. Dropping an image file shows the preview and emits
   `image-input:change` with a `{ file, alt }` detail.
2. Dropping an image populates `input.files` with one file.
3. Dropping a file with no `image/*` member emits `image-input:error`
   with `{ reason: 'not-an-image' }`, and the preview stays hidden.
4. A drop containing several files uses the first `image/*` one.
5. `dragenter` on the box adds the `drag` class; `dragleave` removes
   it.
6. The file input still exists, is inside the `label`, and is not
   `display: none`.
7. Setting the `label` attribute updates the input's `aria-label`.

To dispatch a drop, build a real `DataTransfer`, add `File`s to it,
and dispatch `new DragEvent('drop', { dataTransfer: dt, bubbles:
true })` at the box. Remember `onDrop` is async -- await a tick before
asserting.

Do not assert on rendered text content (house rule). Assert on
attributes, classes, events and payload shapes.

### 8. README

File: `README.md`

- Describe the drop-target behavior and that click and drop are
  equivalent.
- Document the new `label` attribute in the attributes list.
- Document `image-input:error` in the events list.
- Document the new CSS variables and the fact that the consumer must
  size the box.

### 9. Example page

Files: `example/index.ts`, `example/index.css`

Give the box a size in `example/index.css` so the demo shows a real
drop target, and leave the existing crop and alt dialog wiring alone.

### 10. `src/AGENTS.md`

File: `src/AGENTS.md`

Append notes on:

- Why the box is a `div` and the `label` is an inner layer
  (`<button>` is labelable content; a `<label>` may not contain it).
- Why the input is clipped rather than `display: none` (focus and
  `required` reporting).
- The `DataTransfer` trick for writing dropped files into
  `input.files`.
- The `drag-drop` facts listed at the top of this document, especially
  that `onDrop` is async and that `record` covers directory contents
  while `files` does not.

## Constraints (house style)

- TypeScript, no space between colon and type (`(file:File)`), max 80
  columns.
- Nested CSS selectors over new class names. All colors and sizes as
  variables in `_vars.css`. Reuse existing variables first. No font
  size below `1rem`.
- Do not change CSS unrelated to this task.
- No emojis. No em dashes; use `--`. No arrow glyphs; use `->`.
- Always pass an explicit generic to `this.qs<T>(...)` when calling
  type-specific methods on the result, or `tsc --emitDeclarationOnly`
  fails during `npm run build`.

### 11. Normalize every input path to a `File`

File: `src/index.ts`

Today `setImage(blob)` cannot sync into `input.files`, so a form
submitted after a crop sends the *original* image rather than the
cropped one. A `Blob` can be promoted to a `File`, so fix it here
rather than shipping the gap.

Give `#setFile` the job of normalizing, so picking, dropping and
cropping all converge on one `File` and one `#syncInputFiles` call:

```ts
#setFile (file:File|Blob, name?:string):void {
    const asFile = (file instanceof File && !name) ?
        file :
        new File([file], name ?? this.#deriveName(file.type), {
            type: file.type
        })

    this.#syncInputFiles(asFile)
    // ...existing revoke / assign / preview logic, using asFile
}
```

`#deriveName(type)` builds a filename from the previously selected
file's base name plus an extension taken from the MIME type, because
cropping a `photo.png` yields `image/jpeg` by default and reusing the
old name would ship a JPEG called `.png`:

```ts
const EXT:Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif'
}
```

Fall back to `image` as the base name when nothing has been picked
yet, and to `jpg` for an unrecognized type.

Widen `setImage` to `setImage(blob:Blob, name?:string)` so a consumer
who knows the right filename can pass it. The parameter is optional;
existing calls keep working.

Consequences to carry through the rest of the work:

- `#file` is now always a `File`. The `detail.file` on
  `image-input:change`, `:edit` and `:alt` is a `File` rather than a
  `File|Blob`. This is backward compatible, since `File` extends
  `Blob`, but the README says `File|Blob` in four places and must be
  updated.
- Task 3's drop handler no longer calls `#syncInputFiles` itself;
  `#setFile` does it.
- The existing test "setImage replaces the preview with the given
  blob" still passes, but add assertions that `input.files` has one
  entry afterward and that its name carries an extension matching the
  blob type.

## Known gaps, deliberately out of scope

- `accept` is not enforced on drop, by decision 5. A component with
  `accept="image/jpeg"` will still accept a dropped PNG.

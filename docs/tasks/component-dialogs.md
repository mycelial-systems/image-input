# Design: `image-input` owns its alt and crop dialogs

Date: 2026-07-25
Branch: `rewrite`
Repo: `/Users/nick/code/image-input`

## Problem

The alt-text and crop modals live in `example/index.ts` as hand-written
native `<dialog>` elements. Every consumer of `image-input` has to
rebuild that wiring: listen for `image-input:edit`, open a dialog,
call `crop.getBlob()`, call `input.setImage(blob)`, close the dialog,
and the same again for alt text. The component should ship those two
dialogs itself, and they should fade in when they open.

## Scope

This spec covers only the component taking ownership of the two
dialogs. Two adjacent pieces of work are explicitly out of scope and
get their own specs:

1. Rewriting `example/` on preact, `@preact/signals` and `htm`. That
   work starts from the smaller `example/index.ts` this spec leaves
   behind.
2. Anything involving `microtags`. It is a runtime dependency in
   `package.json` but is not used by this work. The components stay on
   `@substrate-system/web-component`.

## Architecture

### New file: `src/dialogs.ts`

`src/index.ts` is 282 lines. Inlining two dialogs (markup, open/close,
button wiring, focus) pushes it past 400. The markup builders and the
open/close helpers move to a new `src/dialogs.ts`; `src/index.ts`
keeps the event wiring.

`build-esm` runs `esbuild src/*.ts --outdir=./dist` without bundling,
so a new source file becomes a new dist entry point on its own. The
`exports` map already has a `./*` catch-all. No build changes are
needed.

### Crop coupling

`src/index.ts` gains `import './crop.js'`, so importing the component
defines both `image-input` and `image-crop`. This puts `crop.ts` and
`crop-math.ts` into every bundle, including consumers who never crop.
That cost is accepted in exchange for a single import that works.

## Public API

### `static TEXT`

`ImageInput` gains:

```ts
static TEXT = {
    altHeading: 'Alt text',
    altLabel: 'Describe this image',
    cropHeading: 'Crop image',
    save: 'Save',
    cancel: 'Cancel'
}
```

Read at render time, so reassigning `ImageInput.TEXT` before the first
element upgrades swaps the copy for the whole page. The copy is
page-wide, not per element. The alt *value* remains per element: it is
the existing reflected `alt` attribute, and each element's dialog reads
and writes its own.

### Events

`image-input:edit` and `image-input:alt` keep firing with their current
payloads, before the built-in dialog opens. `WebComponent.emit()`
defaults to `{ bubbles: true, cancelable: true }` and returns `false`
when a listener calls `preventDefault()`, so the opt-out is:

```ts
handleEdit = (event:Event) => {
    event.preventDefault()
    if (!this.#file) return
    if (!this.emit('edit', { detail: { file: this.#file } })) return
    // open the built-in crop dialog
}
```

A consumer who cancels the event gets exactly today's behaviour.
`setImage()` and the `alt` property stay public, so the
bring-your-own-dialog path remains complete.

No new events are added:

- Crop save calls `this.setImage(blob)`, which already emits
  `image-input:change`.
- Alt save assigns `this.alt`, which already emits
  `image-input:alt-change`.
- Cancel and Esc close the dialog silently.

## Markup

Both dialogs render as siblings of `.box`, inside `image-input`.

```html
<dialog class="alt-dialog" aria-label="Alt text">
    <h2>Alt text</h2>
    <label>
        Describe this image
        <textarea rows="4"></textarea>
    </label>
    <menu>
        <button type="button" class="alt-cancel">Cancel</button>
        <button type="button" class="alt-save">Save</button>
    </menu>
</dialog>

<dialog class="crop-dialog" aria-label="Crop image">
    <h2>Crop image</h2>
    <div class="crop-slot"></div>
    <menu>
        <button type="button" class="crop-cancel">Cancel</button>
        <button type="button" class="crop-save">Save</button>
    </menu>
</dialog>
```

### No ids

There are no `id`/`for` pairs and no `aria-labelledby`. The textarea is
wrapped by its own `<label>` (implicit labelling, valid because a
textarea is that label's own control), and each dialog carries
`aria-label`. Ten `<image-input>` elements on one page therefore
produce zero duplicate ids.

Note the constraint already recorded in `src/AGENTS.md`: a `<label>`
may not contain labelable descendants other than its own control. A
label wrapping exactly one textarea satisfies this.

### Lazy `<image-crop>`

`ImageCrop.connectedCallback` attaches four `window` listeners
(`resize`, `pointermove`, `pointerup`, `pointercancel`). Rendering an
`<image-crop>` inside every `image-input` would mean forty idle
listeners on a page with ten inputs, for a crop nobody opened.

Instead the crop dialog renders an empty `.crop-slot`, and the
`<image-crop>` element is created and inserted on first open. It is
left in place afterwards, so reopening is cheap. It unregisters
naturally when the host `image-input` disconnects and the subtree goes
with it.

### Distinct class names per button

The two Cancel buttons are `.alt-cancel` and `.crop-cancel`, not a
shared `.dialog-cancel`. `this.qs()` is `this.querySelector()` and
returns only the first match, so a shared class would silently wire up
one dialog's Cancel and leave the other dead. Same reasoning for
`.alt-save` and `.crop-save`.

All six new listeners (two Save, two Cancel, and the two dialogs
themselves if they need any) are attached in `setupEventListeners` and
removed in `disconnectedCallback`, matching the existing pattern for
`.remove`, `.edit` and `.alt-badge`.

### Form safety

The textarea has no `name` and every button is `type="button"`, so an
`<image-input>` nested in a `<form>` submits exactly what it does
today: the file input's `files`, and nothing else.

## Behaviour

| Trigger | Result |
| --- | --- |
| `.edit` click, event not canceled | ensure `<image-crop>`, `crop.setFile(file)`, `showModal()` |
| `.alt-badge` click, event not canceled | seed textarea from `this.alt`, `showModal()`, focus textarea |
| either event canceled | nothing opens |
| crop Save | `getBlob()` -> `setImage(blob)` -> `close()` |
| alt Save | `this.alt = textarea.value` -> `close()` |
| Cancel button, Esc | `close()`, no state change, no event |

`showModal()` throws `InvalidStateError` on an already-open dialog, so
both open paths check `dialog.open` first.

## CSS

Top-layer promotion changes painting and stacking, not the DOM tree, so
`image-input dialog` and `image-input dialog::backdrop` keep matching
while the dialog is open. All dialog styling lives in `src/index.css`
nested under the existing `image-input` block, so it cannot leak onto a
consumer's own dialogs.

```css
& dialog {
    opacity: 0;
    transform: scale(var(--image-input-dialog-scale-from));
    transition-property: opacity, transform, display, overlay;
    transition-duration: var(--image-input-dialog-duration);
    transition-timing-function: ease-out;
    transition-behavior: allow-discrete;

    &[open] {
        opacity: 1;
        transform: scale(1);

        @starting-style {
            opacity: 0;
            transform: scale(var(--image-input-dialog-scale-from));
        }
    }
}
```

The backdrop transitions from `transparent` to
`--image-input-dialog-backdrop-color` the same way, with its own
`@starting-style` inside `&[open]::backdrop`.

### New variables in `src/_vars.css`

- `--image-input-dialog-bg`
- `--image-input-dialog-radius`, defaulting to
  `var(--image-input-radius)`
- `--image-input-dialog-padding`
- `--image-input-dialog-max-width`
- `--image-input-dialog-backdrop-color`
- `--image-input-dialog-duration`, `250ms`, matching
  `@substrate-system/dialog`
- `--image-input-dialog-scale-from`, `0.95`, also matching it

### Reduced motion

A `@media (prefers-reduced-motion: reduce)` block drops the transform
and cuts the duration to `0.01ms`. It does not set
`transition: none`, because `allow-discrete` still has to fire for the
dialog to become visible at all.

### Browser support

`@starting-style` and `transition-behavior` are Baseline since
2024-08-06. `overlay` is Chromium-only. In Firefox and Safari the entry
fade works and the exit is instant. Since only an entry animation is
specified, this costs nothing.

## Testing

Behavioural assertions only. No assertions on rendered text content,
per the project's testing rules. Added to `test/index.ts`:

1. Clicking `.edit` with a file loaded opens the crop dialog
   (`dialog.open === true`).
2. Clicking `.alt-badge` with a file loaded opens the alt dialog.
3. The alt textarea is seeded from that element's current `alt`.
4. Alt save sets the `alt` property and emits
   `image-input:alt-change`.
5. Cancel closes the dialog and leaves `alt` unchanged.
6. `preventDefault()` on `image-input:edit` stops the crop dialog
   opening.
7. `preventDefault()` on `image-input:alt` stops the alt dialog
   opening.
8. No `<image-crop>` exists in the DOM until the crop dialog is opened
   for the first time.
9. Two `<image-input>` elements on one page keep independent dialogs
   and independent `alt` values.

`npm test` must pass, including `npm run lint` and the
`tsc --emitDeclarationOnly` step inside `npm run build`.

## Documentation

`README.md`:

- A new section describing the built-in dialogs.
- The new CSS variables added to the variables list.
- The `image-input:edit` and `image-input:alt` entries rewritten to
  document cancelability. The existing "open a crop dialog, then
  `setImage(croppedBlob)`" snippet is reframed as the documented
  opt-out rather than the default path.

`src/AGENTS.md`:

- Why the dialogs use no ids.
- Why `<image-crop>` is created lazily.
- The `overlay` support caveat.

`example/index.ts` drops its dialog markup and wiring, keeping only the
`image-input` element and the `alt-change` display.

## Out of scope

- Exit animations. Only the open animation is specified.
- Light-dismiss (`closedby`) on the dialogs.
- Any change to `image-crop`'s own API.
- Per-element overrides of the dialog copy.

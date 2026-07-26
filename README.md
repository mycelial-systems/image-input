# image input
![tests](https://github.com/substrate-system/image-input/actions/workflows/nodejs.yml/badge.svg)
[![types](https://img.shields.io/npm/types/@substrate-system/image-input?style=flat-square)](README.md)
[![module](https://img.shields.io/badge/module-ESM%2FCJS-blue?style=flat-square)](README.md)
[![install size](https://flat.badgen.net/packagephobia/install/@bicycle-codes/keys?cache-control=no-cache)](https://packagephobia.com/result?p=@bicycle-codes/keys)
[![GZip size](https://img.badgesize.io/https%3A%2F%2Fesm.sh%2F%40substrate-system%2Fimage-input%2Fes2022%2Ffile.mjs?style=flat-square&compression=gzip)](https://esm.sh/@substrate-system/image-input/es2022/image-input.mjs)
[![dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen.svg?style=flat-square)](package.json)
[![semantic versioning](https://img.shields.io/badge/semver-2.0.0-blue?logo=semver&style=flat-square)](https://semver.org/)
[![Common Changelog](https://nichoth.github.io/badge/common-changelog.svg)](./CHANGELOG.md)
[![license](https://img.shields.io/badge/license-Big_Time-blue?style=flat-square)](LICENSE)

Web component for inputting images. Includes client-side preview, a crop
tool, and `alt` text input.

[See a live demo](https://substrate-system.github.io/image-input/)

<!-- toc -->

- [Install](#install)
  * [ESM](#esm)
  * [Common JS](#common-js)
- [CSS](#css)
  * [Import CSS](#import-css)
  * [CSS variables](#css-variables)
- [Example](#example)
  * [Drop target](#drop-target)
  * [Attributes](#attributes)
  * [Events](#events)
  * [Built-in dialogs](#built-in-dialogs)
  * [`image-crop`](#image-crop)
- [API](#api)
- [API](#api-1)
  * [JS](#js)
  * [HTML](#html)
  * [pre-built](#pre-built)

<!-- tocstop -->

## Install

```sh
npm i -S @substrate-system/image-input
```

### ESM
```js
import '@substrate-system/image-input'
```

### Common JS
```js
require('@substrate-system/image-input')
```

## CSS

### Import CSS

```js
import '@substrate-system/image-input/css'
```

Or minified:
```js
import '@substrate-system/image-input/css/min'
```

### CSS variables

`image-input` sets no width, height, min-height or aspect-ratio on
the box -- size it yourself:

```css
image-input .box {
    width: 100%;
    max-width: 480px;
    min-height: 200px;
}
```

Everything else is a CSS custom property, defined in `_vars.css` and
overridable from your own stylesheet:

* `--image-input-border-width`, `--image-input-border-style`,
  `--image-input-border-color` -- the box's border.
* `--image-input-border-color-drag`, `--image-input-border-style-drag`
  -- the border while a file is dragged over the box.
* `--image-input-box-bg`, `--image-input-box-bg-drag` -- box
  background, default and while dragging.
* `--image-input-box-padding` -- padding around the prompt in the
  empty box.
* `--image-input-prompt-color`, `--image-input-prompt-icon-size`,
  `--image-input-prompt-gap` -- the empty box's icon and text.
* `--image-input-radius` -- corner radius, shared by the box and the
  preview image.
* `--image-input-focus-color` -- the keyboard focus ring, shared with
  the overlay buttons.
* `--image-input-dialog-bg`, `--image-input-dialog-radius`,
  `--image-input-dialog-padding`, `--image-input-dialog-max-width`,
  `--image-input-dialog-backdrop-color` -- the built-in alt-text and
  crop dialogs' background, corner radius (defaults to
  `--image-input-radius`), padding, max width, and backdrop color.
* `--image-input-dialog-max-width-viewport` -- the second half of the
  dialog width clamp, `90vw` by default. The dialog is never wider
  than the smaller of this and `--image-input-dialog-max-width`, so it
  cannot overflow a narrow screen.
* `--image-input-dialog-menu-gap`, `--image-input-dialog-menu-margin`
  -- the gap between the dialogs' Cancel and Save buttons, and the
  space above that row.
* `--image-input-dialog-field-gap`,
  `--image-input-dialog-textarea-padding` -- the space between the alt
  dialog's label and its textarea, and the textarea's own padding.
* `--image-input-dialog-crop-max-width` -- the widest the
  `<image-crop>` inside the crop dialog will render. `100%` by
  default, so it fills the dialog's content box.
* `--image-crop-max-height` -- the tallest an `<image-crop>` will
  render, `65vh` by default. This is what keeps a tall portrait image
  from pushing the Cancel and Save buttons off screen. It must be a
  value that resolves to a length, because `ImageCrop` reads it back
  to size the crop frame; a percentage is treated as no cap at all.
* `--image-input-dialog-duration`, `--image-input-dialog-scale-from`
  -- the duration of the dialogs' open/close fade-and-scale, and the
  scale they animate in from.

## Example

This calls the global function `customElements.define`. Just import, then use
the tag in your HTML.

```js
const input = document.querySelector('image-input')

input.addEventListener('image-input:change', ev => {
    const { file, alt } = ev.detail
    // upload the file, etc.
})

input.addEventListener('image-input:edit', ev => {
    // image-input opens its own crop dialog after this event fires --
    // you don't need this listener at all to get that behavior. Call
    // preventDefault() only if you want to replace it with your own
    // crop UI:
    ev.preventDefault()
    const { file } = ev.detail
    // open your own crop dialog, then:
    // input.setImage(croppedBlob)
})
```

### Drop target

`image-input` renders as a bordered box that is both the file picker
and the drop target. Click the box, or focus it with Tab and press
Space, to open the native file picker -- or drag an image file onto
the box and drop it. Click and drop are equivalent: both result in
the same preview, the same `image-input:change` event, and the same
entry in `input.files` for form submission. The box's border and
background change while a file is dragged over it, and clicking the
box again after an image is loaded reopens the picker and replaces
it.

### Attributes

All attributes are reflected as properties, so `input.alt = 'a photo'`
is the same as setting the attribute in HTML.

* `accept` -- File types the input accepts, passed through to the
  native file input. Defaults to `image/*`.
* `name` -- Name for the internal file input, so the component works
  inside a `<form>`.
* `alt` -- Alt text for the preview image. Changing it emits an
  `image-input:alt-change` event and updates the ALT badge state.
* `required` -- Boolean. Marks the internal file input as required
  for form validation.
* `label` -- Prompt text shown in the empty box, and used as the file
  input's `aria-label`. Defaults to `Drop an image, or click to
  choose one`.

```html
<image-input
    accept="image/png, image/jpeg"
    name="avatar"
    alt="A description of the image"
    required
></image-input>
```

### Events

All events are namespaced with the tag name, e.g. `image-input:change`.
They bubble, so you can listen on the element or an ancestor.

* `image-input:change` -- A file was selected, or `setImage(blob)` was
  called. `detail` is `{ file:File, alt:string }`.
* `image-input:remove` -- The remove button was clicked. The preview
  and file have already been cleared. No `detail`.
* `image-input:edit` -- The edit button was clicked. `detail` is
  `{ file:File }`. Cancelable: by default, the built-in crop dialog
  (see [Built-in dialogs](#built-in-dialogs) below) opens right after
  this event fires. Call `preventDefault()` on it to suppress that
  dialog and open your own crop UI instead, then call `setImage(blob)`
  with the result.
* `image-input:alt` -- The ALT badge was clicked. `detail` is
  `{ file:File, alt:string }`. Cancelable: by default, the built-in
  alt-text dialog opens right after this event fires. Call
  `preventDefault()` on it to suppress that dialog and open your own
  alt text editor instead, then set the `alt` property with the
  result.
* `image-input:alt-change` -- The `alt` attribute or property changed.
  `detail` is `{ alt:string }`.
* `image-input:error` -- A picked or dropped file was not an image.
  `detail` is `{ reason:'not-an-image' }`. The component shows no
  message of its own; use this event to report the error yourself.

### Built-in dialogs

`image-input` renders two `<dialog>` elements as siblings of `.box`,
inside the element itself: `.alt-dialog` and `.crop-dialog`. The ALT
badge opens `.alt-dialog`; the edit button opens `.crop-dialog`. Both
fade and scale in when opened. You get this for free -- no markup or
wiring of your own is required.

* `.alt-dialog` contains a `<textarea>`, an `.alt-cancel` button and
  an `.alt-save` button. Saving assigns the textarea's value to
  `input.alt`, which emits `image-input:alt-change`.
* `.crop-dialog` contains a `.crop-slot` div, a `.crop-cancel` button
  and a `.crop-save` button. The `<image-crop>` element is created
  the first time the crop dialog is opened, and reused after that --
  it is not present in the initial markup. Saving calls
  `cropEl.getBlob()` and passes the result to `input.setImage(blob)`,
  which emits `image-input:change`.

No new event types exist for this. Both dialogs sit on top of the
events already documented above: `image-input:edit` and
`image-input:alt` open them (unless canceled), and saving fires the
existing `image-input:change` / `image-input:alt-change`.

Neither dialog's markup has an `id` -- `image-input` is a light-DOM
component, so an `id` in its own markup would collide with every
other `image-input` on the page. Each dialog is labeled with
`aria-label` instead.

#### Changing the dialog copy

`ImageInput.TEXT` is a static object with keys `altHeading`,
`altLabel`, `cropHeading`, `save` and `cancel`. Each element reads it
when it renders, so reassigning it affects every `image-input` that
upgrades afterwards, and leaves already-rendered elements on the old
copy. Set it before the first `image-input` upgrades -- next to the
import is the simplest place -- and the whole page is consistent. The
copy is page-wide, not per element:

```js
import { ImageInput } from '@substrate-system/image-input'

ImageInput.TEXT = {
    ...ImageInput.TEXT,
    cropHeading: 'Crop your photo'
}
```

`TEXT` only controls the dialogs' headings and button labels. The
alt text *value* is still set per element, through the existing
`alt` attribute/property.

#### Browser support for the open/close animation

The fade-and-scale transition uses `@starting-style` and
`transition-behavior: allow-discrete`, both Baseline since
2024-08-06. The `overlay` value, which keeps a closing dialog
painted for the length of its exit transition, is Chromium-only.
Firefox and Safari animate the dialog opening, then close it
instantly -- a known limitation of specifying only an entry
animation, not a bug.

### `image-crop`

The package also exports an `image-crop` component, a cropping UI
with draggable handles. `image-input` uses it internally for the
built-in crop dialog, described above. You can also use it directly
if you build your own crop UI, as in the reframed
`image-input:edit` example above.

```js
import { ImageCrop } from '@substrate-system/image-input/crop'
```

#### Attributes

* `src` -- URL of the image to crop. Reflected as a property. You can
  also pass a `File` directly with `cropEl.setFile(file)`.

#### Events

* `image-crop:change` -- The crop rectangle changed, via pointer or
  keyboard. `detail` is the crop rect,
  `{ x:number, y:number, width:number, height:number }`, in natural
  (not displayed) image pixels. Call `cropEl.getBlob()` to get the
  cropped image as a `Blob`.

## API

### Server rendering

The same markup is available as a string, so a page can render the
input server-side and attach behavior later, or never.

```js
import { html } from '@substrate-system/image-input/html'

res.send(`<image-input>${html({ name: 'avatar' })}</image-input>`)
```

Two rules:

* **The host element must be an `<image-input>` tag.** Every rule in
  the stylesheet is scoped under that element selector, so markup
  dropped into a `<div>` renders unstyled.
* **Import the CSS.** The markup carries no inline styles.

The page is styled and the picker works with no JavaScript at all,
because the control is a real `<input type="file">`. To add the
preview, the overlay buttons and the dialogs, hydrate it:

```js
import { ImageInputClient } from '@substrate-system/image-input/client'

const client = new ImageInputClient(
    document.querySelector('image-input')
)
```

`ImageInputClient` emits `image-input:change`, `image-input:remove`,
`image-input:edit`, `image-input:alt` and `image-input:alt-change`,
honors `preventDefault()` on `:edit` and `:alt` the same way the
custom element does, and exposes `setImage(blob)`, `clear()` and
`destroy()`.

`html()` takes `accept`, `name`, `required`, `alt` and `label`, plus
`dialogs: false` to leave the built-in dialogs out when you supply
your own editing UI. Pass `text` (the same shape as `ImageInput.TEXT`)
to set the built-in dialogs' copy on this path, without importing the
custom element:

```js
import { DEFAULT_TEXT } from '@substrate-system/image-input/dialogs'

html({ name: 'avatar', text: { ...DEFAULT_TEXT, cropHeading: 'Crop' } })
```

Some differences from the custom element:

* `ImageInputClient` does not write the picked file back into
  `input.files`, so a cropped image does not submit with a
  surrounding form on this path. Use the custom element where form
  submission matters.
* There is no drop target on this path. Dropping a file onto the box
  falls through to the browser's default behavior (typically
  navigating to the file) instead of showing a preview -- only the
  file picker works. The custom element's drag-and-drop wiring is not
  part of `ImageInputClient`.
* `ImageInputClient` never emits `image-input:error`. Picking a
  non-image file is silently ignored rather than reported; there is
  no drop path to report errors from either.

Use the custom element where any of these matter.

## API

This exposes ESM and common JS via
[package.json `exports` field](https://nodejs.org/api/packages.html#exports).

### JS
```js
import '@substrate-system/image-input'
```

### HTML
```html
<div>
    <image-input></image-input>
</div>
```

### pre-built
This package exposes minified JS and CSS files too. Copy them to a location that is
accessible to your web server, then link to them in HTML.

#### Copy
```sh
cp ./node_modules/@substrate-system/image-input/dist/index.min.js ./public/image-input.min.js
cp ./node_modules/@substrate-system/image-input/dist/style.min.css ./public/image-input.css
```

#### HTML
```html
<head>
    <link rel="stylesheet" href="./image-input.css">
</head>
<body>
    <!-- ... -->
    <script type="module" src="./image-input.min.js"></script>
</body>
```

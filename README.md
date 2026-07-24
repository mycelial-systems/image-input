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

Web component for inputting images. Includes client-side visibility, a crop
tool, and `alt` text input.

[See a live demo](https://substrate-system.github.io/image-input/)

<!-- toc -->

- [Install](#install)
- [API](#api)
  * [ESM](#esm)
  * [Common JS](#common-js)
- [CSS](#css)
  * [Import CSS](#import-css)
- [Use](#use)
  * [Attributes](#attributes)
  * [Events](#events)
  * [`image-crop`](#image-crop)
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
    const { file } = ev.detail
    // open a crop dialog, then:
    // input.setImage(croppedBlob)
})
```

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
  called. `detail` is `{ file:File|Blob, alt:string }`.
* `image-input:remove` -- The remove button was clicked. The preview
  and file have already been cleared. No `detail`.
* `image-input:edit` -- The edit button was clicked. `detail` is
  `{ file:File|Blob }`. Use this to open a crop/edit UI, then call
  `setImage(blob)` with the result.
* `image-input:alt` -- The ALT badge was clicked. `detail` is
  `{ file:File|Blob, alt:string }`. Use this to open an alt text
  editor, then set the `alt` property with the result.
* `image-input:alt-change` -- The `alt` attribute or property changed.
  `detail` is `{ alt:string }`.

### `image-crop`

The package also exports an `image-crop` component, a cropping UI
with draggable handles. See [the example](./example/index.ts) for how
to wire it up to `image-input`.

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

# image input
![tests](https://github.com/substrate-system/image-input/actions/workflows/nodejs.yml/badge.svg)
[![types](https://img.shields.io/npm/types/@substrate-system/image-input?style=flat-square)](README.md)
[![module](https://img.shields.io/badge/module-ESM%2FCJS-blue?style=flat-square)](README.md)
[![install size](https://flat.badgen.net/packagephobia/install/@bicycle-codes/keys?cache-control=no-cache)](https://packagephobia.com/result?p=@bicycle-codes/keys)
[![GZip size](https://img.badgesize.io/https%3A%2F%2Fesm.sh%2F%40substrate-system%2Fimage-input%2Fes2022%2Ffile.mjs?style=flat-square&compression=gzip)](https://esm.sh/@substrate-system/image-input/es2022/image-input.mjs)
[![dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen.svg?style=flat-square)](package.json)
[![semantic versioning](https://img.shields.io/badge/semver-2.0.0-blue?logo=semver&style=flat-square)](https://semver.org/)
[![Common Changelog](https://nichoth.github.io/badge/common-changelog.svg)](./CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](LICENSE)

Web component for inputting images.

[See a live demo](https://substrate-system.github.io/image-input/)

<!-- toc -->

## Install

```sh
npm i -S @substrate-system/image-input
```

## API

This exposes ESM and common JS via [package.json `exports` field](https://nodejs.org/api/packages.html#exports).

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

## Use
This calls the global function `customElements.define`. Just import, then use
the tag in your HTML.

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

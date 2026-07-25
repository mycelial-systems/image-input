# AGENTS.md - example/

## How the example renders today

`example/index.ts` builds all its markup itself with
`document.body.innerHTML += \`...\``, and `example/index.html`'s
`<body>` holds only the module `<script>` tag. So a component tag added
statically to `index.html` ends up duplicated: one unwired copy from
the HTML, plus whatever `index.ts` renders.

This is scheduled to change. `specs/example-preact.json` (EP-001
through EP-004, designed in `specs/tasks/example-preact.md`) replaces
the imperative rendering with a preact app, adds a `<div id="app">`
mount point to `index.html`, and drives a state panel with
`@preact/signals`. Once EP-001 lands, this section is obsolete and the
preact contract rules from that spec replace it.

## The component owns its dialogs

`image-input` renders and opens its own alt-text and crop dialogs. The
example does not build modals, and it should not: that was the old
design. `image-input:edit` and `image-input:alt` still fire and are
still cancelable, so a consumer with its own UI calls
`preventDefault()` and drives the component through `setImage(blob)`
and the `alt` property.

Do not restate the component's API here. `src/AGENTS.md` and the README
are the source of truth for how it behaves.

## CSS

`example/index.css` styles the demo page only. It is not part of the
shipped package. Component-library CSS belongs in `src/index.css` and
`src/_vars.css` instead.

Two things about it that are deliberate but easy to misread:

- It uses bare `button` and `input` element selectors. Those now also
  match the component's built-in dialog buttons and its visually
  hidden file input. That is acceptable on a demo page, where the
  author controls the whole document. Never copy that pattern into
  `src/` -- library CSS must stay scoped under the `image-input`
  element so it cannot reach a consumer's markup.
- It sets `.box` width and `min-height`. The component does not size
  itself, by design, so any page using it has to. The README documents
  this.

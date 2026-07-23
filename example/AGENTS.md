# AGENTS.md - example/

- `example/index.ts` builds all page markup itself via
  `document.body.innerHTML += \`...\``. Keep `example/index.html`'s
  `<body>` to just the module `<script>` tag -- any component tags
  added statically to `index.html` will end up duplicated (a second,
  unwired copy) alongside whatever `index.ts` renders.
- `example/index.css` is styling for the example app only (dialogs,
  menus, layout around the demo). It is not part of the shipped
  package -- component-library CSS belongs in `src/index.css`/
  `src/_vars.css` instead.
- `image-input`/`image-crop` are headless with respect to dialogs: they
  only emit `edit`/`alt`/`change` events. Opening/closing a `<dialog>`
  in response is entirely the example app's (or any consumer's)
  responsibility -- don't add dialog-opening logic to the components
  themselves.

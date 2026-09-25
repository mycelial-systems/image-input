# Image Input

This is a web component for inputting images that includes a client-side
preview, alt text input, and crop tool. It can also show and crop a
stored image by URL (the `src` and `crossorigin` attributes, or
`ImageInputClient.setSrc()` for server-rendered markup); `edit()` opens
the crop dialog for either a picked file or the stored image. See
`docs/fdr/FDR-006-stored-image-source.md`.

Last verified: 2026-09-25

- `src/AGENTS.md` -- component internals, traps, and contracts.
- `example/AGENTS.md` -- rules for the preact demo page.
- `npm test` lints, builds, then runs the browser tests with
  `tapout --html test/index.html`. Static test fixtures live in
  `test/fixtures/` and are served at `/fixtures/...`.
